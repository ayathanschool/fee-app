Apps Script backend for Fee Collection

This folder contains the Google Apps Script `Code.gs` that implements a small web API for the front-end.

Required sheet tabs (create a Google Spreadsheet and add these exact tab names or change `CONFIG.SHEET_NAMES` in `Code.gs`):
- Students
- FeeHeads
- Transactions
- Users

Quick deploy steps
1. Open Google Drive → New → More → Google Apps Script.
2. Paste the contents of `Code.gs` into the script editor.
3. Set the script API key. There are two ways:
   - Recommended (UI): In Apps Script editor open Project settings → Script properties and add key `API_KEY` with value `feemgr-2025` (or your chosen secret).
   - Shortcut (editor): run the `setScriptApiKey('feemgr-2025')` function once from the editor (select the function and click Run). Authorize if prompted.
4. Save the project.
5. Deploy → New deployment → Select "Web app".
   - Execute as: Me
   - Who has access: Anyone (or Anyone with link) — pick based on your security needs.
6. Copy the Web app URL and set the `BASE_URL` constant in `src/api.js` to that URL.
7. In your spreadsheet, create the four tabs and paste the header rows from `apps-script/samples/` (provided here).

- Minimal steps to finish (exact order):

- In your Spreadsheet: Extensions → Apps Script. Paste `Code.gs` and Save.
- In Apps Script: Project settings → Script properties → add `API_KEY = feemgr-2025` (or run `setScriptApiKey('feemgr-2025')`).
- Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
- Copy the Web app URL and update `src/api.js` BASE_URL.
- Run `npm run dev` locally and open the app.

Notes and testing
- The script expects the sheet header row to be the first row. Header names should match those in the samples.
- For quick testing, use the sample Users row (username/password) to sign in via the app.
- The API uses `KEY` param (see `API_KEY`) for simple protection. Keep it secret.

Limitations & recommendations
- Passwords in the sample `Users` are plaintext — for production use a proper authentication provider or at least store hashed passwords.
- The receipt counter uses script properties. This is OK for light usage but may need more robust handling under heavy load.

Contact
- If you want, I can add a small admin UI in the app to manage Users (create/disable), or extend the Apps Script with extra validation (e.g., check admNo exists on addPaymentBatch).