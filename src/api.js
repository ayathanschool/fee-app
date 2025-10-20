// src/api.js
// --- Apps Script Web App URL ---
// In development, route through Vite proxy to avoid CORS. In production, hit GAS directly.
export const BASE_URL = import.meta.env.DEV
  ? "/gas"
  : "https://script.google.com/macros/s/AKfycbyWCzApXWxr5gr5DTYyDN8QDheGKCGbtZ-XxILuJxmeWITiK0vhGVLX1RYhUcFNTQlC/exec";
  
// Note: For dev, Vite rewrites "/gas" to the configured deployment in vite.config.js

// Your API key (must match API_KEY in Apps Script Script Properties)
// Prefer env var VITE_API_KEY; fallback to default for convenience.
const API_KEY = import.meta.env.VITE_API_KEY || "feemgr-2025";

/* -------------------- CORS-safe helpers -------------------- */
// GET: no custom headers -> simple request -> no preflight
async function getJSON(path) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, { cache: "no-store" });
    const txt = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    try {
      const j = JSON.parse(txt);
      if (!j.ok) throw new Error(j.error || "API error");
      return j.data;
    } catch (parseErr) {
      if (txt.startsWith('<!DOCTYPE') || /<html/i.test(txt)) {
        throw new Error('Apps Script returned an HTML page (likely a login/authorization page). Set your Web App access to "Anyone" and redeploy, then retry.');
      }
      const snippet = txt.slice(0, 160).replace(/\s+/g, ' ').trim();
      throw new Error(`Unexpected response while reading data: ${snippet || 'empty body'}`);
    }
  } catch (error) {
    console.error("API Error:", error);
    // Check for specific error conditions
    const errMsg = String(error.message || '').toLowerCase();
    
    if (errMsg.includes("invalid_api_key")) {
      throw new Error(
        "Invalid API key. The key in your frontend doesn't match the Apps Script. " + 
        "Either set VITE_API_KEY env var to match Script Properties API_KEY, " +
        "or call setScriptApiKey() in Apps Script to match the frontend default."
      );
    }
    
    if (errMsg.includes("failed to fetch") || errMsg.includes("networkerror")) {
      throw new Error(
        "Network error. Could not connect to Google Sheet. Check: " +
        "1) Internet connection, 2) Apps Script is deployed with 'Anyone' access, " +
        "3) Deployment ID is correct in vite.config.js."
      );
    }
    
    if (errMsg.includes("unknown_action")) {
      throw new Error(
        "Server reported unknown_action. The API endpoint exists but the requested " +
        "action is not supported. Check that client-side function names match server actions."
      );
    }
    
    throw new Error(`API Error: ${error.message}`);
  }
}

// POST: use text/plain -> simple request -> no preflight
async function postPlain(body) {
  try {
    console.log("Sending request to:", BASE_URL, "with payload:", body);
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(body),
    });
    const txt = await res.text();
    console.log("Raw API response:", txt);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    try {
      const j = JSON.parse(txt);
      if (!j.ok) throw new Error(j.error || "API error");
      return j;
    } catch (parseErr) {
      console.error("Parse error:", parseErr);
      if (txt.startsWith('<!DOCTYPE') || /<html/i.test(txt)) {
        throw new Error('Apps Script returned an HTML page (likely a login/authorization page). Set your Web App access to "Anyone" and redeploy, then retry.');
      }
      const snippet = txt.slice(0, 160).replace(/\s+/g, ' ').trim();
      throw new Error(`Unexpected response while saving: ${snippet || 'empty body'}`);
    }
  } catch (error) {
    console.error("API Error:", error);
    // Check for specific error conditions
    const errMsg = String(error.message || '').toLowerCase();
    
    if (errMsg.includes("invalid_api_key")) {
      throw new Error(
        "Invalid API key. The key in your frontend doesn't match the Apps Script. " + 
        "Either set VITE_API_KEY env var to match Script Properties API_KEY, " +
        "or call setScriptApiKey() in Apps Script to match the frontend default."
      );
    }
    
    if (errMsg.includes("failed to fetch") || errMsg.includes("networkerror")) {
      throw new Error(
        "Network error. Could not connect to Google Sheet. Check: " +
        "1) Internet connection, 2) Apps Script is deployed with 'Anyone' access, " +
        "3) Deployment ID is correct in vite.config.js, 4) Dev server is running."
      );
    }
    
    if (errMsg.includes("unknown_action")) {
      throw new Error(
        "Server reported unknown_action. The requested action is not implemented " +
        "in the Apps Script. Check if the API client is calling the correct action name."
      );
    }
    
    throw new Error(`API Error: ${error.message}`);
  }
}

/* -------------------- Public API -------------------- */
export const getStudents     = () => getJSON(`?action=students&key=${API_KEY}`);
export const getFeeHeads     = () => getJSON(`?action=feeheads&key=${API_KEY}`);
export const getTransactions = () => getJSON(`?action=transactions&key=${API_KEY}`);

// Check if a specific fee has already been paid for a student
export function checkPaymentStatus(admNo, feeHead) {
  return fetch(`${BASE_URL}?action=checkPayment&admNo=${encodeURIComponent(admNo)}&feeHead=${encodeURIComponent(feeHead)}&key=${API_KEY}`, { cache: "no-store" })
    .then(res => res.json())
    .then(data => {
      console.log("Payment status check:", data);
      return data;
    });
}

// Get comprehensive fee status for a student
export function getStudentFeeStatus(admNo) {
  return fetch(`${BASE_URL}?action=studentFeeStatus&admNo=${encodeURIComponent(admNo)}&key=${API_KEY}`, { cache: "no-store" })
    .then(res => res.json())
    .then(data => {
      console.log("Student fee status:", data);
      return data;
    });
}

export function addPaymentBatch(payload) {
  return postPlain({ action: "addPaymentBatch", key: API_KEY, ...payload })
    .then(r => {
      console.log("Payment batch response:", r);
      // Handle the response - expect a simple object with ok, receiptNo, date
      if (r && r.ok) {
        return {
          receiptNo: r.receiptNo || '',
          date: r.date || '',
          ok: true
        };
      }
      
      // Special handling for duplicate payments
      if (r?.error === 'duplicate_payment') {
        const error = new Error(`${r.message || 'These fees have already been paid'}. Please remove them and try again.`);
        error.paidItems = r.paidItems || [];
        error.isDuplicatePayment = true;
        throw error;
      }
      
      throw new Error(r?.error || "Payment failed with unknown error");
    })
    .catch(err => {
      // Make sure we're capturing all errors including network issues
      console.error("Payment batch error:", err);
      if (err.isDuplicatePayment) {
        throw err; // Re-throw the enhanced error with our custom properties
      }
      throw new Error(err.message || "Failed to process payment");
    });
}
export function voidReceipt(receiptNo) {
  return postPlain({ action: "voidReceipt", key: API_KEY, receiptNo });
}
export function unvoidReceipt(receiptNo) {
  return postPlain({ action: "unvoidReceipt", key: API_KEY, receiptNo });
}

// Get due fee notifications (legacy function)
export function getDueNotifications(classFilter = '', daysThreshold = 0) {
  return fetch(`${BASE_URL}?action=getDueNotifications&class=${encodeURIComponent(classFilter)}&threshold=${daysThreshold}&key=${API_KEY}`, { cache: "no-store" })
    .then(res => res.json())
    .then(data => {
      console.log("Due notifications (legacy):", data);
      return data;
    });
}

// Get structured due fee notifications with more details
export function getDueFeeNotifications(classFilter = '', daysThreshold = 0) {
  // Apps Script currently exposes this action as `getDueNotifications`.
  // Keep this client helper named getDueFeeNotifications for clarity but
  // call the server-side action that exists.
  return fetch(`${BASE_URL}?action=getDueNotifications&class=${encodeURIComponent(classFilter)}&threshold=${daysThreshold}&key=${API_KEY}`, { cache: "no-store" })
    .then(res => res.json())
    .then(data => {
      if (!data.ok) {
        throw new Error(data.error || 'Failed to retrieve notifications');
      }
      console.log("Due fee notifications:", data.data);
      return data.data;
    });
}

// Process bulk payments for multiple students (legacy)
export function bulkPayment(payload) {
  return postPlain({ action: "bulkPayment", key: API_KEY, ...payload })
    .then(r => {
      console.log("Bulk payment response:", r);
      if (r && r.ok) {
        return {
          results: r.results || [],
          successCount: r.successCount || 0,
          totalCount: r.totalCount || 0,
          date: r.date || '',
          ok: true
        };
      }
      
      throw new Error(r?.error || r?.message || "Bulk payment failed with unknown error");
    })
    .catch(err => {
      console.error("Bulk payment error:", err);
      throw new Error(err.message || "Failed to process bulk payments");
    });
}

// New enhanced bulk payment processor that uses the existing bulkPayment action
export function processBulkPayment(payload) {
  return postPlain({ action: "bulkPayment", key: API_KEY, ...payload })
    .then(r => {
      console.log("Enhanced bulk payment response:", r);
      if (r && r.ok) {
        return {
          receiptsGenerated: r.receiptsGenerated || 0,
          successfulPayments: r.successfulPayments || [],
          failedPayments: r.failedPayments || [],
          date: r.date || '',
          ok: true
        };
      }
      
      throw new Error(r?.error || r?.message || "Bulk payment failed with unknown error");
    })
    .catch(err => {
      console.error("Enhanced bulk payment error:", err);
      throw new Error(err.message || "Failed to process bulk payments");
    });
}

/* -------------------- Stubbed login (fixes your import) --------------------
Usage patterns supported by Login.jsx:
- login("account-2025")
- login({ code: "teacher-7A" })
- login({ username: "x", password: "principal-2025" })

Codes you can use out of the box:
- "principal-2025"  -> role: "admin"
- "account-2025"    -> role: "account"
- "teacher-<CLASS>" -> role: "teacher" (e.g., "teacher-7A", "teacher-10B")
-------------------------------------------------------------------------- */
export async function login(input) {
  // normalize different call shapes
  let code = "";
  if (typeof input === "string") code = input;
  else if (input && typeof input === "object") {
    code = input.code || input.password || "";
  }

  code = String(code || "").trim().toLowerCase();
  if (!code) throw new Error("Enter access code");

  if (code === "principal-2025") {
    return { name: "Principal", role: "admin", class: "" };
  }
  if (code === "account-2025" || code === "accounts-2025") {
    return { name: "Accounts", role: "account", class: "" };
  }
  if (code.startsWith("teacher-")) {
    const cls = code.replace("teacher-", "").toUpperCase();
    if (!cls) throw new Error("Teacher code must include class, e.g., teacher-7A");
    return { name: `Teacher ${cls}`, role: "teacher", class: cls };
  }

  // fallback
  // If input looked like an object with username/password, try server-side login
  if (input && typeof input === 'object' && (input.username || input.password)) {
    try {
      const res = await postPlain({ action: 'login', username: input.username || '', password: input.password || '', key: API_KEY });
      // Server returns top-level { ok: true, result: { name, role, class } }
      if (res && res.ok && res.result) return res.result;
      // support older nested shape too
      if (res && res.data && res.data.result) return res.data.result;
      throw new Error((res && (res.error || (res.data && res.data.error))) || 'Invalid credentials');
    } catch (err) {
      console.error('Server login failed:', err);
      // fall back to previous behavior
      throw new Error('Invalid code or server login failed');
    }
  }

  throw new Error("Invalid code");
}
