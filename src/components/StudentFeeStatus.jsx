import React, { useState } from 'react';
import { getStudentFeeStatus } from '../api';
import { Search, FileSearch, CheckCircle, AlertCircle, Download, Calendar, Receipt } from 'lucide-react';

// Helper function to format currency
const inr = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const StudentFeeStatus = () => {
  const [admissionNo, setAdmissionNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [feeData, setFeeData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!admissionNo.trim()) {
      setError('Please enter an admission number');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await getStudentFeeStatus(admissionNo);
      if (response && response.ok) {
        setFeeData(response);
      } else {
        setError(response?.error || 'Failed to fetch student fee status');
      }
    } catch (err) {
      setError(`Error: ${err.message || 'Failed to fetch student fee status'}`);
    } finally {
      setLoading(false);
    }
  };

  // Generate CSV for export
  const downloadCSV = () => {
    if (!feeData) return;

    const header = ['FeeHead', 'Amount', 'DueDate', 'Status', 'PaymentDate', 'ReceiptNo'];
    const rows = feeData.feeStatus.map(fee => [
      fee.feeHead,
      fee.amount,
      fee.dueDate || '',
      fee.paid ? 'Paid' : 'Pending',
      fee.paymentDate || '',
      fee.receiptNo || ''
    ]);

    const csvContent = [
      header.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fee-status-${feeData.student.admNo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white">
        <h2 className="text-2xl font-bold flex items-center">
          <FileSearch className="mr-2" /> Student Fee Status
        </h2>
        <p className="opacity-90">Check comprehensive fee payment status for any student</p>
      </div>

      {/* Search Form */}
      <div className="p-6 border-b">
        <form onSubmit={handleSubmit} className="flex items-end gap-4 max-w-lg">
          <div className="flex-1">
            <label htmlFor="admissionNo" className="block text-sm font-medium text-gray-700 mb-1">
              Admission Number
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                id="admissionNo"
                value={admissionNo}
                onChange={(e) => setAdmissionNo(e.target.value)}
                placeholder="Enter admission number"
                disabled={loading}
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Check Status'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md border border-red-200">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {feeData && (
        <div className="p-6">
          {/* Student Details Card */}
          <div className="bg-gray-50 rounded-lg p-4 border mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold">{feeData.student.name}</h3>
                <div className="mt-1 text-sm text-gray-600">
                  Class: {feeData.student.class} | Admission No: {feeData.student.admNo}
                </div>
              </div>
              <div className="flex items-center">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  feeData.summary.paymentComplete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {feeData.summary.paymentComplete ? (
                    <><CheckCircle className="w-3 h-3 mr-1" /> All Fees Paid</>
                  ) : (
                    <><AlertCircle className="w-3 h-3 mr-1" /> Payment Pending</>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Fee Summary */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Fee Summary</h3>
              <button 
                onClick={downloadCSV} 
                className="text-sm flex items-center text-blue-600 hover:text-blue-800"
              >
                <Download className="w-4 h-4 mr-1" /> Export CSV
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg border shadow-sm">
                <div className="text-sm text-gray-500">Total Due</div>
                <div className="text-xl font-bold mt-1">₹{inr(feeData.summary.totalDue)}</div>
              </div>
              <div className="bg-white p-4 rounded-lg border shadow-sm">
                <div className="text-sm text-gray-500">Total Paid</div>
                <div className="text-xl font-bold text-green-600 mt-1">₹{inr(feeData.summary.totalPaid)}</div>
              </div>
              <div className="bg-white p-4 rounded-lg border shadow-sm">
                <div className="text-sm text-gray-500">Fine Amount</div>
                <div className="text-xl font-bold text-red-600 mt-1">₹{inr(feeData.summary.totalFine)}</div>
              </div>
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border shadow-sm">
                <div className="text-sm text-gray-700">Grand Total Due</div>
                <div className="text-xl font-bold text-indigo-600 mt-1">₹{inr(feeData.summary.grandTotal)}</div>
              </div>
            </div>
          </div>

          {/* Fee Details Table */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Fee Details</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fee Head</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {feeData.feeStatus.map((fee, index) => (
                    <tr key={index} className={`hover:bg-gray-50 ${fee.paid ? '' : 'bg-amber-50'}`}>
                      <td className="px-3 py-3 text-sm">{fee.feeHead}</td>
                      <td className="px-3 py-3 text-sm font-medium">₹{inr(fee.amount)}</td>
                      <td className="px-3 py-3 text-sm">
                        {fee.dueDate ? (
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                            {new Date(fee.dueDate).toLocaleDateString()}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                          fee.paid ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {fee.paid ? (
                            <><CheckCircle className="w-3 h-3 mr-1" /> Paid</>
                          ) : (
                            <><AlertCircle className="w-3 h-3 mr-1" /> Pending</>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm">{fee.paymentDate ? new Date(fee.paymentDate).toLocaleDateString() : '-'}</td>
                      <td className="px-3 py-3 text-sm">
                        {fee.receiptNo ? (
                          <div className="flex items-center">
                            <Receipt className="w-4 h-4 mr-1 text-gray-400" />
                            {fee.receiptNo}
                          </div>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Show empty state if no results yet */}
      {!feeData && !loading && !error && (
        <div className="p-12 text-center text-gray-500">
          <FileSearch className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium mb-2">Enter an admission number to check fee status</h3>
          <p className="text-sm">View complete payment history, pending fees, and more.</p>
        </div>
      )}
    </div>
  );
};

export default StudentFeeStatus;