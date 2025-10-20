import React, { useState, useEffect, useMemo } from 'react';
import { Users, Calendar, Search, PlusCircle, X, CheckCircle } from 'lucide-react';
import { getStudents, getFeeHeads, processBulkPayment } from '../api';

// Helper functions
const ckey = (v) => String(v ?? '').replace(/\s+/g, '').toLowerCase();
const inr = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

// Helper to calculate fine amount based on due date and payment date
const calculateFine = (dueDate, payDate) => {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const pay = new Date(payDate);
  if (isNaN(due) || isNaN(pay) || pay <= due) return 0;
  const diffTime = Math.abs(pay - due);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const buckets = Math.ceil(diffDays / 15);  // every 15 days -> ₹25
  return buckets * 25;
};

function BulkPaymentForm({ onPaymentComplete }) {
  const [students, setStudents] = useState([]);
  const [feeheads, setFeeheads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  // Form state
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [remarks, setRemarks] = useState('');
  
  // Selected students and fee heads
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedFeeHeads, setSelectedFeeHeads] = useState([]);
  
  // Filter and search state
  const [studentClass, setStudentClass] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [feeHeadSearchTerm, setFeeHeadSearchTerm] = useState('');
  
  // Load students and fee heads when component mounts
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [studentsData, feeheadsData] = await Promise.all([
          getStudents(),
          getFeeHeads()
        ]);
        setStudents(studentsData);
        setFeeheads(feeheadsData);
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load necessary data. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  // Get unique classes for dropdown
  const classes = useMemo(() => {
    const uniqueClasses = new Set(['All']);
    students.forEach(s => uniqueClasses.add(s.cls || s.class));
    return Array.from(uniqueClasses).sort();
  }, [students]);
  
  // Filter students based on class and search term
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // Filter by class
      if (studentClass !== 'All' && ckey(student.cls || student.class) !== ckey(studentClass)) {
        return false;
      }
      
      // Filter by search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const name = (student.name || student.studentName || '').toLowerCase();
        const admNo = String(student.admNo || '').toLowerCase();
        
        return name.includes(term) || admNo.includes(term);
      }
      
      return true;
    });
  }, [students, studentClass, searchTerm]);
  
  // Filter fee heads based on search term
  const filteredFeeHeads = useMemo(() => {
    if (!selectedStudents.length) return [];
    
    // Get common class across selected students
    const selectedClasses = new Set(selectedStudents.map(s => ckey(s.cls || s.class)));
    
    // Find fee heads for the selected class(es)
    let applicableFeeHeads = feeheads.filter(fh => {
      // Match to any of the selected student classes
      return Array.from(selectedClasses).some(cls => 
        ckey(fh.class) === cls
      );
    });
    
    // Filter by search term
    if (feeHeadSearchTerm) {
      const term = feeHeadSearchTerm.toLowerCase();
      applicableFeeHeads = applicableFeeHeads.filter(fh => 
        String(fh.feeHead || '').toLowerCase().includes(term)
      );
    }
    
    return applicableFeeHeads;
  }, [feeheads, selectedStudents, feeHeadSearchTerm]);
  
  // Toggle student selection
  const toggleStudentSelection = (student) => {
    setSelectedStudents(prev => {
      const isSelected = prev.some(s => s.admNo === student.admNo);
      
      if (isSelected) {
        return prev.filter(s => s.admNo !== student.admNo);
      } else {
        return [...prev, student];
      }
    });
  };
  
  // Toggle fee head selection
  const toggleFeeHeadSelection = (feeHead) => {
    setSelectedFeeHeads(prev => {
      const isSelected = prev.some(fh => fh.feeHead === feeHead.feeHead);
      
      if (isSelected) {
        return prev.filter(fh => fh.feeHead !== feeHead.feeHead);
      } else {
        return [...prev, { ...feeHead, waiveFine: false }];
      }
    });
  };
  
  // Remove a selected student
  const removeSelectedStudent = (admNo) => {
    setSelectedStudents(prev => prev.filter(s => s.admNo !== admNo));
  };
  
  // Remove a selected fee head
  const removeSelectedFeeHead = (feeHead) => {
    setSelectedFeeHeads(prev => prev.filter(fh => fh.feeHead !== feeHead));
  };
  
  // Toggle fine waiver for a fee head
  const toggleFineWaiver = (feeHead) => {
    setSelectedFeeHeads(prev => prev.map(fh => 
      fh.feeHead === feeHead ? { ...fh, waiveFine: !fh.waiveFine } : fh
    ));
  };
  
  // Calculate total amount
  const totalAmount = useMemo(() => {
    let sum = 0;
    
    // For each student and each selected fee head, add the amount
    selectedStudents.forEach(student => {
      const studentClass = ckey(student.cls || student.class);
      
      selectedFeeHeads.forEach(fh => {
        if (ckey(fh.class) === studentClass) {
          // Add fee amount
          sum += Number(fh.amount || 0);
          
          // Add fine if not waived
          if (!fh.waiveFine && fh.dueDate) {
            const dueDate = new Date(fh.dueDate);
            const payDate = new Date(paymentDate);
            
            if (payDate > dueDate) {
              const diffTime = Math.abs(payDate - dueDate);
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              const buckets = Math.ceil(diffDays / 15);  // every 15 days -> ₹25
              sum += buckets * 25;
            }
          }
        }
      });
    });
    
    return sum;
  }, [selectedStudents, selectedFeeHeads, paymentDate]);
  
  // Handle bulk payment submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (selectedStudents.length === 0) {
      setError('Please select at least one student');
      return;
    }
    
    if (selectedFeeHeads.length === 0) {
      setError('Please select at least one fee head');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Prepare payment data - use the format expected by the bulkPayment action
      const paymentData = {
        date: paymentDate,
        mode: paymentMode,
        remarks: remarks,
        payments: selectedStudents.map(student => ({
          admNo: student.admNo,
          name: student.name || student.studentName,
          cls: student.cls || student.class,
          phone: student.phone || student.mobile || '',
          feeHeads: selectedFeeHeads
            .filter(fh => ckey(fh.class) === ckey(student.cls || student.class))
            .map(fh => ({
              feeHead: fh.feeHead,
              amount: fh.amount,
              fine: fh.waiveFine ? 0 : calculateFine(fh.dueDate, paymentDate),
              waiveFine: fh.waiveFine
            }))
        }))
      };
      
      // Process the bulk payment
      const result = await processBulkPayment(paymentData);
      
      // Handle success
      setSuccessMessage(`Successfully processed ${result.successCount || 0} of ${result.totalCount || 0} payments`);
      
      // Clear form
      setSelectedStudents([]);
      setSelectedFeeHeads([]);
      setRemarks('');
      
      // Notify parent component
      if (onPaymentComplete) {
        onPaymentComplete(result);
      }
      
      // Clear success message after a few seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error('Bulk payment failed:', err);
      setError(`Payment failed: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-purple-500 to-blue-600 p-6 text-white">
        <h2 className="text-2xl font-bold flex items-center">
          <Users className="mr-2" /> Bulk Payment Processing
        </h2>
        <p className="opacity-90">Process payments for multiple students at once</p>
      </div>
      
      {loading && (
        <div className="p-6 text-center text-gray-500">
          Loading data...
        </div>
      )}
      
      {error && (
        <div className="p-4 m-4 bg-red-50 text-red-700 rounded-md border border-red-200">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="p-4 m-4 bg-green-50 text-green-700 rounded-md border border-green-200">
          {successMessage}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
            <div className="relative">
              <input 
                type="date" 
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500" 
                required 
              />
              <Calendar className="absolute right-3 top-3 text-gray-400 w-5 h-5" />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
            <select 
              value={paymentMode} 
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg"
            >
              <option>Cash</option>
              <option>UPI</option>
              <option>Bank</option>
              <option>Card</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks (Optional)</label>
            <input 
              type="text" 
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any additional notes"
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Student selection section */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 p-4 border-b">
              <h3 className="font-medium">Select Students</h3>
              
              <div className="mt-2 flex gap-2">
                <select 
                  value={studentClass} 
                  onChange={(e) => setStudentClass(e.target.value)}
                  className="border rounded px-3 py-1"
                >
                  {classes.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
                
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search students..."
                    className="w-full pl-9 pr-3 py-1 border rounded"
                  />
                </div>
              </div>
            </div>
            
            {/* Selected students pills */}
            {selectedStudents.length > 0 && (
              <div className="p-3 bg-blue-50 border-b flex flex-wrap gap-2">
                {selectedStudents.map((student, sidx) => (
                  <div 
                    key={`${student.admNo}-${sidx}`} 
                    className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center"
                  >
                    {student.name || student.studentName} ({student.admNo})
                    <button 
                      type="button" 
                      onClick={() => removeSelectedStudent(student.admNo)}
                      className="ml-1 rounded-full hover:bg-blue-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Students list */}
            <div className="max-h-64 overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No students found
                </div>
              ) : (
                <div>
                  {filteredStudents.map((student, idx) => {
                    const isSelected = selectedStudents.some(s => s.admNo === student.admNo && s.idx === idx) || selectedStudents.some(s => s.admNo === student.admNo);
                    
                    return (
                      <div 
                        key={`${student.admNo}-${idx}`}
                        onClick={() => toggleStudentSelection(student)}
                        className={`p-3 border-b cursor-pointer hover:bg-gray-50 flex items-center gap-2 ${
                          isSelected ? 'bg-blue-50' : ''
                        }`}
                      >
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => {}} // Handled by parent div onClick
                          className="h-5 w-5 text-blue-600 rounded"
                        />
                        <div>
                          <div className="font-medium">{student.name || student.studentName}</div>
                          <div className="text-sm text-gray-500">
                            {student.cls || student.class} | Adm# {student.admNo}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          
          {/* Fee heads selection section */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 p-4 border-b">
              <h3 className="font-medium">Select Fee Heads</h3>
              
              <div className="mt-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input 
                  type="text"
                  value={feeHeadSearchTerm}
                  onChange={(e) => setFeeHeadSearchTerm(e.target.value)}
                  placeholder="Search fee heads..."
                  className="w-full pl-9 pr-3 py-1 border rounded"
                />
              </div>
            </div>
            
            {/* Selected fee heads pills */}
            {selectedFeeHeads.length > 0 && (
              <div className="p-3 bg-blue-50 border-b flex flex-wrap gap-2">
                {selectedFeeHeads.map(fh => (
                  <div 
                    key={fh.feeHead} 
                    className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center"
                  >
                    {fh.feeHead}
                    <button 
                      type="button" 
                      onClick={() => removeSelectedFeeHead(fh.feeHead)}
                      className="ml-1 rounded-full hover:bg-blue-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Fee heads list */}
            <div className="max-h-64 overflow-y-auto">
              {selectedStudents.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  Select students first to see applicable fee heads
                </div>
              ) : filteredFeeHeads.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No matching fee heads found
                </div>
              ) : (
                <div>
                  {filteredFeeHeads.map((fh, fidx) => {
                    const isSelected = selectedFeeHeads.some(selected => selected.feeHead === fh.feeHead);
                    const selectedFh = selectedFeeHeads.find(selected => selected.feeHead === fh.feeHead);
                    
                    return (
                      <div key={`${fh.feeHead}-${fidx}`} className="border-b">
                        <div 
                          onClick={() => toggleFeeHeadSelection(fh)}
                          className={`p-3 cursor-pointer hover:bg-gray-50 flex justify-between items-center ${
                            isSelected ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => {}} // Handled by parent div onClick
                              className="h-5 w-5 text-blue-600 rounded"
                            />
                            <div>
                              <div className="font-medium">{fh.feeHead}</div>
                              <div className="text-sm text-gray-500">
                                Due: {fh.dueDate ? new Date(fh.dueDate).toLocaleDateString() : 'N/A'}
                              </div>
                            </div>
                          </div>
                          <div className="font-semibold">₹{inr(fh.amount)}</div>
                        </div>
                        
                        {isSelected && (
                          <div className="px-3 py-2 bg-blue-50 flex items-center justify-end">
                            <label className="flex items-center gap-2 text-sm">
                              <input 
                                type="checkbox"
                                checked={selectedFh.waiveFine}
                                onChange={() => toggleFineWaiver(fh.feeHead)}
                                className="h-4 w-4"
                              />
                              Waive late fee
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Summary and submit */}
        <div className="mt-6 bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-gray-500">Total students: {selectedStudents.length}</div>
              <div className="text-sm text-gray-500">Total fee heads: {selectedFeeHeads.length}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total amount:</div>
              <div className="text-xl font-bold text-blue-600">₹{inr(totalAmount)}</div>
            </div>
          </div>
          
          <button 
            type="submit"
            disabled={loading || selectedStudents.length === 0 || selectedFeeHeads.length === 0}
            className="mt-4 w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              'Processing...'
            ) : (
              <span className="flex items-center justify-center">
                <CheckCircle className="w-5 h-5 mr-2" /> Process Bulk Payment
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default BulkPaymentForm;