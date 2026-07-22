# Release Process

RaBiTool has no build step. The Chrome load-unpacked source is `project/`.

## Local Test Export

Owner command: `localrelease`.

From the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/Export-LocalRelease.ps1
```

This creates a generated folder named after the export `-Name` parameter.

It does not create a zip by default because the owner prefers to zip manually when needed.

To explicitly create a zip too:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/Export-LocalRelease.ps1 -Zip
```

## Before A Public Release

1. Confirm `project/manifest.json` version and name.
2. Run JS syntax checks.
3. Load the exported folder in Chrome and smoke test.
4. Confirm no private data is included.
5. Package the generated folder manually, or run the export script with `-Zip` only when a zip is explicitly wanted.

## GitHub Release Flow

Owner command: `remoterelease`.

Only run this when the owner explicitly asks for it.

Current release target: `v1.0.1`.

Rules:

1. Use the current `project/manifest.json` version unless the owner explicitly asks to bump it first. Never change the manifest/code/docs version automatically.
2. Refresh the local release export and create the zip artifact.
3. Use GitHub tag/title/description based on the version name, for example `v0.1.0`.
4. Upload the zipped local release artifact as `RaBiTool.zip`.
5. Do not commit generated release folders or zip files to normal Git history.
6. Do not create or edit GitHub Releases unless the owner explicitly asks for `remoterelease` or gives a direct release instruction.

Current remote target:

```text
https://github.com/LorenzoBerto-Eduzz/RaBiTool.git
```

Future planned UI: add a config-page section that checks GitHub Releases for the newest version and provides a button to download the release asset.
