// XLSX intake and RA report normalization.
const RABI_TARGET_COLUMNS = [
  'Id HugMe',
  'Data Reclamação',
  'Tags',
  'Seu problema foi resolvido?',
  'Voltaria a fazer negócio?',
  'Nota',
  'Tempo primeira resposta (público)',
  'Atribuido Para',
  'Tipo de Cliente'
];

let latestParsedRaReport = null;

function setLatestParsedRaReport(report) {
  latestParsedRaReport = report || null;
}

function getLatestParsedRaReport() {
  return latestParsedRaReport;
}

function normalizeReportHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getXmlAttribute(source, name) {
  const match = String(source || '').match(new RegExp(`\\b${name}="([^"]*)"`, 'i'));
  return match ? decodeXmlText(match[1]) : '';
}

function decodeXmlText(value) {
  return String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripXmlTags(value) {
  return decodeXmlText(String(value || '').replace(/<[^>]+>/g, ''));
}

function columnRefToIndex(ref) {
  const letters = String(ref || '').match(/[A-Z]+/i)?.[0] || '';
  let index = 0;
  for (const letter of letters.toUpperCase()) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return Math.max(0, index - 1);
}

function findEndOfCentralDirectory(bytes, view) {
  const min = Math.max(0, bytes.length - 66000);
  for (let offset = bytes.length - 22; offset >= min; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  return -1;
}

async function inflateZipBytes(bytes) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('Chrome nao disponibilizou DecompressionStream para ler XLSX.');
  }

  const formats = ['deflate-raw', 'deflate'];
  let lastError = null;
  for (const format of formats) {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Falha ao descompactar XLSX.');
}

async function unzipXlsxEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  const eocdOffset = findEndOfCentralDirectory(bytes, view);
  if (eocdOffset < 0) throw new Error('Arquivo XLSX invalido: diretorio ZIP nao encontrado.');

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirOffset = view.getUint32(eocdOffset + 16, true);
  const entries = new Map();
  let offset = centralDirOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('Arquivo XLSX invalido: entrada ZIP corrompida.');
    }

    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const nameBytes = bytes.slice(offset + 46, offset + 46 + nameLength);
    const name = new TextDecoder().decode(nameBytes).replace(/\\/g, '/');

    if (view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error(`Arquivo XLSX invalido: cabecalho local ausente para ${name}.`);
    }

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);

    let content;
    if (method === 0) {
      content = compressed;
    } else if (method === 8) {
      content = await inflateZipBytes(compressed);
    } else {
      throw new Error(`Metodo ZIP nao suportado no XLSX: ${method}.`);
    }

    entries.set(name, content);
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function decodeEntryText(entries, path) {
  const content = entries.get(path);
  if (!content) return '';
  return new TextDecoder('utf-8').decode(content);
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const values = [];
  const itemRegex = /<si\b[\s\S]*?<\/si>/gi;
  const textRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;
  let itemMatch;

  while ((itemMatch = itemRegex.exec(xml))) {
    const itemXml = itemMatch[0];
    const parts = [];
    let textMatch;
    while ((textMatch = textRegex.exec(itemXml))) {
      parts.push(decodeXmlText(textMatch[1]));
    }
    values.push(parts.length ? parts.join('') : stripXmlTags(itemXml));
  }
  return values;
}

function parseCellValue(cellXml, cellAttrs, sharedStrings) {
  const type = getXmlAttribute(cellAttrs, 't');
  if (type === 'inlineStr') {
    const inlineText = cellXml.match(/<t\b[^>]*>([\s\S]*?)<\/t>/i)?.[1] || '';
    return decodeXmlText(inlineText).trim();
  }

  const rawValue = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1] || '';
  const decoded = decodeXmlText(rawValue).trim();
  if (type === 's') return String(sharedStrings[Number(decoded)] || '').trim();
  if (type === 'str') return decoded;
  if (type === 'b') return decoded === '1' ? 'TRUE' : 'FALSE';
  return decoded;
}

function parseWorksheetRows(xml, sharedStrings) {
  const rows = [];
  const rowRegex = /<row\b([^>]*)>([\s\S]*?)<\/row>/gi;
  const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(xml))) {
    const attrs = rowMatch[1] || '';
    const body = rowMatch[2] || '';
    const rowNumber = Number(getXmlAttribute(attrs, 'r')) || rows.length + 1;
    const values = [];
    let cellMatch;

    while ((cellMatch = cellRegex.exec(body))) {
      const cellAttrs = cellMatch[1] || '';
      const cellRef = getXmlAttribute(cellAttrs, 'r');
      const columnIndex = columnRefToIndex(cellRef) || values.length;
      values[columnIndex] = parseCellValue(cellMatch[2] || '', cellAttrs, sharedStrings);
    }

    rows.push({ rowNumber, values });
  }

  return rows;
}

function findReportHeader(rows) {
  const required = RABI_TARGET_COLUMNS.map(normalizeReportHeader);

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const headers = rows[rowIndex].values.map(normalizeReportHeader);
    const map = new Map(headers.map((header, index) => [header, index]));
    if (required.every((header) => map.has(header))) {
      return { rowIndex, rowNumber: rows[rowIndex].rowNumber, map };
    }
  }

  return null;
}

function parseReportDateValue(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const serial = Number(text.replace(',', '.'));
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    return Math.round((serial - 25569) * 86400000);
  }

  const br = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (br) {
    const year = Number(br[3].length === 2 ? `20${br[3]}` : br[3]);
    return new Date(year, Number(br[2]) - 1, Number(br[1]), Number(br[4] || 0), Number(br[5] || 0), Number(br[6] || 0)).getTime();
  }

  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : parsed;
}

function sameReportColumn(column, expected) {
  return normalizeReportHeader(column) === normalizeReportHeader(expected);
}

function formatIntegerLikeValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const number = Number(text.replace(',', '.'));
  if (!Number.isFinite(number)) return text;
  return String(Math.round(number));
}

function formatDecimalLikeValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const number = Number(text.replace(',', '.'));
  if (!Number.isFinite(number)) return text;
  return Number.isInteger(number) ? String(number) : String(number).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

function formatExcelSerialDateForSheet(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const serial = Number(text.replace(',', '.'));
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    const date = new Date(Math.round((serial - 25569) * 86400000));
    const pad = (number) => String(number).padStart(2, '0');
    return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  }

  const br = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?/);
  if (br) {
    const day = String(Number(br[1])).padStart(2, '0');
    const month = String(Number(br[2])).padStart(2, '0');
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    const hour = String(Number(br[4] || 0)).padStart(2, '0');
    const minute = String(Number(br[5] || 0)).padStart(2, '0');
    return `${day}/${month}/${year} ${hour}:${minute}`;
  }

  return text;
}

function normalizeReportCellValue(column, value) {
  const text = String(value ?? '').trim();
  if (sameReportColumn(column, 'Id HugMe')) return formatIntegerLikeValue(text);
  if (sameReportColumn(column, 'Data Reclamação')) return formatExcelSerialDateForSheet(text);
  if (sameReportColumn(column, 'Nota')) return formatDecimalLikeValue(text);
  if (sameReportColumn(column, 'Tempo primeira resposta (público)')) return formatIntegerLikeValue(text);
  return text;
}

function validateReportRows(rows) {
  const seen = new Set();
  let previousDate = null;

  for (const row of rows) {
    const id = String(row['Id HugMe'] || '').trim();
    if (!id) return `Linha ${row.__sourceRowNumber}: Id HugMe vazio.`;
    if (seen.has(id)) return `Id HugMe duplicado no relatorio: ${id}.`;
    seen.add(id);

    const dateMs = parseReportDateValue(row['Data Reclamação']);
    if (dateMs === null) return `Linha ${row.__sourceRowNumber}: Data Reclamação invalida.`;
    if (previousDate !== null && dateMs < previousDate) {
      return 'Relatorio nao esta ordenado de forma ascendente por Data Reclamação.';
    }
    previousDate = dateMs;
  }

  return '';
}

function getReportBoundarySummary(rows) {
  const first = rows[0] || {};
  const last = rows[rows.length - 1] || {};
  return {
    firstId: first['Id HugMe'] || '',
    lastId: last['Id HugMe'] || '',
    firstDate: first['Data Reclamação'] || first['Data ReclamaÃ§Ã£o'] || '',
    lastDate: last['Data Reclamação'] || last['Data ReclamaÃ§Ã£o'] || ''
  };
}

function normalizeReportRowsFromWorksheet(rows, sheetPath) {
  const header = findReportHeader(rows);
  if (!header) {
    return { ok: false, reason: `Cabecalho esperado nao encontrado em ${sheetPath}.` };
  }

  const normalizedRows = [];
  for (let rowIndex = header.rowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const source = rows[rowIndex];
    const normalized = {};
    let hasAnyValue = false;

    for (const column of RABI_TARGET_COLUMNS) {
      const sourceIndex = header.map.get(normalizeReportHeader(column));
      const value = normalizeReportCellValue(column, source.values[sourceIndex]);
      normalized[column] = value;
      if (value) hasAnyValue = true;
    }

    if (!hasAnyValue) continue;
    normalized.__sourceRowNumber = source.rowNumber;
    normalizedRows.push(normalized);
  }

  if (!normalizedRows.length) {
    return { ok: false, reason: `Nenhuma linha de dados encontrada em ${sheetPath}.` };
  }

  const validationError = validateReportRows(normalizedRows);
  if (validationError) return { ok: false, reason: validationError };

  return {
    ok: true,
    sheetPath,
    headerRowNumber: header.rowNumber,
    rows: normalizedRows
  };
}

async function parseRaReportXlsx(arrayBuffer) {
  const entries = await unzipXlsxEntries(arrayBuffer);
  const sharedStrings = parseSharedStrings(decodeEntryText(entries, 'xl/sharedStrings.xml'));
  const sheetPaths = Array.from(entries.keys())
    .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(path))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (!sheetPaths.length) {
    return { ok: false, stage: 'xlsx-parser', reason: 'Nenhuma planilha foi encontrada dentro do XLSX.' };
  }

  const failures = [];
  for (const sheetPath of sheetPaths) {
    const xml = decodeEntryText(entries, sheetPath);
    const parsed = normalizeReportRowsFromWorksheet(parseWorksheetRows(xml, sharedStrings), sheetPath);
    if (parsed.ok) {
      const summary = getReportBoundarySummary(parsed.rows);
      return {
        ok: true,
        stage: 'xlsx-parser',
        columns: [...RABI_TARGET_COLUMNS],
        sheetPath: parsed.sheetPath,
        headerRowNumber: parsed.headerRowNumber,
        rowCount: parsed.rows.length,
        firstId: summary.firstId,
        lastId: summary.lastId,
        firstDate: summary.firstDate,
        lastDate: summary.lastDate,
        rows: parsed.rows
      };
    }
    failures.push(parsed.reason);
  }

  return {
    ok: false,
    stage: 'xlsx-parser',
    reason: failures[0] || 'Nao foi possivel normalizar o relatorio XLSX.'
  };
}

async function fetchAndParseRaReportDownload(download) {
  const url = String(download?.url || '').trim();
  if (!url) {
    return {
      ok: false,
      stage: 'xlsx-fetch',
      reason: 'O download nao expos uma URL legivel para buscar o XLSX.'
    };
  }

  try {
    const response = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!response.ok) {
      return {
        ok: false,
        stage: 'xlsx-fetch',
        reason: `Nao foi possivel buscar o XLSX baixado novamente (${response.status}).`
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    return parseRaReportXlsx(arrayBuffer);
  } catch (error) {
    return {
      ok: false,
      stage: 'xlsx-fetch',
      reason: `Chrome/HugMe bloqueou a leitura automatica do XLSX: ${error?.message || String(error)}`
    };
  }
}

async function fetchAndParsePackagedRaReport(resourcePath) {
  const path = String(resourcePath || '').replace(/^\/+/, '');
  if (!path) {
    return { ok: false, stage: 'xlsx-fetch', reason: 'Caminho do XLSX empacotado nao informado.' };
  }

  try {
    const response = await fetch(chrome.runtime.getURL(path), { cache: 'no-store' });
    if (!response.ok) {
      return {
        ok: false,
        stage: 'xlsx-fetch',
        reason: `Nao foi possivel ler o XLSX local empacotado (${response.status}): ${path}`
      };
    }
    const arrayBuffer = await response.arrayBuffer();
    return parseRaReportXlsx(arrayBuffer);
  } catch (error) {
    return {
      ok: false,
      stage: 'xlsx-fetch',
      reason: `Chrome nao conseguiu ler o XLSX local empacotado ${path}: ${error?.message || String(error)}`
    };
  }
}
