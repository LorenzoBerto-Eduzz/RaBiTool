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
