// Google Apps Script web app for Fee Collection
// Place this in a new Apps Script project bound to the spreadsheet.

const CONFIG = {
  // Default API key used as a fallback if no script property is set.
  DEFAULT_API_KEY: 'feemgr-2025', // change as needed
  SHEET_NAMES: {
    STUDENTS: 'Students',
    FEEHEADS: 'FeeHeads',
    TRANSACTIONS: 'Transactions',
    USERS: 'Users'
  }
};

// Read the API key from Script Properties for safer storage. Falls back to the
// DEFAULT_API_KEY in CONFIG when a script property is not configured.
function getApiKey() {
  try {
    const p = PropertiesService.getScriptProperties().getProperty('API_KEY');
    if (p && String(p).trim()) return String(p).trim();
  } catch (e) {
    // ignore and fall back
  }
  return CONFIG.DEFAULT_API_KEY;
}

function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = params.action;
    // Dev-only ping: allow quick health checks without API key
    if (action === 'ping') return jsonResponse({ ok: true });

    const key = params.key;
    validateKey(key);
    if (action === 'students') return jsonResponse( getSheetData(CONFIG.SHEET_NAMES.STUDENTS) );
    if (action === 'feeheads') {
      const raw = getSheetData(CONFIG.SHEET_NAMES.FEEHEADS).data;
      const data = raw.map(normalizeFeeHeadRecord)
        .filter(r => (r.class && r.feeHead));
      return jsonResponse({ ok: true, data });
    }
    if (action === 'transactions') {
      const raw = getSheetData(CONFIG.SHEET_NAMES.TRANSACTIONS).data;
      const data = raw.map(normalizeTransactionRecord);
      return jsonResponse({ ok: true, data });
    }
    if (action === 'authWrite') {
      const res = triggerWriteAuthorization();
      return jsonResponse(res);
    }
    if (action === 'users') return jsonResponse( getSheetData(CONFIG.SHEET_NAMES.USERS) );
    if (action === 'checkPayment') {
      const admNo = params.admNo;
      const feeHead = params.feeHead;
      if (!admNo || !feeHead) return jsonResponse({ ok: false, error: 'missing_parameters' });
      return jsonResponse(debugCheckPayment(admNo, feeHead));
    }
    if (action === 'studentFeeStatus') {
      const admNo = params.admNo;
      if (!admNo) return jsonResponse({ ok: false, error: 'missing_admission_number' });
      return jsonResponse(getStudentFeeStatus(admNo));
    }
    return jsonResponse({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    // Google Apps Script sends the raw POST body in e.postData.contents
    let body = {};
    try { body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}'); } catch (ex) { /* fall through */ }

  const action = body.action;
  // Dev-only ping: allow POST { action: 'ping' } without key for quick checks
  if (action === 'ping') return jsonResponse({ ok: true });

  // Determine API key: prefer body.key (sent by client), then URL parameter, then query string
  const key = (body && body.key) || (e.parameter && e.parameter.key) || (e.queryString && parseQueryString(e.queryString).key);
  validateKey(key);

    if (action === 'addPaymentBatch') return handleAddPaymentBatch(body);
    if (action === 'voidReceipt') return handleVoidReceipt(body);
    if (action === 'unvoidReceipt') return handleUnvoidReceipt(body);
    if (action === 'login') return handleLogin(body);
    if (action === 'bulkPayment') return handleBulkPayment(body);

    return jsonResponse({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

// ---------- helpers ----------
function validateKey(key) {
  const expected = getApiKey();
  if (!key || key !== expected) throw 'invalid_api_key';
}

function jsonResponse(obj) {
  // Generic sender: if caller already prepared a top-level response (ok:true/false), send it as-is.
  // If caller passed { data: [...] } (from getSheetData), convert to top-level { ok:true, data: [...] }.
  let out = obj || {};
  if (out && out.data !== undefined && (out.ok === undefined)) {
    out = { ok: true, data: out.data };
  }
  // Ensure there is an ok boolean
  if (out.ok === undefined) out.ok = true;
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { data: [] };
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return { data: [] };
  const headers = rows[0].map(h => String(h || '').trim());
  const data = rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = r[i]; });
    return obj;
  });
  return { data };
}

function parseQueryString(qs) {
  const out = {};
  qs.split('&').forEach(p=>{ const [k,v] = p.split('='); if (k) out[decodeURIComponent(k)] = decodeURIComponent((v||'').replace(/\+/g,' ')); });
  return out;
}

// Normalize Transactions rows to expected keys regardless of header casing/variants
function normalizeTransactionRecord(rec) {
  function pick(keys) {
    // try exact keys first
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (rec[k] !== undefined && rec[k] !== '') return rec[k];
    }
    // then try case-insensitive match
    var recKeys = Object.keys(rec || {});
    for (var j = 0; j < keys.length; j++) {
      var lk = String(keys[j]).toLowerCase();
      for (var r = 0; r < recKeys.length; r++) {
        if (String(recKeys[r]).toLowerCase() === lk) {
          var val = rec[recKeys[r]];
          if (val !== undefined && val !== '') return val;
        }
      }
    }
    return '';
  }
  
  // Get all the values
  const result = {
    date: pick(['date', 'Date']),
    receiptNo: pick(['receiptNo', 'ReceiptNo', 'receipt', 'Receipt']),
    admNo: pick(['admNo', 'AdmNo', 'admission', 'Admission', 'admissionNo', 'AdmissionNo']),
    name: pick(['name', 'Name', 'student', 'Student', 'studentName', 'StudentName']),
    class: pick(['class', 'Class', 'cls', 'Cls']),
    feeHead: pick(['feeHead', 'FeeHead', 'fee head', 'Fee Head', 'head', 'Head']),
    amount: pick(['amount', 'Amount']),
    fine: pick(['fine', 'Fine']),
    mode: pick(['mode', 'Mode']),
    void: pick(['void', 'Void', 'Voided'])
  };
  
  // Ensure consistent case and trimming for key fields to prevent duplicate payments
  if (result.feeHead) {
    result.feeHead = String(result.feeHead).trim();
  }
  if (result.admNo) {
    result.admNo = String(result.admNo).trim();
  }
  
  return result;
}

// Normalize FeeHeads rows to expected keys regardless of header casing/variants
function normalizeFeeHeadRecord(rec) {
  function pick(keys) {
    // exact match
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (rec[k] !== undefined && rec[k] !== '') return rec[k];
    }
    // case-insensitive
    var recKeys = Object.keys(rec || {});
    for (var j = 0; j < keys.length; j++) {
      var lk = String(keys[j]).toLowerCase();
      for (var r = 0; r < recKeys.length; r++) {
        if (String(recKeys[r]).toLowerCase() === lk) {
          var val = rec[recKeys[r]];
          if (val !== undefined && val !== '') return val;
        }
      }
    }
    return '';
  }
  var amount = pick(['amount','Amount','amt','Amt','AMOUNT']);
  var due = pick(['dueDate','DueDate','due','Due','due date','Due Date']);
  return {
    class: pick(['class','Class','cls','Cls']),
    feeHead: pick(['feeHead','FeeHead','fee head','Fee Head','head','Head']),
    amount: amount === '' ? '' : Number(amount),
    dueDate: due
  };
}

// ---------- Actions ----------
// Check if a fee head has already been paid for a student
function isFeePaid(sheet, admNo, feeHead) {
  if (!sheet || !admNo || !feeHead) return false;
  
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0].map(h => String(h || '').toLowerCase());
  const admNoCol = headers.findIndex(h => h === 'admno' || h === 'admission');
  const feeHeadCol = headers.findIndex(h => h === 'feehead' || h === 'head' || h === 'fee head');
  const voidCol = headers.findIndex(h => h === 'void' || h === 'voided');
  
  if (admNoCol < 0 || feeHeadCol < 0) return false;
  
  // Normalize inputs for case-insensitive comparison
  const normalizedAdmNo = String(admNo).trim().toLowerCase();
  const normalizedFeeHead = String(feeHead).trim().toLowerCase();
  
  for (let r = 1; r < rows.length; r++) {
    // Check if this record is for the same student, same fee head, and is not voided
    const rowAdmNo = String(rows[r][admNoCol] || '').trim().toLowerCase();
    const rowFeeHead = String(rows[r][feeHeadCol] || '').trim().toLowerCase();
    const isVoided = voidCol >= 0 && String(rows[r][voidCol] || '').toUpperCase().startsWith('Y');
    
    if (rowAdmNo === normalizedAdmNo && 
        rowFeeHead === normalizedFeeHead && 
        !isVoided) {
      return true;
    }
  }
  
  return false;
}

function handleLogin(body) {
  const username = (body.username || '').toString();
  const password = (body.password || '').toString();
  if (!username) return { ok: false, error: 'missing_username' };

  const users = getSheetData(CONFIG.SHEET_NAMES.USERS).data;
  const match = users.find(u => String(u.username || '').toLowerCase() === username.toLowerCase());
  if (!match) return { ok: false, error: 'invalid_credentials' };
  if (String(match.active || '').toUpperCase() !== 'Y') return { ok: false, error: 'account_disabled' };

  // Simple password check (plaintext). For more security, hash passwords.
  if (String(match.password || '') !== password) return { ok: false, error: 'invalid_credentials' };

  // Enhanced role-based access control with permissions
  const role = (String(match.role || '') || 'account').toLowerCase();
  let permissions = [];
  
  // Define permissions based on role
  switch(role) {
    case 'admin':
      permissions = [
        'manage_users', 'view_reports', 'manage_fees', 'manage_students',
        'collect_payments', 'view_payments', 'void_receipts', 'bulk_operations'
      ];
      break;
    case 'account':
      permissions = [
        'collect_payments', 'view_payments', 'view_reports', 'void_receipts',
        'bulk_operations'
      ];
      break;
    case 'teacher':
      permissions = ['view_class_students', 'send_reminders'];
      break;
    case 'clerk':
      permissions = ['collect_payments', 'view_payments'];
      break;
    default:
      permissions = [];
  }

  const session = { 
    name: match.name || match.username, 
    role: role, 
    class: match.class || '',
    permissions: permissions 
  };
  
  return jsonResponse({ ok: true, result: session });
}

function handleAddPaymentBatch(body) {
  // body: { date, admNo, name, cls, mode, remarks, items:[{feeHead, amount, fine, ref}], key }
  const txSheetName = CONFIG.SHEET_NAMES.TRANSACTIONS;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(txSheetName);
  if (!sheet) throw 'transactions_sheet_missing';

  // Generate next receiptNo from sheet data to avoid depending on Script Properties authorization
  const receiptNo = getNextReceiptNo(sheet);

  const now = body.date || new Date().toISOString().slice(0,10);
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return jsonResponse({ ok: false, error: 'no_items' });
  
  try {
    // Check for duplicate fee payments
    const alreadyPaidItems = [];
    for (const item of items) {
      if (isFeePaid(sheet, body.admNo, item.feeHead)) {
        alreadyPaidItems.push(item.feeHead);
      }
    }
    
    // If we found duplicate payments, return an error with details
    if (alreadyPaidItems.length > 0) {
      // Log the duplicate attempt for debugging
      console.log(`Duplicate payment attempt: Student ${body.admNo} for fees ${alreadyPaidItems.join(', ')}`);
      
      return jsonResponse({
        ok: false,
        error: 'duplicate_payment',
        message: `The following fees have already been paid: ${alreadyPaidItems.join(', ')}`,
        paidItems: alreadyPaidItems
      });
    }
    
    // Proceed with only non-duplicate items
    const rows = items.map(it => [ now, receiptNo, body.admNo, body.name, body.cls || body.class, it.feeHead, it.amount || 0, it.fine || 0, body.mode || '', '' ]);

    // Append rows
    sheet.getRange(sheet.getLastRow()+1, 1, rows.length, rows[0].length).setValues(rows);
    
    // Using the most conservative approach for return values:
    // Only simple string primitives, wrapped in jsonResponse
    return jsonResponse({ 
      ok: true, 
      receiptNo: String(receiptNo), 
      date: String(now) 
    });
  } catch (err) {
    // Detailed error handling
    return jsonResponse({ 
      ok: false, 
      error: String(err),
      message: "Error writing payment records"
    });
  }
}

// Compute next sequential receipt number by scanning the Transactions sheet
function getNextReceiptNo(sheet) {
  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return 'R00001';
  const headers = data[0].map(h => String(h||'').toLowerCase());
  const rCol = headers.findIndex(h => h === 'receiptno' || h === 'receipt' );
  let maxN = 0;
  for (let r = 1; r < data.length; r++) {
    const val = rCol >= 0 ? String(data[r][rCol] || '') : '';
    const m = /^r(\d+)$/i.exec(val.trim());
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxN) maxN = n;
    }
  }
  const next = maxN + 1;
  return 'R' + String(next).padStart(5, '0');
}

function handleVoidReceipt(body) {
  const receiptNo = body.receiptNo;
  if (!receiptNo) return { ok: false, error: 'missing_receiptNo' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRANSACTIONS);
  if (!sheet) return { ok: false, error: 'transactions_sheet_missing' };

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const receiptCol = headers.findIndex(h => String(h||'').toLowerCase() === 'receiptno');
  const voidCol = headers.findIndex(h => String(h||'').toLowerCase() === 'void');
  if (receiptCol < 0) return { ok: false, error: 'receiptNo_column_missing' };
  if (voidCol < 0) {
    // add void column
    sheet.getRange(1, sheet.getLastColumn()+1).setValue('void');
  }

  // mark matching rows
  for (let r = 1; r < rows.length; r++) {
    if (String(rows[r][receiptCol] || '') === String(receiptNo)) {
      sheet.getRange(r+1, (voidCol >= 0 ? voidCol+1 : sheet.getLastColumn())).setValue('Y');
    }
  }
  return jsonResponse({ ok: true });
}

function handleUnvoidReceipt(body) {
  const receiptNo = body.receiptNo;
  if (!receiptNo) return { ok: false, error: 'missing_receiptNo' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRANSACTIONS);
  if (!sheet) return { ok: false, error: 'transactions_sheet_missing' };

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const receiptCol = headers.findIndex(h => String(h||'').toLowerCase() === 'receiptno');
  const voidCol = headers.findIndex(h => String(h||'').toLowerCase() === 'void');
  if (receiptCol < 0 || voidCol < 0) return { ok: false, error: 'columns_missing' };

  for (let r = 1; r < rows.length; r++) {
    if (String(rows[r][receiptCol] || '') === String(receiptNo)) {
      sheet.getRange(r+1, voidCol+1).setValue('');
    }
  }
  return jsonResponse({ ok: true });
}

// ----------------------
// Utility helpers for deployment
// ----------------------
// Call this once from the Apps Script editor to set the API key in Script Properties.
// Example: setScriptApiKey('feemgr-2025')
function setScriptApiKey(key) {
  if (!key) throw 'missing_key';
  PropertiesService.getScriptProperties().setProperty('API_KEY', String(key));
  return { ok: true };
}

// Call this via GET: ?action=authWrite&key=... to trigger write scope authorization in a browser
function triggerWriteAuthorization() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRANSACTIONS);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAMES.TRANSACTIONS);
  const lastRow = sheet.getLastRow();
  sheet.appendRow(['AUTH_INIT', new Date()]);
  // optional cleanup: remove the row we just added
  const newLast = sheet.getLastRow();
  if (newLast > lastRow) sheet.deleteRow(newLast);
  
  // Check permissions and details to help diagnose issues
  const accessInfo = {
    spreadsheetName: ss.getName(),
    spreadsheetUrl: ss.getUrl(),
    transactionsSheetExists: Boolean(ss.getSheetByName(CONFIG.SHEET_NAMES.TRANSACTIONS)),
    feeHeadsSheetExists: Boolean(ss.getSheetByName(CONFIG.SHEET_NAMES.FEEHEADS)),
    studentsSheetExists: Boolean(ss.getSheetByName(CONFIG.SHEET_NAMES.STUDENTS))
  };
  
  return { 
    ok: true, 
    authorized: true,
    deploymentInfo: "Make sure this Web App is deployed with 'Execute as: Me' and 'Who has access: Anyone'",
    accessInfo: accessInfo
  };
}

// Debug function to check if a fee has been paid - can be called directly for testing
function debugCheckPayment(admNo, feeHead) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRANSACTIONS);
  if (!sheet) return { ok: false, error: 'sheet_not_found' };
  
  const isPaid = isFeePaid(sheet, admNo, feeHead);
  
  // Get all relevant records for this student/fee head for debugging
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0].map(h => String(h || '').toLowerCase());
  const admNoCol = headers.findIndex(h => h === 'admno' || h === 'admission');
  const feeHeadCol = headers.findIndex(h => h === 'feehead' || h === 'head' || h === 'fee head');
  const voidCol = headers.findIndex(h => h === 'void' || h === 'voided');
  
  const matchingRecords = [];
  const normalizedAdmNo = String(admNo).trim().toLowerCase();
  const normalizedFeeHead = String(feeHead).trim().toLowerCase();
  
  for (let r = 1; r < rows.length; r++) {
    const rowAdmNo = String(rows[r][admNoCol] || '').trim().toLowerCase();
    const rowFeeHead = String(rows[r][feeHeadCol] || '').trim().toLowerCase();
    const isVoided = voidCol >= 0 && String(rows[r][voidCol] || '').toUpperCase().startsWith('Y');
    
    if (rowAdmNo === normalizedAdmNo && rowFeeHead === normalizedFeeHead) {
      // Create a record with all relevant data
      const record = {
        index: r,
        date: rows[r][headers.indexOf('date')],
        receiptNo: rows[r][headers.indexOf('receiptno')],
        admNo: rows[r][admNoCol],
        feeHead: rows[r][feeHeadCol],
        amount: rows[r][headers.indexOf('amount')],
        isVoided: isVoided
      };
      matchingRecords.push(record);
    }
  }
  
  return {
    ok: true,
    isPaid: isPaid,
    studentId: admNo,
    feeHead: feeHead,
    normalizedStudentId: normalizedAdmNo,
    normalizedFeeHead: normalizedFeeHead,
    matchingRecords: matchingRecords,
    columnIndices: {
      admNo: admNoCol,
      feeHead: feeHeadCol,
      void: voidCol
    }
  };
}

/**
 * Get comprehensive fee payment status for a student
 * This function returns the payment status for all applicable fee heads for a student
 */
/**
 * Handle bulk payment processing for multiple students and/or fee heads
 * This function processes payments for multiple students in one operation
 */
function handleBulkPayment(body) {
  // body: { date, payments: [{ admNo, name, cls, feeHeads: [{ feeHead, amount, fine }], mode }] }
  
  // Validation
  const now = body.date || new Date().toISOString().slice(0,10);
  const payments = Array.isArray(body.payments) ? body.payments : [];
  
  if (!payments.length) {
    return jsonResponse({ 
      ok: false, 
      error: 'no_payments', 
      message: 'No payment data provided' 
    });
  }
  
  // Get transactions sheet
  const txSheetName = CONFIG.SHEET_NAMES.TRANSACTIONS;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(txSheetName);
  if (!sheet) {
    return jsonResponse({ 
      ok: false, 
      error: 'transactions_sheet_missing' 
    });
  }
  
  const results = [];
  const allRows = [];
  
  // Process each student payment
  for (const payment of payments) {
    const studentResult = {
      admNo: payment.admNo,
      name: payment.name,
      receiptNo: null,
      status: 'pending',
      errors: [],
      success: false
    };
    
    try {
      // Skip if no fee heads or invalid student info
      if (!payment.admNo || !payment.name || !Array.isArray(payment.feeHeads) || !payment.feeHeads.length) {
        studentResult.status = 'error';
        studentResult.errors.push('Invalid payment data');
        results.push(studentResult);
        continue;
      }
      
      // Check for duplicate fees
      const duplicateFees = [];
      for (const feeItem of payment.feeHeads) {
        if (isFeePaid(sheet, payment.admNo, feeItem.feeHead)) {
          duplicateFees.push(feeItem.feeHead);
        }
      }
      
      if (duplicateFees.length > 0) {
        studentResult.status = 'duplicate';
        studentResult.errors.push(`Already paid: ${duplicateFees.join(', ')}`);
        results.push(studentResult);
        continue;
      }
      
      // Generate receipt number
      const receiptNo = getNextReceiptNo(sheet);
      studentResult.receiptNo = receiptNo;
      
      // Create rows for this student's payment
      const rows = payment.feeHeads.map(feeItem => [
        now,
        receiptNo,
        payment.admNo,
        payment.name,
        payment.cls || payment.class,
        feeItem.feeHead,
        feeItem.amount || 0,
        feeItem.fine || 0,
        payment.mode || 'Cash',
        ''
      ]);
      
      // Add rows to the batch
      allRows.push(...rows);
      
      // Mark as successful
      studentResult.status = 'success';
      studentResult.success = true;
    } catch (err) {
      studentResult.status = 'error';
      studentResult.errors.push(String(err));
    }
    
    results.push(studentResult);
  }
  
  // Process all rows in batch if we have any
  try {
    if (allRows.length > 0) {
      sheet.getRange(sheet.getLastRow()+1, 1, allRows.length, allRows[0].length)
        .setValues(allRows);
    }
    
    return jsonResponse({
      ok: true,
      results: results,
      successCount: results.filter(r => r.success).length,
      totalCount: results.length,
      date: now
    });
  } catch (err) {
    return jsonResponse({
      ok: false,
      error: String(err),
      message: "Error writing bulk payment records",
      partialResults: results
    });
  }
}

function getStudentFeeStatus(admNo) {
  // Validate input
  if (!admNo) return { ok: false, error: 'missing_admission_number' };
  
  // Get student details
  const students = getSheetData(CONFIG.SHEET_NAMES.STUDENTS).data;
  const student = students.find(s => String(s.admNo || '').trim().toLowerCase() === String(admNo).trim().toLowerCase());
  if (!student) return { ok: false, error: 'student_not_found' };
  
  // Get fee structure for the student's class
  const feeHeads = getSheetData(CONFIG.SHEET_NAMES.FEEHEADS).data
    .map(normalizeFeeHeadRecord)
    .filter(f => String(f.class).trim().toLowerCase() === String(student.class).trim().toLowerCase());
  
  // Get transactions for this student
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const txSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRANSACTIONS);
  if (!txSheet) return { ok: false, error: 'transactions_sheet_not_found' };
  
  const transactions = getSheetData(CONFIG.SHEET_NAMES.TRANSACTIONS).data
    .map(normalizeTransactionRecord)
    .filter(t => {
      return String(t.admNo).trim().toLowerCase() === String(admNo).trim().toLowerCase() && 
             !String(t.void || '').toUpperCase().startsWith('Y');
    });
  
  // Check paid status for each fee head
  const feeStatus = feeHeads.map(fee => {
    const paid = isFeePaid(txSheet, admNo, fee.feeHead);
    
    const paymentDetails = paid ? transactions.find(t => 
      String(t.feeHead).trim().toLowerCase() === String(fee.feeHead).trim().toLowerCase()
    ) : null;
    
    return {
      feeHead: fee.feeHead,
      amount: fee.amount,
      dueDate: fee.dueDate,
      paid,
      paymentDate: paid && paymentDetails ? paymentDetails.date : null,
      receiptNo: paid && paymentDetails ? paymentDetails.receiptNo : null
    };
  });
  
  // Also include any payments made that are not in the fee structure
  // (e.g., for special fees or fees from another class)
  const extraPayments = transactions.filter(t => {
    return !feeStatus.some(f => 
      String(f.feeHead).trim().toLowerCase() === String(t.feeHead).trim().toLowerCase()
    );
  }).map(t => ({
    feeHead: t.feeHead,
    amount: Number(t.amount) || 0,
    dueDate: null,
    paid: true,
    paymentDate: t.date,
    receiptNo: t.receiptNo
  }));
  
  // Calculate summary statistics
  const totalDue = feeStatus.filter(f => !f.paid).reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
  const totalPaid = [
    ...feeStatus.filter(f => f.paid), 
    ...extraPayments
  ].reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
  
  // Calculate fine amounts if applicable
  const totalFine = transactions.reduce((sum, t) => sum + (Number(t.fine) || 0), 0);
  
  return {
    ok: true,
    student: {
      admNo: student.admNo,
      name: student.name,
      class: student.class
    },
    feeStatus: [...feeStatus, ...extraPayments],
    summary: {
      totalDue,
      totalPaid,
      totalFine,
      totalPayments: transactions.length,
      paymentComplete: feeStatus.every(f => f.paid),
      grandTotal: totalDue + totalFine
    }
  };
}
