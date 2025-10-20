import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, Download, Filter, RefreshCcw } from 'lucide-react';

// Helper functions
const ckey = (v) => String(v ?? '').replace(/\s+/g, '').toLowerCase();
const inr = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

function ReportsTab({ students, payments, feeheads, role, teacherClass }) {
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
  
  const { start: fyStart, end: fyEnd } = indianFY(today);

  const [repQuick, setRepQuick] = useState('month');
  const [repFrom, setRepFrom] = useState(fmtYMD(thisMonthStart));
  const [repTo, setRepTo] = useState(fmtYMD(today));
  const [repClass, setRepClass] = useState(role==='teacher' && teacherClass ? teacherClass : 'All');
  const [repHead, setRepHead] = useState('All');
  const [repMode, setRepMode] = useState('All');
  const [repStatus, setRepStatus] = useState('Valid');
  const [repIncludeFine, setRepIncludeFine] = useState(true);
  const [repMin, setRepMin] = useState('');
  const [repMax, setRepMax] = useState('');
  const [repSearch, setRepSearch] = useState('');
  const [repGroupBy, setRepGroupBy] = useState('none');

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
  
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
        <h2 className="text-2xl font-bold flex items-center">
          <BarChart3 className="mr-2" /> Financial Reports
        </h2>
        <p className="opacity-90">Generate detailed payment analytics and summaries</p>
      </div>
      
      {/* Filters section */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium flex items-center">
            <Filter className="w-4 h-4 mr-1" /> Filters
          </h3>
          <button
            onClick={resetFilters}
            className="text-sm flex items-center px-2 py-1 border rounded-md hover:bg-gray-50"
          >
            <RefreshCcw className="w-4 h-4 mr-1" /> Reset Filters
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <div className="flex space-x-2 mb-2">
              <button
                onClick={() => setRepQuick('today')}
                className={`text-xs px-2 py-1 rounded-full ${
                  repQuick === 'today' 
                    ? 'bg-blue-100 border border-blue-300' 
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setRepQuick('week')}
                className={`text-xs px-2 py-1 rounded-full ${
                  repQuick === 'week' 
                    ? 'bg-blue-100 border border-blue-300' 
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setRepQuick('month')}
                className={`text-xs px-2 py-1 rounded-full ${
                  repQuick === 'month' 
                    ? 'bg-blue-100 border border-blue-300' 
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => setRepQuick('fy')}
                className={`text-xs px-2 py-1 rounded-full ${
                  repQuick === 'fy' 
                    ? 'bg-blue-100 border border-blue-300' 
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                FY
              </button>
              <button
                onClick={() => setRepQuick('custom')}
                className={`text-xs px-2 py-1 rounded-full ${
                  repQuick === 'custom' 
                    ? 'bg-blue-100 border border-blue-300' 
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Custom
              </button>
            </div>
            <div className="flex gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={repFrom}
                  onChange={e => {setRepFrom(e.target.value); setRepQuick('custom');}}
                  className="px-2 py-1 border rounded text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={repTo}
                  onChange={e => {setRepTo(e.target.value); setRepQuick('custom');}}
                  className="px-2 py-1 border rounded text-sm w-full"
                />
              </div>
            </div>
          </div>
          
          {/* Class/Fee/Mode filters */}
          <div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select
                  value={repClass}
                  onChange={e => setRepClass(e.target.value)}
                  className="px-2 py-1 border rounded text-sm w-full"
                  disabled={role === 'teacher' && !!teacherClass}
                >
                  <option>All</option>
                  {classes.map(cls => (
                    <option key={cls}>{cls}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fee Head</label>
                <select
                  value={repHead}
                  onChange={e => setRepHead(e.target.value)}
                  className="px-2 py-1 border rounded text-sm w-full"
                >
                  <option>All</option>
                  {(repClass !== 'All' && feeHeadsByClass[repClass]) 
                    ? feeHeadsByClass[repClass].map(head => (
                        <option key={head}>{head}</option>
                      ))
                    : feeHeadsByClass['All'].map(head => (
                        <option key={head}>{head}</option>
                      ))
                  }
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                <select
                  value={repMode}
                  onChange={e => setRepMode(e.target.value)}
                  className="px-2 py-1 border rounded text-sm w-full"
                >
                  {allModes.map(mode => (
                    <option key={mode}>{mode}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="mt-2 flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={repStatus}
                  onChange={e => setRepStatus(e.target.value)}
                  className="px-2 py-1 border rounded text-sm"
                >
                  <option value="Valid">Valid Only</option>
                  <option value="Voided">Voided Only</option>
                  <option value="All">All</option>
                </select>
              </div>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={repIncludeFine}
                  onChange={e => setRepIncludeFine(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm text-gray-700">Include Fine in Total</span>
              </label>
            </div>
          </div>
          
          {/* Amount/Search filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount Range</label>
            <div className="flex gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Min</label>
                <input
                  type="number"
                  value={repMin}
                  onChange={e => setRepMin(e.target.value)}
                  placeholder="Min"
                  className="px-2 py-1 border rounded text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Max</label>
                <input
                  type="number"
                  value={repMax}
                  onChange={e => setRepMax(e.target.value)}
                  placeholder="Max"
                  className="px-2 py-1 border rounded text-sm w-full"
                />
              </div>
            </div>
            
            <div className="mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={repSearch}
                onChange={e => setRepSearch(e.target.value)}
                placeholder="Name, Adm#, Receipt#"
                className="px-2 py-1 border rounded text-sm w-full"
              />
            </div>
          </div>
          
          {/* Group by and Export */}
          <div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group By</label>
              <select
                value={repGroupBy}
                onChange={e => setRepGroupBy(e.target.value)}
                className="px-2 py-1 border rounded text-sm w-full"
              >
                <option value="none">No Grouping</option>
                <option value="class">Class</option>
                <option value="feeHead">Fee Head</option>
                <option value="mode">Payment Mode</option>
                <option value="day">Day</option>
                <option value="month">Month</option>
                <option value="student">Student</option>
              </select>
            </div>
            
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => downloadCSV(reportRows)}
                className="flex items-center px-3 py-2 border rounded-md text-sm hover:bg-gray-50 flex-1"
              >
                <Download className="w-4 h-4 mr-1" /> Raw Data
              </button>
              
              {grouped && (
                <button
                  onClick={downloadGroupedCSV}
                  className="flex items-center px-3 py-2 border rounded-md text-sm hover:bg-gray-50 flex-1"
                >
                  <Download className="w-4 h-4 mr-1" /> Grouped
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4">
        <div className="bg-gray-50 rounded-lg p-3 border">
          <div className="text-sm text-gray-500">Records</div>
          <div className="text-xl font-semibold">{repSummary.count}</div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-3 border">
          <div className="text-sm text-gray-500">Total Amount</div>
          <div className="text-xl font-semibold text-blue-600">₹{inr(repSummary.included)}</div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-3 border">
          <div className="text-sm text-gray-500">Gross Amount</div>
          <div className="text-xl font-semibold">₹{inr(repSummary.grossAmt)}</div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-3 border">
          <div className="text-sm text-gray-500">Fine Amount</div>
          <div className="text-xl font-semibold">₹{inr(repSummary.fineAmt)}</div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-3 border">
          <div className="text-sm text-gray-500">Voided Transactions</div>
          <div className="text-xl font-semibold">{repSummary.voidCount}</div>
        </div>
      </div>
      
      {/* Results - either grouped or detailed */}
      <div className="p-4">
        {repGroupBy !== 'none' && grouped ? (
          <div>
            <h3 className="font-medium mb-3">Grouped Results ({grouped.length})</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Group</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Receipts</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Gross</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Fine</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {grouped.map((g, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm font-medium">{g.key}</td>
                      <td className="px-3 py-2 text-sm">{g.receipts}</td>
                      <td className="px-3 py-2 text-sm">₹{inr(g.gross)}</td>
                      <td className="px-3 py-2 text-sm">₹{inr(g.fine)}</td>
                      <td className="px-3 py-2 text-sm font-medium text-blue-600">₹{inr(g.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="font-medium mb-3">Detailed Results ({reportRows.length})</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Date</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Receipt</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Student</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Class</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Fee Head</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Amount</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Fine</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Total</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Mode</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportRows.slice(0, 100).map((r, i) => {
                    const isVoid = String(r.void||'').toUpperCase().startsWith('Y');
                    const total = Number(r.amount||0) + (repIncludeFine ? Number(r.fine||0) : 0);
                    
                    return (
                      <tr key={i} className={`hover:bg-gray-50 ${isVoid ? 'opacity-60 line-through' : ''}`}>
                        <td className="px-3 py-2 text-sm">{r.date}</td>
                        <td className="px-3 py-2 text-sm">{r.receiptNo}</td>
                        <td className="px-3 py-2 text-sm">{r.name} ({r.admNo})</td>
                        <td className="px-3 py-2 text-sm">{r.cls}</td>
                        <td className="px-3 py-2 text-sm">{r.feeHead}</td>
                        <td className="px-3 py-2 text-sm">₹{inr(r.amount)}</td>
                        <td className="px-3 py-2 text-sm">₹{inr(r.fine)}</td>
                        <td className="px-3 py-2 text-sm font-medium">₹{inr(total)}</td>
                        <td className="px-3 py-2 text-sm">{r.mode}</td>
                      </tr>
                    );
                  })}
                  {reportRows.length > 100 && (
                    <tr>
                      <td colSpan="9" className="px-3 py-2 text-sm text-center text-gray-500">
                        Showing 100 of {reportRows.length} results. Download raw data for complete list.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReportsTab;