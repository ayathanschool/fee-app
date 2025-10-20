// Google Apps Script WebApp: Users API for Fees app
// Actions supported (GET/POST via JSON):
//  - users (GET) -> list all users
//  - addUser (POST) -> add a user if not present (duplicate-check by email)
//  - updateUser (POST) -> update existing user by email (e.g., role)
//
// Response schema: { ok: true, data: ... } on success or { ok: false, error: 'message' } on error

var CONFIG = {
  // TODO: set this to your spreadsheet ID
  SPREADSHEET_ID: '1Q5FTqOPDrlzDGztv1zyIYl-WMIHWONzzbmH_RfyRRvs',
  API_KEY: 'feemgr-2025',
  SHEETS: {
  USERS: 'Users',
  STUDENTS: 'Students',
  FEEHEADS: 'FeeHeads',
  TRANSACTIONS: 'Transactions'
  }
};

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function isValidKey(key) {
  return key && key === CONFIG.API_KEY;
}

function doGet(e) {
  try {
    var action = (e.parameter && e.parameter.action) || '';
    var key = (e.parameter && e.parameter.key) || '';

    // quick ping (no key required) for deployment checks
    if (action === 'ping') {
      return jsonResponse({ ok: true, data: { version: '1.0', sheets: CONFIG.SHEETS } });
    }

    if (!isValidKey(key)) return jsonResponse({ ok: false, error: 'invalid_api_key' });

    // list users
    if (action === 'users') {
      var users = readUsers();
      return jsonResponse({ ok: true, data: users });
    }

    // list students, feeheads, transactions (reads the corresponding sheets)
    if (action === 'students') return jsonResponse({ ok: true, data: readSheetObjects(CONFIG.SHEETS.STUDENTS) });
    if (action === 'feeheads') return jsonResponse({ ok: true, data: readSheetObjects(CONFIG.SHEETS.FEEHEADS) });
    if (action === 'transactions') return jsonResponse({ ok: true, data: readSheetObjects(CONFIG.SHEETS.TRANSACTIONS) });

    return jsonResponse({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) return jsonResponse({ ok: false, error: 'missing_body' });
    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (err) {
      return jsonResponse({ ok: false, error: 'invalid_json' });
    }

    if (!isValidKey(payload.key)) return jsonResponse({ ok: false, error: 'invalid_api_key' });
    var action = payload.action || '';

    if (action === 'addUser') return handleAddUser(payload);
    if (action === 'updateUser') return handleUpdateUser(payload);

      // payment related actions
      if (action === 'addPaymentBatch') return handleAddPaymentBatch(payload);
      if (action === 'voidReceipt') return handleVoidReceipt(payload);
      if (action === 'unvoidReceipt') return handleUnvoidReceipt(payload);

      return jsonResponse({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

  // Generic reader: returns array of objects using header row
  function readSheetObjects(sheetName) {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    var values = sheet.getDataRange().getValues();
    if (!values || values.length < 1) return [];
    var headers = values[0].map(function(h){ return (''+h).toString().trim(); });
    var rows = values.slice(1);
    var out = rows.map(function(row){
      var obj = {};
      for (var i=0;i<headers.length;i++) {
        obj[headers[i] || ('col'+i)] = row[i];
      }
      return obj;
    });
    return out;
  }

// Read users from sheet and return array of objects
function readUsers() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEETS.USERS);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function(h){ return (''+h).toString().trim(); });
  var rows = values.slice(1);
  var users = rows.map(function(row, idx){
    var obj = {};
    for (var i=0;i<headers.length;i++) {
      var key = headers[i] || ('col' + i);
      obj[key] = row[i];
    }
    // normalize expected fields
    return {
      id: obj.id ? String(obj.id) : '',
      name: obj.name || obj.Name || '',
      email: obj.email || obj.Email || '',
      login_time: obj.login_time || obj.loginTime || '',
      role: obj.role || 'user',
      _row: idx + 2 // helpful for updates (sheet row index)
    };
  }).filter(function(u){ return u.email; });
  return users;
}

function findUserByEmail(email) {
  email = (email || '').toString().trim().toLowerCase();
  if (!email) return null;
  var users = readUsers();
  for (var i=0;i<users.length;i++) {
    if ((users[i].email || '').toString().trim().toLowerCase() === email) return users[i];
  }
  return null;
}

function handleAddUser(payload) {
  var name = (payload.name || payload.fullname || '').toString().trim();
  var email = (payload.email || '').toString().trim().toLowerCase();
  var role = (payload.role || 'user').toString().trim();
  if (!email) return jsonResponse({ ok: false, error: 'missing_email' });
  if (!name) name = email.split('@')[0];

  var existing = findUserByEmail(email);
  if (existing) {
    // don't create duplicate - return existing
    return jsonResponse({ ok: true, data: existing, note: 'existing_user' });
  }

  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEETS.USERS);
  if (!sheet) return jsonResponse({ ok: false, error: 'users_sheet_missing' });

  var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(function(h){ return (''+h).toString().trim(); });
  // ensure we have columns: id, name, email, login_time, role
  var id = Utilities.getUuid();
  var login_time = '';
  var rowMap = {};
  headers.forEach(function(h,i){ rowMap[h] = i; });

  var newRow = new Array(headers.length).fill('');
  if (typeof rowMap['id'] !== 'undefined') newRow[rowMap['id']] = id;
  if (typeof rowMap['name'] !== 'undefined') newRow[rowMap['name']] = name;
  if (typeof rowMap['email'] !== 'undefined') newRow[rowMap['email']] = email;
  if (typeof rowMap['login_time'] !== 'undefined') newRow[rowMap['login_time']] = login_time;
  if (typeof rowMap['role'] !== 'undefined') newRow[rowMap['role']] = role;

  sheet.appendRow(newRow);
  var user = findUserByEmail(email);
  return jsonResponse({ ok: true, data: user });
}

// ---------- Payments / Transactions ----------
function handleAddPaymentBatch(payload) {
  // payload: { date, admNo, name, cls, mode, remarks, items: [{feeHead, amount, fine, ref}], key }
  var date = payload.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var admNo = payload.admNo || '';
  var name = payload.name || '';
  var cls = payload.cls || payload.class || '';
  var mode = payload.mode || '';
  var remarks = payload.remarks || '';
  var items = payload.items || [];

  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEETS.TRANSACTIONS);
  if (!sheet) return jsonResponse({ ok: false, error: 'transactions_sheet_missing' });

  // generate a receipt number (timestamp based)
  var receiptNo = String(Date.now());

  // get headers to map columns
  var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(function(h){ return (''+h).toString().trim(); });

  // append one row per item
  items.forEach(function(it){
    var row = new Array(headers.length).fill('');
    setIf(headers, row, 'Date', date);
    setIf(headers, row, 'ReceiptNo', receiptNo);
    setIf(headers, row, 'AdmNo', admNo);
    setIf(headers, row, 'Name', name);
    setIf(headers, row, 'Class', cls);
    setIf(headers, row, 'FeeHead', it.feeHead || it.feehead || '');
    setIf(headers, row, 'Amount', it.amount || 0);
    setIf(headers, row, 'Fine', it.fine || 0);
    setIf(headers, row, 'Mode', mode);
    setIf(headers, row, 'Void', '');
    sheet.appendRow(row);
  });

  return jsonResponse({ ok: true, data: { receiptNo: receiptNo, date: date } });
}

function handleVoidReceipt(payload) {
  var receiptNo = (payload.receiptNo || payload.receipt || '').toString();
  if (!receiptNo) return jsonResponse({ ok: false, error: 'missing_receipt' });
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEETS.TRANSACTIONS);
  if (!sheet) return jsonResponse({ ok: false, error: 'transactions_sheet_missing' });
  var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(function(h){ return (''+h).toString().trim(); });
  var rows = sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getValues();
  var updated = 0;
  for (var r=0;r<rows.length;r++) {
    var rn = String(rows[r][headers.indexOf('ReceiptNo')] || '');
    if (rn === receiptNo) {
      sheet.getRange(r+2, headers.indexOf('Void')+1).setValue('Y');
      updated++;
    }
  }
  return jsonResponse({ ok: true, data: { updated: updated } });
}

function handleUnvoidReceipt(payload) {
  var receiptNo = (payload.receiptNo || payload.receipt || '').toString();
  if (!receiptNo) return jsonResponse({ ok: false, error: 'missing_receipt' });
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEETS.TRANSACTIONS);
  if (!sheet) return jsonResponse({ ok: false, error: 'transactions_sheet_missing' });
  var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(function(h){ return (''+h).toString().trim(); });
  var rows = sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getValues();
  var updated = 0;
  for (var r=0;r<rows.length;r++) {
    var rn = String(rows[r][headers.indexOf('ReceiptNo')] || '');
    if (rn === receiptNo) {
      sheet.getRange(r+2, headers.indexOf('Void')+1).setValue('');
      updated++;
    }
  }
  return jsonResponse({ ok: true, data: { updated: updated } });
}

// helper: set cell by header name if present
function setIf(headers, rowArr, headerName, value) {
  var idx = headers.indexOf(headerName);
  if (idx === -1) {
    // try lowercase match
    var lower = headers.map(function(h){ return (''+h).toLowerCase(); });
    idx = lower.indexOf(headerName.toLowerCase());
  }
  if (idx !== -1) rowArr[idx] = value;
}

function handleUpdateUser(payload) {
  var email = (payload.email || '').toString().trim().toLowerCase();
  if (!email) return jsonResponse({ ok: false, error: 'missing_email' });

  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEETS.USERS);
  if (!sheet) return jsonResponse({ ok: false, error: 'users_sheet_missing' });

  var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(function(h){ return (''+h).toString().trim(); });
  var rows = sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getValues();
  var targetRowIndex = -1;
  for (var r=0;r<rows.length;r++) {
    var rowEmail = (rows[r][headers.indexOf('email')] || rows[r][headers.indexOf('Email')] || '').toString().trim().toLowerCase();
    if (rowEmail === email) { targetRowIndex = r + 2; break; }
  }
  if (targetRowIndex === -1) return jsonResponse({ ok: false, error: 'user_not_found' });

  var updates = {};
  if (payload.role) updates['role'] = payload.role;
  if (payload.name) updates['name'] = payload.name;
  if (payload.login_time) updates['login_time'] = payload.login_time;

  // apply updates cell by cell
  for (var key in updates) {
    var colIdx = headers.indexOf(key);
    if (colIdx === -1) continue; // skip unknown
    sheet.getRange(targetRowIndex, colIdx + 1).setValue(updates[key]);
  }

  var updatedUser = findUserByEmail(email);
  return jsonResponse({ ok: true, data: updatedUser });
}

// Optional: helper to seed headers if missing (run manually once)
function ensureUsersHeaders() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEETS.USERS);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEETS.USERS);
  var headers = ['id','name','email','login_time','role'];
  var existing = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(function(h){ return (''+h).toString().trim(); });
  if (existing.length < headers.length || existing[0] === '') {
    sheet.clear();
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
  }
}
