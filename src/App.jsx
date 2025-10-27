import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, History, CreditCard, CheckCircle, User, Calendar, XCircle,
  BarChart3, Filter, Download, RefreshCcw, FileSearch, Bell, Users
} from 'lucide-react';
import ReceiptModal from './components/ReceiptModal';
import StudentFeeStatus from './components/StudentFeeStatus';
import BulkPaymentForm from './components/BulkPaymentForm';
import ReportsTab from './components/ReportsTab';
import Login from './Login';
import {
  getStudents, getFeeHeads, getTransactions,
  addPaymentBatch, voidReceipt, unvoidReceipt,
  checkPaymentStatus, getStudentFeeStatus
} from './api';

// ---------- helpers ----------
const inr = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const ckey = (v) => String(v ?? '').replace(/\s+/g, '').toLowerCase();

function indianFY(today = new Date()) {
  const y = today.getFullYear();
  const fyStart = new Date(today);
  if (today.getMonth() + 1 >= 4) fyStart.setFullYear(y, 3, 1);
  else fyStart.setFullYear(y - 1, 3, 1);
  const fyEnd = new Date(fyStart);
  fyEnd.setFullYear(fyStart.getFullYear() + 1, 2, 31);
  return { start: fyStart, end: fyEnd };
}

const fmtYMD = (d) => d instanceof Date ? d.toISOString().slice(0,10) : '';

// Format date for display in IST timezone
const fmtDateIST = (dateStr) => {
  if (!dateStr) return '-';
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date)) return dateStr;
    
    // Format as DD-MM-YYYY for Indian date format
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    });
  } catch (err) {
    return dateStr;
  }
};

const cleanPhone = (p) => {
  const digits = String(p || '').replace(/[^\d]/g, '');
  if (digits.startsWith('91')) return digits;
  if (digits.length === 10) return '91' + digits;
  return digits || '';
};
const parseYMD = (s) => {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T00:00:00');
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    return new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
};

// ---------- App ----------
export default function App() {
  const [activeTab, setActiveTab] = useState('payment');

  // session / role
  const [session, setSession] = useState(() => {
    const s = localStorage.getItem('session');
    return s ? JSON.parse(s) : null;
  });
  const [role, setRole] = useState('account');
  const [teacherClass, setTeacherClass] = useState('');

  useEffect(() => {
    if (session) {
      setRole(session.role || 'account');
      setTeacherClass(session.class || '');
      if ((session.role || '').toLowerCase() === 'teacher') {
        setActiveTab('reminders');
      }
    }
  }, [session]);

  // data
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [feeheads, setFeeheads] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [savedNotice, setSavedNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [paymentForm, setPaymentForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    admNo: '', name: '', cls: '', phone: '', mode: 'Cash'
  });
  const [studentSuggestions, setStudentSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedFeeHeads, setSelectedFeeHeads] = useState([]);
  const [receipt, setReceipt] = useState(null);

  // initial load
  useEffect(() => {
    (async () => {
      try {
        const [s, f, t] = await Promise.all([getStudents(), getFeeHeads(), getTransactions()]);
        setStudents(s);
        setFeeheads(f);
        setPayments(t);
      } catch (err) {
        console.error("Data loading error:", err);
        alert('Failed to load data: ' + err.message);
      }
    })();
  }, []);

  // ---------- Payment tab logic ----------
  const handleSearch = (v) => {
    setPaymentForm(p => ({ ...p, admNo: v }));
    const q = String(v).trim().toLowerCase();
    if (!q) return setShowSuggestions(false);
    const list = students
      .filter(s => !teacherClass || ckey(s.cls || s.class) === ckey(teacherClass))
      .filter(s =>
        String(s.admNo).toLowerCase().includes(q) ||
        String(s.name || s.studentName).toLowerCase().startsWith(q)
      )
      .slice(0, 12);
    setStudentSuggestions(list);
    setShowSuggestions(true);
  };

  // paid heads for this student -> { feeHead: lastPaidDate }
  const paidIndex = useMemo(() => {
    if (!paymentForm.admNo) return {};
    const idx = {};
    
    // Log to help diagnose issues
    console.log(`Building paidIndex for student ${paymentForm.admNo}. Total payments: ${payments.length}`);
    
    // Process all payments to find already paid fee heads for this student
    payments.forEach(p => {
      // Case-insensitive comparison with trimming to be thorough
      const same = String(p.admNo).trim().toLowerCase() === String(paymentForm.admNo).trim().toLowerCase();
      const notVoided = !String(p.void || '').toUpperCase().startsWith('Y');
      
      if (same && notVoided) {
        // Get the normalized fee head name
        const fh = String(p.feeHead).trim();
        console.log(`Found payment for student ${paymentForm.admNo}, feeHead: "${fh}", date: ${p.date}, receipt: ${p.receiptNo}`);
        
        // Only update if this is a newer payment or we don't have one yet
        if (!idx[fh] || new Date(p.date) > new Date(idx[fh])) {
          idx[fh] = p.date;
          // Store receipt number with the date for reference
          idx[`${fh}_receipt`] = p.receiptNo || '';
        }
      }
    });
    
    // Log the final result
    console.log("Paid index for current student:", idx);
    return idx;
  }, [payments, paymentForm.admNo]);

  const calcFine = (dueDate, payDate) => {
    if (!dueDate) return 0;
    const MS = 24 * 60 * 60 * 1000;
    const due = new Date(dueDate);
    const pay = new Date(payDate);
    if (isNaN(due) || isNaN(pay) || pay <= due) return 0;
    const daysLate = Math.ceil((pay - due) / MS);
    const buckets = Math.ceil(daysLate / 15); // every 15 days -> ₹25
    return buckets * 25;
  };

  const selectStudent = (s) => {
    const cls = s.cls || s.class;
    // First update the payment form
    setPaymentForm(p => ({
      ...p,
      admNo: s.admNo,
      name: s.name || s.studentName,
      cls,
      phone: s.phone || s.mobile || ''
    }));
    setShowSuggestions(false);
    
    // Then, we need to explicitly wait for paidIndex to update
    // Look for paid fees for this student in the transaction records
    const currentPaidIndex = {};
    payments.forEach(p => {
      const same = String(p.admNo).trim().toLowerCase() === String(s.admNo).trim().toLowerCase();
      const notVoided = !String(p.void || '').toUpperCase().startsWith('Y');
      
      if (same && notVoided) {
        // Get the normalized fee head name
        const fh = String(p.feeHead).trim();
        console.log(`Found payment for selected student ${s.admNo}, feeHead: "${fh}", date: ${p.date}, receipt: ${p.receiptNo}`);
        
        // Only update if this is a newer payment or we don't have one yet
        if (!currentPaidIndex[fh] || new Date(p.date) > new Date(currentPaidIndex[fh])) {
          currentPaidIndex[fh] = p.date;
          currentPaidIndex[`${fh}_receipt`] = p.receiptNo || '';
        }
      }
    });
    
    console.log("Current student paid index:", currentPaidIndex);

    // Generate the fee heads list with paid status
    const heads = feeheads
      .filter(f => ckey(f.class) === ckey(cls))
      .map(f => {
        const feeHeadKey = String(f.feeHead).trim();
        // Check if this fee is already paid
        const isPaid = Object.keys(currentPaidIndex).includes(feeHeadKey);
        return {
          feeHead: f.feeHead,
          amount: f.amount,
          fine: calcFine(f.dueDate, paymentForm.date),
          dueDate: f.dueDate,
          selected: false,
          waiveFine: false,
          manualFine: false,
          paidDate: isPaid ? currentPaidIndex[feeHeadKey] : null,
          receiptNo: isPaid ? currentPaidIndex[`${feeHeadKey}_receipt`] : null
        };
      });
    setSelectedFeeHeads(heads);
    
    // For each fee head, make a server-side check to verify payment status
    // This ensures we have the most accurate data about which fees are paid
    Promise.all(heads.map(async (head) => {
      try {
        const status = await checkPaymentStatus(s.admNo, head.feeHead);
        if (status.ok && status.isPaid) {
          console.log(`Server confirms ${head.feeHead} is already paid for ${s.admNo}`);
          return {
            ...head,
            paidDate: status.matchingRecords?.[0]?.date || new Date().toISOString().slice(0, 10),
            receiptNo: status.matchingRecords?.[0]?.receiptNo || "Previously paid",
            isPaidConfirmed: true
          };
        }
        return head;
      } catch (err) {
        console.error(`Failed to check payment status for ${head.feeHead}:`, err);
        return head;
      }
    })).then(updatedHeads => {
      console.log("Updated fee heads with server-confirmed payment status:", updatedHeads);
      setSelectedFeeHeads(updatedHeads);
    });
  };

  // recalc fines on date change (unless manually edited / waived)
  useEffect(() => {
    if (!paymentForm.admNo) return;
    setSelectedFeeHeads(prev => prev.map(f => {
      if (f.waiveFine || f.manualFine) return f;
      return { ...f, fine: calcFine(f.dueDate, paymentForm.date) };
    }));
  }, [paymentForm.date]); // eslint-disable-line

  const toggleFeeHeadSelection = (i) =>
    setSelectedFeeHeads(prev => prev.map((f, idx) => {
      if (idx !== i) return f;
      if (f.paidDate) return f; // cannot select paid
      return { ...f, selected: !f.selected };
    }));

  const updateFeeHeadAmount = (i, val) =>
    setSelectedFeeHeads(prev => prev.map((f, idx) => idx===i ? ({ ...f, amount: val }) : f));

  const toggleFineWaiver = (i) =>
    setSelectedFeeHeads(prev => prev.map((f, idx) =>
      idx===i ? ({ ...f, waiveFine: !f.waiveFine, manualFine: false, fine: !f.waiveFine ? 0 : calcFine(f.dueDate, paymentForm.date) }) : f
    ));

  const updateFeeHeadFine = (i, val) =>
    setSelectedFeeHeads(prev => prev.map((f, idx) =>
      idx === i ? ({ ...f, fine: Number(val) || 0, manualFine: true, waiveFine: false }) : f
    ));

  const resetFine = (i) =>
    setSelectedFeeHeads(prev => prev.map((f, idx) =>
      idx === i ? ({ ...f, fine: calcFine(f.dueDate, paymentForm.date), manualFine: false, waiveFine: false }) : f
    ));

  const totalSelected = useMemo(() =>
    selectedFeeHeads.filter(f => !f.paidDate && f.selected)
      .reduce((s,f) => s + Number(f.amount||0) + (f.waiveFine?0:Number(f.fine||0)), 0),
    [selectedFeeHeads]
  );

  async function handleSubmit(e) {
    if (e?.preventDefault) e.preventDefault();
    const chosen = selectedFeeHeads.filter(f => f.selected && !f.paidDate);
    if (!paymentForm.admNo || !chosen.length) {
      alert('Select a student and at least one fee head');
      return;
    }
    setIsSaving(true);
    const items = chosen.map(f => ({
      feeHead: f.feeHead,
      amount: f.amount,
      fine: f.waiveFine ? 0 : f.fine,
      ref: ''
    }));
    
    console.log("Payment form data:", paymentForm);
    console.log("Selected items:", items);
    
    // First, try saving. If this fails, show error and stop.
    let resp;
    try {
      const payload = {
        date: paymentForm.date,
        admNo: paymentForm.admNo,
        name: paymentForm.name,
        cls: paymentForm.cls,
        mode: paymentForm.mode || 'Cash',
        remarks: '',
        items
      };
      console.log("Sending payment payload:", payload);
      resp = await addPaymentBatch(payload);
      console.log("Payment response:", resp);
    } catch (err) {
      console.error("Payment error:", err);
      setIsSaving(false);
      
      // Check if we need to refresh the payments data (for duplicate payment cases)
      if (err.isDuplicatePayment || (err.message && err.message.includes('already been paid'))) {
        console.log('Duplicate payment detected:', err);
        
        try {
          // Refresh transactions to get the latest payment data
          const t = await getTransactions();
          setPayments(t);
          
          // Update the selected fee heads to mark the paid ones
          if (err.paidItems && Array.isArray(err.paidItems)) {
            setSelectedFeeHeads(prev => prev.map(fee => {
              if (err.paidItems.includes(fee.feeHead)) {
                // Mark this fee head as already paid
                return {
                  ...fee,
                  paidDate: new Date().toISOString().slice(0, 10), // Today's date as placeholder
                  selected: false, // Deselect it
                  receiptNo: 'Previously paid' // Placeholder
                };
              }
              return fee;
            }));
          }
          
          // Re-select the student to update the fee heads list
          const currentStudent = students.find(s => String(s.admNo) === String(paymentForm.admNo));
          if (currentStudent) {
            selectStudent(currentStudent);
          }
        } catch (refreshErr) {
          console.warn('Failed to refresh data after duplicate payment:', refreshErr);
        }
      }
      
      alert('Save failed: ' + err.message);
      return;
    }

    // Show success immediately
    setSavedNotice(`Payment recorded — Receipt #${resp.receiptNo}`);
    setTimeout(() => setSavedNotice(''), 4000);
    setReceipt({
      receiptNo: resp.receiptNo,
      date: resp.date,
      student: { admNo: paymentForm.admNo, name: paymentForm.name, cls: paymentForm.cls, phone: paymentForm.phone || '' },
      items, mode: paymentForm.mode, remarks: ''
    });

    // Try to refresh transactions, but do not treat failures as save failure
    try {
      const t = await getTransactions();
      setPayments(t);
      
      // Update the paid status of the selected fee heads based on what we just saved
      setSelectedFeeHeads(prev => prev.map(fee => {
        const justPaid = items.some(item => item.feeHead === fee.feeHead);
        if (justPaid) {
          return {
            ...fee,
            paidDate: resp.date,
            receiptNo: resp.receiptNo,
            selected: false // Deselect it since it's now paid
          };
        }
        return fee;
      }));
      
    } catch (err) {
      console.warn('Refresh transactions failed after save:', err);
    }

    // Don't reset the form immediately to allow the user to see the updated paid status
    // But do clear selection and mark as not saving
    setIsSaving(false);
    
    // Reset form after a short delay to show the user their payment was successful
    setTimeout(() => {
      setSelectedFeeHeads([]);
      setPaymentForm(p => ({ ...p, admNo: '', name: '', cls: '', phone: '' }));
    }, 2000);
  }

  async function onVoid(receiptNo) {
    if (!window.confirm(`Void receipt #${receiptNo}? This will exclude it from totals.`)) return;
    await voidReceipt(receiptNo);
    const t = await getTransactions(); setPayments(t);
    setSavedNotice(`Receipt #${receiptNo} voided`); setTimeout(() => setSavedNotice(''), 3000);
  }

  async function onUnvoid(receiptNo) {
    await unvoidReceipt(receiptNo);
    const t = await getTransactions(); setPayments(t);
    setSavedNotice(`Receipt #${receiptNo} restored`); setTimeout(() => setSavedNotice(''), 3000);
  }

  // search & totals (ignore void)
  const filteredPayments = payments.filter(p =>
    String(p.admNo).toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(p.name).toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(p.cls||p.class).toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(p.feeHead).toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(p.receiptNo||'').toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalCollected = payments
    .filter(p => !String(p.void||'').toUpperCase().startsWith('Y'))
    .reduce((s,p) => s + Number(p.amount||0) + Number(p.fine||0), 0);

  // ---------- Reports ----------
  const classes = useMemo(() => {
    const set = new Set(students.map(s => s.cls || s.class).filter(Boolean).map(String));
    return Array.from(set).sort((a,b)=>String(a).localeCompare(String(b)));
  }, [students]);

  const feeHeadsByClass = useMemo(() => {
    const m = new Map();
    feeheads.forEach(f => {
      const c = String(f.class || '').trim();
      if (!m.has(c)) m.set(c, new Set());
      m.get(c).add(String(f.feeHead));
    });
    const out = {};
    Array.from(m.entries()).forEach(([c, set]) => out[c] = Array.from(set).sort());
    out['All'] = Array.from(new Set(feeheads.map(f => String(f.feeHead)))).sort();
    return out;
  }, [feeheads]);

  const today = new Date();
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const { start: fyStart, end: fyEnd } = indianFY(today);

  const [repQuick, setRepQuick] = useState('month'); // today|week|month|fy|custom
  const [repFrom, setRepFrom] = useState(fmtYMD(thisMonthStart));
  const [repTo, setRepTo] = useState(fmtYMD(today));
  const [repClass, setRepClass] = useState('All');
  const [repHead, setRepHead] = useState('All');
  const [repMode, setRepMode] = useState('All');
  const [repStatus, setRepStatus] = useState('Valid'); // Valid|Voided|All
  const [repIncludeFine, setRepIncludeFine] = useState(true);
  const [repMin, setRepMin] = useState('');
  const [repMax, setRepMax] = useState('');
  const [repSearch, setRepSearch] = useState('');
  const [repGroupBy, setRepGroupBy] = useState('none'); // none|class|feeHead|mode|day|month|student

  useEffect(() => {
    const t = new Date();
    if (repQuick === 'today') {
      setRepFrom(fmtYMD(t)); setRepTo(fmtYMD(t));
    } else if (repQuick === 'week') {
      const d = new Date(t);
      const day = d.getDay() || 7; d.setDate(d.getDate() - (day - 1));
      setRepFrom(fmtYMD(d)); setRepTo(fmtYMD(t));
    } else if (repQuick === 'month') {
      const m0 = new Date(t.getFullYear(), t.getMonth(), 1);
      setRepFrom(fmtYMD(m0)); setRepTo(fmtYMD(t));
    } else if (repQuick === 'fy') {
      setRepFrom(fmtYMD(fyStart)); setRepTo(fmtYMD(fyEnd));
    }
  }, [repQuick]); // eslint-disable-line

  useEffect(() => {
    if (role === 'teacher' && teacherClass) setRepClass(teacherClass);
  }, [role, teacherClass]);

  const allModes = useMemo(() => {
    const set = new Set(payments.map(p => String(p.mode || '').trim()).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [payments]);

  const reportRows = useMemo(() => {
    let rows = payments.map(p => ({
      ...p,
      cls: p.cls || p.class,
      dateObj: parseYMD(p.date)
    }));
    if (repStatus === 'Valid') rows = rows.filter(r => !String(r.void||'').toUpperCase().startsWith('Y'));
    else if (repStatus === 'Voided') rows = rows.filter(r => String(r.void||'').toUpperCase().startsWith('Y'));
    if (role === 'teacher' && teacherClass) rows = rows.filter(r => ckey(r.cls) === ckey(teacherClass));
    const from = parseYMD(repFrom); const to = parseYMD(repTo);
    if (from) rows = rows.filter(r => r.dateObj && r.dateObj >= from);
    if (to) { const end = new Date(to); end.setHours(23,59,59,999); rows = rows.filter(r => r.dateObj && r.dateObj <= end); }
    if (repClass !== 'All') rows = rows.filter(r => ckey(r.cls) === ckey(repClass));
    if (repHead !== 'All') rows = rows.filter(r => String(r.feeHead) === String(repHead));
    if (repMode !== 'All') rows = rows.filter(r => String(r.mode) === String(repMode));
    if (repSearch.trim()) {
      const q = repSearch.trim().toLowerCase();
      rows = rows.filter(r =>
        String(r.admNo).toLowerCase().includes(q) ||
        String(r.name).toLowerCase().includes(q) ||
        String(r.receiptNo||'').toLowerCase().includes(q)
      );
    }
    if (repMin !== '') rows = rows.filter(r => Number(r.amount||0) + (repIncludeFine ? Number(r.fine||0) : 0) >= Number(repMin));
    if (repMax !== '') rows = rows.filter(r => Number(r.amount||0) + (repIncludeFine ? Number(r.fine||0) : 0) <= Number(repMax));
    return rows;
  }, [payments, repStatus, role, teacherClass, repFrom, repTo, repClass, repHead, repMode, repSearch, repMin, repMax, repIncludeFine]);

  const repSummary = useMemo(() => {
    const grossAmt = reportRows.reduce((s,r) => s + Number(r.amount||0), 0);
    const fineAmt = reportRows.reduce((s,r) => s + Number(r.fine||0), 0);
    const included = repIncludeFine ? grossAmt + fineAmt : grossAmt;
    const voidCount = reportRows.filter(r => String(r.void||'').toUpperCase().startsWith('Y')).length;
    const count = reportRows.length;
    return { grossAmt, fineAmt, included, voidCount, count };
  }, [reportRows, repIncludeFine]);

  const groupKey = (r) => {
    switch (repGroupBy) {
      case 'class': return r.cls || '-';
      case 'feeHead': return r.feeHead || '-';
      case 'mode': return r.mode || '-';
      case 'day': return r.date || '-';
      case 'month': {
        const d = r.dateObj; if (!d) return '-';
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      }
      case 'student': return `${r.name || ''} (${r.admNo || ''})`;
      default: return 'ALL';
    }
  };

  const grouped = useMemo(() => {
    if (repGroupBy === 'none') return null;
    const m = new Map();
    reportRows.forEach(r => {
      const k = groupKey(r);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    });
    const arr = Array.from(m.entries()).map(([k, rows]) => {
      const gross = rows.reduce((s,r)=> s + Number(r.amount||0), 0);
      const fine  = rows.reduce((s,r)=> s + Number(r.fine||0), 0);
      const total = repIncludeFine ? gross + fine : gross;
      const receipts = rows.length;
      return { key: k, gross, fine, total, receipts };
    });
    arr.sort((a,b)=> b.total - a.total);
    return arr;
  }, [reportRows, repGroupBy, repIncludeFine]);

  const downloadCSV = (rows) => {
    const header = ['Date','Receipt','AdmNo','Name','Class','FeeHead','Amount','Fine','Total','Mode','Voided'];
    const lines = [header.join(',')].concat(rows.map(r => {
      const total = Number(r.amount||0) + (repIncludeFine ? Number(r.fine||0) : 0);
      const v = String(r.void||'').toUpperCase().startsWith('Y') ? 'Y' : '';
      return [
        r.date, r.receiptNo || '', r.admNo, `"${(r.name||'').replace(/"/g,'""')}"`,
        r.cls || '', `"${String(r.feeHead||'').replace(/"/g,'""')}"`,
        r.amount||0, r.fine||0, total, r.mode||'', v
      ].join(',');
    }));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'report-detailed.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const downloadGroupedCSV = () => {
    if (!grouped) { alert('Choose a Group By first'); return; }
    const header = ['Group','Receipts','Gross','Fine','Total'];
    const lines = [header.join(',')].concat(grouped.map(g =>
      [ `"${String(g.key).replace(/"/g,'""')}"`, g.receipts, g.gross, g.fine, g.total ].join(',')
    ));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'report-grouped.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setRepQuick('month');
    setRepClass('All'); setRepHead('All'); setRepMode('All');
    setRepStatus('Valid'); setRepIncludeFine(true);
    setRepMin(''); setRepMax(''); setRepSearch('');
    const m0 = new Date(today.getFullYear(), today.getMonth(), 1);
    setRepFrom(fmtYMD(m0)); setRepTo(fmtYMD(today));
    setRepGroupBy('none');
  };

  // ---------- UI ----------

  // ---- show login if not authenticated (AFTER all hooks above) ----
  if (!session) {
    return (
      <Login
        onSuccess={(data) => {
          localStorage.setItem('session', JSON.stringify(data));
          setSession(data);
        }}
      />
    );
  }

  // Force teachers to only see the reminders tab
  if (role === 'teacher' && activeTab !== 'reminders') {
    setActiveTab('reminders');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-xl font-bold text-gray-900">Fee Collection System</h1>
            <button
              onClick={() => { localStorage.removeItem('session'); setSession(null); }}
              className="text-sm text-gray-600 hover:underline"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-6 overflow-x-auto">
            {role !== 'teacher' && (
              <>
                <button onClick={()=>setActiveTab('payment')} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab==='payment'?'border-blue-500 text-blue-600':'border-transparent text-gray-500'}`}>
                  <CreditCard className="w-4 h-4 inline mr-1" /> Payment
                </button>
                <button onClick={()=>setActiveTab('transactions')} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab==='transactions'?'border-blue-500 text-blue-600':'border-transparent text-gray-500'}`}>
                  <History className="w-4 h-4 inline mr-1" /> Transactions
                </button>
                <button onClick={()=>setActiveTab('feestatus')} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab==='feestatus'?'border-blue-500 text-blue-600':'border-transparent text-gray-500'}`}>
                  <FileSearch className="w-4 h-4 inline mr-1" /> Fee Status
                </button>
              </>
            )}
            <button onClick={()=>setActiveTab('reminders')} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab==='reminders'?'border-blue-500 text-blue-600':'border-transparent text-gray-500'}`}>
              <Bell className="w-4 h-4 inline mr-1" /> Reminders
            </button>
            {role !== 'teacher' && (
              <button onClick={()=>setActiveTab('reports')} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab==='reports'?'border-blue-500 text-blue-600':'border-transparent text-gray-500'}`}>
                <BarChart3 className="w-4 h-4 inline mr-1" /> Reports
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {savedNotice && (
          <div className="mb-4 rounded-md bg-green-50 border border-green-200 text-green-800 px-3 py-2 text-sm">
            {savedNotice}
          </div>
        )}

        {/* ---------------- Payment ---------------- */}
        {activeTab==='payment' && (
          <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
              <h2 className="text-2xl font-bold flex items-center"><CreditCard className="mr-2" /> Fee Payment</h2>
              <p className="opacity-90">Collect fees quickly and efficiently</p>
            </div>

            <form className="p-6 space-y-4" onSubmit={e=>e.preventDefault()}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input type="date" value={paymentForm.date}
                      onChange={e=>setPaymentForm(p=>({...p, date: e.target.value}))}
                      className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500" required />
                    <Calendar className="absolute right-3 top-3 text-gray-400 w-5 h-5" />
                  </div>
                  <button type="button"
                    onClick={()=>setPaymentForm(p=>({...p, date: new Date().toISOString().slice(0,10)}))}
                    className="px-3 py-2 border rounded text-sm hover:bg-gray-50">Today</button>
                </div>
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Admission Number / Student Name</label>
                <div className="relative">
                  <input type="text" value={paymentForm.admNo}
                    onChange={e=>handleSearch(e.target.value)}
                    placeholder="Enter admission number or name"
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500" required />
                  <User className="absolute right-3 top-3 text-gray-400 w-5 h-5" />
                </div>
                {showSuggestions && studentSuggestions.length>0 && (
                  <div className="absolute z-10 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                    {studentSuggestions.map(s => (
                      <div key={s.admNo} onClick={()=>selectStudent(s)} className="px-4 py-2 hover:bg-blue-50 cursor-pointer flex justify-between">
                        <span className="font-medium">{s.name || s.studentName}</span>
                        <span className="text-sm text-gray-500">{s.admNo}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student Name</label>
                <input type="text" value={paymentForm.name} readOnly className="w-full px-4 py-3 border rounded-lg bg-gray-50" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <input type="text" value={paymentForm.cls} readOnly className="w-full px-4 py-3 border rounded-lg bg-gray-50" />
              </div>

              {selectedFeeHeads.length>0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="block text-sm font-medium text-gray-700">Select Fee Heads</span>
                    {selectedFeeHeads.some(f => f.paidDate) && (
                      <span className="text-xs text-gray-500">Fees already paid are marked with a green checkmark</span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {selectedFeeHeads.map((fee, i) => (
                      <div key={i} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <label className="flex items-center">
                            {fee.paidDate || fee.isPaidConfirmed ? (
                              <>
                                <CheckCircle className="text-green-600 w-5 h-5 mr-2" />
                                <span className="font-medium text-gray-900">{fee.feeHead}</span>
                                <span className="ml-2 inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs">
                                  Paid {fee.paidDate ? new Date(fee.paidDate).toLocaleDateString() : "previously"}
                                  {fee.receiptNo && ` (Receipt ${fee.receiptNo})`}
                                </span>
                              </>
                            ) : (
                              <>
                                <input type="checkbox" checked={fee.selected} onChange={()=>toggleFeeHeadSelection(i)} className="h-5 w-5 text-blue-600 rounded mr-2" />
                                <span className="font-medium text-gray-900">{fee.feeHead}</span>
                              </>
                            )}
                          </label>
                          <div className="text-right">
                            <div className="text-sm text-gray-500">₹{inr(fee.amount)}</div>
                            <div className="text-xs text-gray-400">Due: {fee.dueDate ? new Date(fee.dueDate).toLocaleDateString() : '-'}</div>
                          </div>
                        </div>
                        {(!fee.paidDate && fee.selected) && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Amount</label>
                              <input type="number" inputMode="numeric" pattern="[0-9]*"
                                value={fee.amount} onChange={e=>updateFeeHeadAmount(i, e.target.value)}
                                className="w-full px-3 py-2 border rounded-md text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Fine (editable)</label>
                              <input
                                type="number"
                                value={fee.fine}
                                onChange={e => updateFeeHeadFine(i, e.target.value)}
                                className="w-full px-3 py-2 border rounded-md text-sm"
                              />
                              <div className="flex gap-2 mt-1">
                                <button type="button" onClick={() => resetFine(i)} className="text-xs text-indigo-600">Recalc</button>
                                <button type="button" onClick={() => toggleFineWaiver(i)} className="text-xs text-gray-600">
                                  {fee.waiveFine ? 'Unwaive' : 'Waive'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedFeeHeads.some(f=>!f.paidDate && f.selected) && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Amount:</span>
                    <span className="text-xl font-bold text-blue-600">₹{inr(totalSelected)}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                <select value={paymentForm.mode} onChange={e=>setPaymentForm(p=>({...p, mode:e.target.value}))} className="w-full px-4 py-3 border rounded-lg">
                  <option>Cash</option><option>UPI</option><option>Bank</option><option>Card</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={isSaving || !selectedFeeHeads.some(f => !f.paidDate && f.selected)}
              >
                {isSaving ? 'Saving…' : (<><CheckCircle className="inline w-4 h-4 mr-1" /> Record Payment</>)}
              </button>
            </form>
          </div>
        )}

        {/* ---------------- Transactions ---------------- */}
        {activeTab==='transactions' && (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search by name, class, fee head, receipt..." className="w-full pl-10 pr-3 py-2 border rounded-md" />
              </div>
              <div className="text-sm text-gray-600">Collected: ₹{inr(totalCollected)}</div>
            </div>

            <div className="overflow-x-auto mt-3">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Date</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Receipt</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Student</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Class</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Fee Head</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Amount</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Mode</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPayments.map((p, i) => {
                    const isVoid = String(p.void||'').toUpperCase().startsWith('Y');
                    return (
                      <tr key={i} className={`hover:bg-gray-50 ${isVoid ? 'opacity-60' : ''}`}>
                        <td className="px-3 py-2 text-sm">{p.date}</td>
                        <td className="px-3 py-2 text-sm">{p.receiptNo}</td>
                        <td className="px-3 py-2 text-sm">{p.name}</td>
                        <td className="px-3 py-2 text-sm">{p.cls || p.class}</td>
                        <td className="px-3 py-2 text-sm">{p.feeHead}</td>
                        <td className="px-3 py-2 text-sm">₹{inr(Number(p.amount||0)+Number(p.fine||0))}</td>
                        <td className="px-3 py-2 text-sm">{p.mode}</td>
                        <td className="px-3 py-2 text-sm">
                          {!isVoid ? (
                            <button onClick={()=>onVoid(p.receiptNo)} className="text-red-600 hover:underline inline-flex items-center">
                              <XCircle className="w-4 h-4 mr-1" /> Void
                            </button>
                          ) : (
                            <button onClick={()=>onUnvoid(p.receiptNo)} className="text-indigo-600 hover:underline">Unvoid</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------------- Fee Status ---------------- */}
        {activeTab==='feestatus' && (
          <StudentFeeStatus />
        )}

        {/* ---------------- Reminders ---------------- */}
        {activeTab==='reminders' && (
          <div className="space-y-6">
            <RemindersTab
              students={students}
              feeheads={feeheads}
              payments={payments}
              teacherClass={teacherClass}
            />
            
            {role !== 'teacher' && (
              <div className="mt-6">
                <BulkPaymentForm 
                  onPaymentComplete={() => {
                    // Refresh transactions data after bulk payment
                    getTransactions().then(t => setPayments(t));
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* ---------------- Reports ---------------- */}
        {activeTab==='reports' && (
          <ReportsTab
            students={students}
            payments={payments}
            feeheads={feeheads}
            role={role}
            teacherClass={teacherClass}
          />
        )}
      </main>

      {receipt && <ReceiptModal data={receipt} onClose={()=>setReceipt(null)} />}
    </div>
  );
}

// ---------------- Reminders subcomponent ----------------
// ---------------- Reminders subcomponent ----------------
function RemindersTab({ students, feeheads, payments, teacherClass }) {
  // local helpers (kept here so the component is drop-in)
  const ckey = (v) => String(v ?? '').replace(/\s+/g, '').toLowerCase();
  const cleanPhone = (p) => {
    const digits = String(p || '').replace(/[^\d]/g, '');
    if (digits.startsWith('91')) return digits;
    if (digits.length === 10) return '91' + digits;
    return digits || '';
  };

  // unique class list for the dropdown
  const classes = useMemo(() => {
    const set = new Set(students.map(s => s.cls || s.class).filter(Boolean).map(String));
    return Array.from(set).sort((a,b)=>String(a).localeCompare(String(b)));
  }, [students]);

  // ---------------- UI state ----------------
  const [remClass, setRemClass] = useState('All');
  // NEW: checkboxes
  const [groupByStudent, setGroupByStudent] = useState(true);
  const [onlyOverdue, setOnlyOverdue] = useState(true);

  // message template
  // When grouped, {lines} becomes multiple fee-head lines.
  const [remTemplate, setRemTemplate] = useState(
    'Reminder: School Fee Due\n' +
    'Student: {name} (Adm {admNo}), Class {class}\n' +
    '{lines}\n' +
    'Please pay at the earliest. Thank you.'
  );

  // ---------------- compute PAID index from transactions ----------------
  const paidMap = useMemo(() => {
    const map = new Map(); // admNo -> Set(feeHead)
    payments.forEach(p => {
      const isVoid = String(p.void||'').toUpperCase().startsWith('Y');
      if (isVoid) return;
      const adm = String(p.admNo || '');
      if (!map.has(adm)) map.set(adm, new Set());
      map.get(adm).add(String(p.feeHead));
    });
    return map;
  }, [payments]);

  // ---------------- build raw due rows (one per unpaid head) ----------------
  const itemRows = useMemo(() => {
    const today = new Date();
    const rows = [];

    // Filter students by class and teacher restrictions
    const filteredStudents = students
      .filter(s => (remClass === 'All') || ckey(s.cls || s.class) === ckey(remClass))
      .filter(s => !teacherClass || ckey(s.cls || s.class) === ckey(teacherClass));

    filteredStudents.forEach(s => {
      const cls = s.cls || s.class;
      const adm = String(s.admNo || '');
      const phone = s.phone || s.mobile || '';

      // Get feeheads for this student's class
      const classFeeheads = feeheads.filter(f => ckey(f.class) === ckey(cls));

      classFeeheads.forEach(f => {
        const head = String(f.feeHead || '');
        const alreadyPaid = paidMap.get(adm)?.has(head);

        if (alreadyPaid) return;

        // decide overdue
        const dueDate = f.dueDate ? new Date(f.dueDate) : null;
        const overdue = dueDate ? dueDate < today : false;

        // if "only overdue" is ON, skip future not-yet-due items
        if (onlyOverdue && !overdue) return;

        rows.push({
          admNo: adm,
          name: s.name || s.studentName,
          cls,
          phone,
          feeHead: head,
          amount: Number(f.amount || 0),
          dueDate: f.dueDate || '',
          overdue
        });
      });
    });

    // sort stable: class, name, feeHead
    return rows.sort((a,b)=>
      String(a.cls).localeCompare(String(b.cls)) ||
      String(a.name).localeCompare(String(b.name)) ||
      String(a.feeHead).localeCompare(String(b.feeHead))
    );
  }, [students, feeheads, paidMap, remClass, teacherClass, onlyOverdue]);

  // ---------------- optionally group rows per student ----------------
  const groupedRows = useMemo(() => {
    if (!groupByStudent) return null;

    const byStudent = new Map(); // key = admNo, value = {admNo, name, cls, phone, items:[], total, earliestDue}
    itemRows.forEach(r => {
      const k = r.admNo;
      if (!byStudent.has(k)) {
        byStudent.set(k, {
          admNo: r.admNo,
          name: r.name,
          cls: r.cls,
          phone: r.phone,
          items: [],
          total: 0,
          earliestDue: r.dueDate || ''
        });
      }
      const bucket = byStudent.get(k);
      bucket.items.push({ feeHead: r.feeHead, amount: r.amount, dueDate: r.dueDate });
      bucket.total += Number(r.amount || 0);
      // track earliest due date
      if (r.dueDate) {
        if (!bucket.earliestDue) bucket.earliestDue = r.dueDate;
        else if (new Date(r.dueDate) < new Date(bucket.earliestDue)) bucket.earliestDue = r.dueDate;
      }
    });

    const arr = Array.from(byStudent.values());
    // sort by class then name
    arr.sort((a,b) =>
      String(a.cls).localeCompare(String(b.cls)) ||
      String(a.name).localeCompare(String(b.name))
    );
    return arr;
  }, [itemRows, groupByStudent]);

  // ---------------- template rendering ----------------
  const renderItemTemplate = (row) =>
    remTemplate
      .replace('{name}', row.name)
      .replace('{admNo}', row.admNo)
      .replace('{class}', row.cls)
      .replace('{feeHead}', row.feeHead || '')
      .replace('{amount}', Number(row.amount||0).toLocaleString('en-IN'))
      .replace('{dueDate}', fmtDateIST(row.dueDate))
      .replace('{lines}', `${row.feeHead}: ₹${Number(row.amount||0).toLocaleString('en-IN')} (Due ${fmtDateIST(row.dueDate)})`);

  const renderGroupedTemplate = (g) => {
    const lines = g.items.map(it =>
      `${it.feeHead}: ₹${Number(it.amount||0).toLocaleString('en-IN')} (Due ${fmtDateIST(it.dueDate)})`
    ).join('\n');
    return remTemplate
      .replace('{name}', g.name)
      .replace('{admNo}', g.admNo)
      .replace('{class}', g.cls)
      // if user left {feeHead}/{amount}/{dueDate} in template, keep them harmless
      .replace('{feeHead}', '')
      .replace('{amount}', '')
      .replace('{dueDate}', fmtDateIST(g.earliestDue))
      .replace('{lines}', lines);
  };

  // ---------------- CSV download ----------------
  const downloadCSV = () => {
    if (groupByStudent && groupedRows) {
      const header = ['AdmNo','Name','Class','Phone','Heads','Total','EarliestDue'];
      const lines = [header.join(',')].concat(groupedRows.map(g =>
        [
          g.admNo,
          `"${(g.name||'').replace(/"/g,'""')}"`,
          g.cls,
          `"${g.phone||''}"`,
          `"${g.items.map(i => `${i.feeHead} (₹${i.amount})`).join('; ')}"`,
          g.total,
          fmtDateIST(g.earliestDue)
        ].join(',')
      ));
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'overdues_grouped.csv'; a.click();
      URL.revokeObjectURL(url);
    } else {
      const header = ['AdmNo','Name','Class','Phone','FeeHead','Amount','DueDate'];
      const lines = [header.join(',')].concat(itemRows.map(r =>
        [r.admNo, `"${r.name}"`, r.cls, `"${r.phone||''}"`, `"${r.feeHead}"`, r.amount, fmtDateIST(r.dueDate)].join(',')
      ));
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'overdues.csv'; a.click();
      URL.revokeObjectURL(url);
    }
  };

  // ---------------- UI ----------------
  const totalCount = groupByStudent && groupedRows ? groupedRows.length : itemRows.length;

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      {/* DEBUG INFO PANEL */}
      {teacherClass && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <h4 className="text-sm font-medium text-yellow-800 mb-2">Debug Info (Teacher: {teacherClass})</h4>
          <div className="text-xs text-yellow-700 space-y-1">
            <div>Total Students: {students.length} | Filtered for class: {students.filter(s => ckey(s.cls || s.class) === ckey(teacherClass)).length}</div>
            <div>Total Fee Heads: {feeheads.length} | For class {teacherClass}: {feeheads.filter(f => ckey(f.class) === ckey(teacherClass)).length}</div>
            <div>Defaulters Found: {totalCount} | Only Overdue: {onlyOverdue ? 'Yes' : 'No'}</div>
            <div>Class Filter: {remClass} | Teacher Class Normalized: "{ckey(teacherClass)}"</div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Filter by Class</label>
          <select value={remClass} onChange={e=>setRemClass(e.target.value)} className="px-3 py-2 border rounded-md">
            <option>All</option>
            {classes.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* NEW: checkboxes */}
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={groupByStudent} onChange={e=>setGroupByStudent(e.target.checked)} />
            Group by student
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyOverdue} onChange={e=>setOnlyOverdue(e.target.checked)} />
            Only overdue (pending)
          </label>
        </div>

        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Message Template</label>
          <textarea
            value={remTemplate}
            onChange={e=>setRemTemplate(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
          <div className="text-xs text-gray-500 mt-1">
            Placeholders: {'{name}'}, {'{admNo}'}, {'{class}'}, {'{feeHead}'}, {'{amount}'}, {'{dueDate}'}, <b>{'{lines}'}</b>.
          </div>
        </div>

        <div>
          <button onClick={downloadCSV} className="px-3 py-2 border rounded-md">Download CSV</button>
        </div>
      </div>

      <div className="text-sm text-gray-600">Items: {totalCount}</div>

      <div className="overflow-x-auto">
        {groupByStudent && groupedRows ? (
          // ---- grouped table (one row per student) ----
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs text-gray-500">Student</th>
                <th className="px-3 py-2 text-left text-xs text-gray-500">Class</th>
                <th className="px-3 py-2 text-left text-xs text-gray-500">Heads</th>
                <th className="px-3 py-2 text-left text-xs text-gray-500">Total</th>
                <th className="px-3 py-2 text-left text-xs text-gray-500">Earliest Due</th>
                <th className="px-3 py-2 text-left text-xs text-gray-500">WhatsApp</th>
                <th className="px-3 py-2 text-left text-xs text-gray-500">Copy</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {groupedRows.map((g, i) => {
                const phone = cleanPhone(g.phone);
                const text = renderGroupedTemplate(g);
                const href = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : null;
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm">{g.name} ({g.admNo})</td>
                    <td className="px-3 py-2 text-sm">{g.cls}</td>
                    <td className="px-3 py-2 text-sm">
                      {g.items.map(it => it.feeHead).join(', ')}
                    </td>
                    <td className="px-3 py-2 text-sm">₹{Number(g.total||0).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-sm">{fmtDateIST(g.earliestDue)}</td>
                    <td className="px-3 py-2 text-sm">
                      {href ? <a className="text-green-700 hover:underline" href={href} target="_blank" rel="noreferrer">WhatsApp</a> : <span className="text-red-500">No phone</span>}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <button
                        onClick={async()=>{ try { await navigator.clipboard.writeText(text); alert('Copied'); } catch { alert('Copy failed'); } }}
                        className="text-indigo-600 hover:underline"
                      >
                        Copy
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          // ---- itemized table (one row per unpaid head) ----
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs text-gray-500">Student</th>
                <th className="px-3 py-2 text-left text-xs text-gray-500">Class</th>
                <th className="px-3 py-2 text-left text-xs text-gray-500">Fee Head</th>
                <th className="px-3 py-2 text-left text-xs text-gray-500">Amount</th>
                <th className="px-3 py-2 text-left text-xs text-gray-500">Due</th>
                <th className="px-3 py-2 text-left text-xs text-gray-500">WhatsApp</th>
                <th className="px-3 py-2 text-left text-xs text-gray-500">Copy</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {itemRows.map((r, i) => {
                const phone = cleanPhone(r.phone);
                const text = renderItemTemplate(r);
                const href = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : null;
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm">{r.name} ({r.admNo})</td>
                    <td className="px-3 py-2 text-sm">{r.cls}</td>
                    <td className="px-3 py-2 text-sm">{r.feeHead}</td>
                    <td className="px-3 py-2 text-sm">₹{Number(r.amount||0).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-sm">{fmtDateIST(r.dueDate)}</td>
                    <td className="px-3 py-2 text-sm">
                      {href ? <a className="text-green-700 hover:underline" href={href} target="_blank" rel="noreferrer">WhatsApp</a> : <span className="text-red-500">No phone</span>}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <button
                        onClick={async()=>{ try { await navigator.clipboard.writeText(text); alert('Copied'); } catch { alert('Copy failed'); } }}
                        className="text-indigo-600 hover:underline"
                      >
                        Copy
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
