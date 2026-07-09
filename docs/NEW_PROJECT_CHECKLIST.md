# RaBiTool Setup Checklist

Use this checklist while turning the scaffold into the first working Reclame Aqui to Excel automation.

## 1. Identity

- [x] Rename extension to RaBiTool.
- [x] Update `project/manifest.json` name, description, and action title.
- [x] Update core docs with the RaBiTool purpose.
- [x] Keep initial manifest version at `0.1.0`.

## 2. UI Baseline

- [x] Keep drag, gear, close, and separator.
- [x] Add first workflow controls to the popup.
- [x] Add status text to the popup.
- [x] Update options page copy for RA to Excel.
- [ ] Configure support placeholders later.

## 3. Workflow

- [x] Record source as Reclame Aqui.
- [x] Record destination as Excel Web.
- [x] Record first approach as browser UI automation.
- [x] Add workflow modules under `project/background/`.
- [x] Register workflow actions in `background/runtime.js`.
- [ ] Capture exact RA page URL and export steps.
- [ ] Capture exact Excel workbook URL, worksheet name, and target range.
- [ ] Define replace/append/clear behavior.
- [ ] Define XLSX row mapping.
- [ ] Implement RA automation.
- [ ] Implement XLSX parsing/preparation.
- [ ] Implement Excel Web import/paste/placement.
- [ ] Add smoke-test docs for the first workflow.

## 4. Permissions

- [x] Start broad while exploring.
- [x] Add downloads/offscreen/clipboard permissions for likely UI automation needs.
- [ ] Narrow host permissions/content script matches once target hosts are known.
- [ ] Revisit permissions before release.

## 5. Git

- [x] Confirm this copied project is not initialized as Git yet.
- [x] Align allowed Git email with the owner: `lorenzo.berto@eduzz.com`.
- [x] Initialize Git when the owner is ready.
- [x] Configure `.git-identity` and `.githooks`.
- [x] Verify `git config user.email` matches `.git-identity`.
- [x] Verify `git config core.hooksPath` is `.githooks`.
- [x] Align initial branch name as `main`.
- [x] Defer remote setup until later.
- [x] Make the first project-specific commit.
