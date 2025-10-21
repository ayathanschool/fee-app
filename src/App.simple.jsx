import React, { useEffect, useMemo, useState } from 'react';
import ReceiptModal from './components/ReceiptModal';
import Login from './Login.simple';
import {
  getStudents, getFeeHeads, getTransactions,
  addPaymentBatch, voidReceipt, unvoidReceipt,
  checkPaymentStatus
} from './api';

// ---------- helpers ----------
const inr = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const ckey = (v) => String(v ?? '').replace(/\s+/g, '').toLowerCase();

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

  // Basic UI with simplified navigation
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Welcome to Fee Collection App</h2>
          
          <p className="mb-4">You are logged in as: <strong>{session.name}</strong> (Role: {session.role})</p>
          
          <div className="p-4 bg-blue-100 rounded-lg mb-4">
            <h3 className="font-medium text-blue-800 mb-2">Application Status</h3>
            <ul className="list-disc pl-5 text-blue-800">
              <li>Loaded {students.length} students</li>
              <li>Loaded {feeheads.length} fee heads</li>
              <li>Loaded {payments.length} payment records</li>
            </ul>
          </div>
          
          <div className="p-4 bg-yellow-100 rounded-lg">
            <h3 className="font-medium text-yellow-800 mb-2">UI Issues</h3>
            <p className="text-yellow-800">
              The UI is currently experiencing some styling issues. Our team is working on resolving them.
              Please try using a different browser or check back later.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}