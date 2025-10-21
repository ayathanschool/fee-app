import React, { useState } from 'react';
import { login } from './api';

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!username || !pin) { setErr('Enter username and PIN'); return; }
    try {
      setLoading(true);
      // login expects either a code string or an object like { username, password }
      // the stubbed api.login reads `input.code || input.password` when an object is passed
      const data = await login({ username, password: pin });
      onSuccess(data); // { username, role, class }
    } catch (e) {
      setErr(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex items-center gap-2">
          <img src="./icon-192.png" alt="logo" className="w-8 h-8 rounded" />
          <h1 className="text-lg font-semibold">Ayathan School — Sign in</h1>
        </div>
        <form className="space-y-3" onSubmit={submit}>
          <div className="relative">
            <span className="icon icon-user"></span>
            <input
              className="w-full border rounded px-9 py-2"
              placeholder="Username (e.g., rani)"
              value={username}
              onChange={e=>setUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div className="relative">
            <span className="icon icon-lock"></span>
            <input
              className="w-full border rounded px-9 py-2"
              placeholder="PIN"
              value={pin}
              onChange={e=>setPin(e.target.value)}
              type="password"
            />
          </div>
          {err && <div className="text-sm text-red-600">{err}</div>}
          <button
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <div className="text-xs text-gray-500">
            Teachers will be auto-locked to their class.
          </div>
        </form>
      </div>
    </div>
  );
}