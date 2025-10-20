import React from 'react';

function cleanPhone(p) {
  const digits = String(p || '').replace(/[^\d]/g, '');
  if (digits.startsWith('91')) return digits;
  if (digits.length === 10) return '91' + digits;
  return digits || '';
}

export default function ReceiptModal({ data, onClose }) {
  if (!data) return null;
  const { receiptNo, date, student, items, mode, remarks } = data;
  const total = items.reduce((s, r) => s + Number(r.amount||0) + Number(r.fine||0), 0);

  const msg = [
    `Fee Receipt`,
    `------------------`,
    `Student: ${student.name} (Adm ${student.admNo})`,
    `Class: ${student.cls}`,
    `Date: ${new Date(date).toLocaleDateString()}`,
    ...items.map(it => `• ${it.feeHead}: ₹${Number(it.amount||0) + Number(it.fine||0)}`),
    `Total: ₹${total.toLocaleString('en-IN')}`,
    `Mode: ${mode}`,
    remarks ? `Remarks: ${remarks}` : null,
    `Receipt No: ${receiptNo}`,
  ].filter(Boolean).join('\n');

  const phone = cleanPhone(student.phone);
  const waUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg);
      alert('Message copied to clipboard');
    } catch {
      alert('Copy failed. Long-press to copy manually.');
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-md rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Receipt #{receiptNo}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="text-sm text-gray-600 mt-1">Date: {new Date(date).toLocaleDateString()}</div>

        <div className="flex items-center gap-3 mb-2">
          <img src="/icon-192.png" alt="Ayathan School" className="w-10 h-10" />
          <div>
            <div className="font-semibold text-lg">Ayathan School</div>
            <div className="text-xs text-gray-500">Love &amp; Serve</div>
          </div>
        </div>

        <div className="mt-3">
          <div className="font-medium">{student.name} (Adm {student.admNo})</div>
          <div className="text-sm text-gray-600">Class {student.cls}</div>
          {student.phone ? (
            <div className="text-sm text-gray-600">Phone: {student.phone}</div>
          ) : (
            <div className="text-xs text-red-600">No phone in Students sheet</div>
          )}
        </div>

        <div className="mt-4 border rounded-lg divide-y">
          {items.map((it, i) => (
            <div key={i} className="p-2 text-sm flex justify-between">
              <div>
                {it.feeHead}
                {Number(it.fine||0) ? <span className="text-xs text-gray-500"> (+fine)</span> : null}
              </div>
              <div>₹{(Number(it.amount||0) + Number(it.fine||0)).toLocaleString('en-IN')}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 text-sm text-gray-600">Mode: {mode}</div>
        {remarks ? <div className="text-xs text-gray-500">Remarks: {remarks}</div> : null}

        <div className="mt-3 font-semibold text-right">
          Total: ₹{total.toLocaleString('en-IN')}
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {waUrl ? (
            <a href={waUrl} target="_blank" rel="noreferrer"
               className="px-3 py-2 rounded-md border text-green-700 hover:bg-green-50">WhatsApp</a>
          ) : (
            <button disabled className="px-3 py-2 rounded-md border text-gray-400">WhatsApp</button>
          )}
          <button onClick={handleCopy} className="px-3 py-2 rounded-md border text-gray-700 hover:bg-gray-50">Copy</button>
          <button onClick={handlePrint} className="px-3 py-2 rounded-md border text-gray-700 hover:bg-gray-50">Print</button>
          <button onClick={onClose} className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">Close</button>
        </div>
      </div>
    </div>
  );
}
