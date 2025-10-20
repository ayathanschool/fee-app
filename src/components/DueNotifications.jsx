import React, { useState, useEffect, useMemo } from 'react';
import { Bell, Filter, RefreshCcw, X, ChevronRight, Calendar, Search } from 'lucide-react';
import { getDueFeeNotifications } from '../api';

// Helper functions
const ckey = (v) => String(v ?? '').replace(/\s+/g, '').toLowerCase();
const inr = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

function DueNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedNotif, setSelectedNotif] = useState(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    searchTerm: '',
    class: 'All',
    feeHead: 'All',
    daysOverdue: 'All',  // 'All', '30+', '60+', '90+'
    sortBy: 'dueDate'    // 'dueDate', 'amount', 'name'
  });
  
  // Load notifications when component mounts
  useEffect(() => {
    loadNotifications();
  }, []);
  
  // Load notifications from backend
  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDueFeeNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load due fee notifications:', err);
      setError('Failed to load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Calculated days overdue from due date
  const getOverdueDays = (dueDate) => {
    if (!dueDate) return 0;
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = Math.abs(now - due);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };
  
  // Extract unique classes and fee heads for filters
  const classes = useMemo(() => {
    const uniqueClasses = new Set(['All']);
    notifications.forEach(n => uniqueClasses.add(n.class));
    return Array.from(uniqueClasses);
  }, [notifications]);
  
  const feeHeads = useMemo(() => {
    const uniqueFeeHeads = new Set(['All']);
    notifications.forEach(n => uniqueFeeHeads.add(n.feeHead));
    return Array.from(uniqueFeeHeads);
  }, [notifications]);
  
  // Apply filters to notifications
  const filteredNotifications = useMemo(() => {
    let result = [...notifications];
    
    // Apply text search
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      result = result.filter(n => 
        n.studentName.toLowerCase().includes(term) || 
        String(n.admissionNo).toLowerCase().includes(term)
      );
    }
    
    // Apply class filter
    if (filters.class !== 'All') {
      result = result.filter(n => ckey(n.class) === ckey(filters.class));
    }
    
    // Apply fee head filter
    if (filters.feeHead !== 'All') {
      result = result.filter(n => ckey(n.feeHead) === ckey(filters.feeHead));
    }
    
    // Apply days overdue filter
    if (filters.daysOverdue !== 'All') {
      const daysRequired = parseInt(filters.daysOverdue);
      result = result.filter(n => {
        const days = getOverdueDays(n.dueDate);
        return days >= daysRequired;
      });
    }
    
    // Apply sorting
    result.sort((a, b) => {
      if (filters.sortBy === 'dueDate') {
        return new Date(a.dueDate) - new Date(b.dueDate);
      } else if (filters.sortBy === 'amount') {
        return b.amount - a.amount;
      } else if (filters.sortBy === 'name') {
        return a.studentName.localeCompare(b.studentName);
      }
      return 0;
    });
    
    return result;
  }, [notifications, filters]);
  
  // Handle filter changes
  const updateFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  // Reset filters
  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      class: 'All',
      feeHead: 'All',
      daysOverdue: 'All',
      sortBy: 'dueDate'
    });
  };
  
  // Show notification detail
  const openNotificationDetail = (notification) => {
    setSelectedNotif(notification);
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-orange-500 to-red-600 p-6 text-white">
        <h2 className="text-2xl font-bold flex items-center">
          <Bell className="mr-2" /> Due Fee Notifications
        </h2>
        <p className="opacity-90">Track and manage overdue fee payments</p>
      </div>
      
      {/* Filters section */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={filters.searchTerm}
                onChange={(e) => updateFilter('searchTerm', e.target.value)}
                placeholder="Search by name or admission number"
                className="w-full pl-10 pr-3 py-2 border rounded-md"
              />
            </div>
          </div>
          
          <div>
            <select
              value={filters.class}
              onChange={(e) => updateFilter('class', e.target.value)}
              className="border rounded-md px-3 py-2"
            >
              {classes.map(cls => (
                <option key={cls} value={cls}>{cls === 'All' ? 'All Classes' : cls}</option>
              ))}
            </select>
          </div>
          
          <div>
            <select
              value={filters.feeHead}
              onChange={(e) => updateFilter('feeHead', e.target.value)}
              className="border rounded-md px-3 py-2"
            >
              {feeHeads.map(head => (
                <option key={head} value={head}>{head === 'All' ? 'All Fee Heads' : head}</option>
              ))}
            </select>
          </div>
          
          <div>
            <select
              value={filters.daysOverdue}
              onChange={(e) => updateFilter('daysOverdue', e.target.value)}
              className="border rounded-md px-3 py-2"
            >
              <option value="All">Any Overdue</option>
              <option value="30">30+ Days</option>
              <option value="60">60+ Days</option>
              <option value="90">90+ Days</option>
            </select>
          </div>
          
          <div>
            <select
              value={filters.sortBy}
              onChange={(e) => updateFilter('sortBy', e.target.value)}
              className="border rounded-md px-3 py-2"
            >
              <option value="dueDate">Sort by Due Date</option>
              <option value="amount">Sort by Amount</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>
          
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 px-3 py-2 border rounded-md hover:bg-gray-100"
          >
            <RefreshCcw className="w-4 h-4" /> Reset
          </button>
          
          <button
            onClick={loadNotifications}
            className="flex items-center gap-1 px-3 py-2 border rounded-md bg-blue-100 text-blue-800 hover:bg-blue-200"
          >
            <RefreshCcw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>
      
      {/* Loading and error states */}
      {loading && (
        <div className="p-6 text-center text-gray-500">
          Loading notifications...
        </div>
      )}
      
      {error && (
        <div className="p-4 m-4 bg-red-50 text-red-700 rounded-md border border-red-200">
          {error}
        </div>
      )}
      
      {/* Notifications list */}
      {!loading && !error && (
        <div className="flex flex-col md:flex-row h-[calc(100vh-300px)] min-h-[400px]">
          <div className="md:w-1/2 overflow-y-auto border-r">
            <div className="p-3 bg-gray-50 border-b sticky top-0 z-10 flex justify-between items-center">
              <span className="font-medium">Notifications ({filteredNotifications.length})</span>
              {filteredNotifications.length === 0 && notifications.length > 0 && (
                <span className="text-sm text-gray-500">No matches found</span>
              )}
            </div>
            
            {filteredNotifications.length === 0 && (
              <div className="p-6 text-center text-gray-500">
                {notifications.length === 0 
                  ? "No due fee notifications found" 
                  : "No notifications match your filters"}
              </div>
            )}
            
            {filteredNotifications.map((notif, index) => {
              const days = getOverdueDays(notif.dueDate);
              let severityClass = 'bg-orange-50 border-orange-200';
              if (days >= 90) severityClass = 'bg-red-50 border-red-200';
              else if (days >= 60) severityClass = 'bg-amber-50 border-amber-200';
              
              return (
                <div 
                  key={`${notif.admissionNo}-${notif.feeHead}-${index}`}
                  onClick={() => openNotificationDetail(notif)}
                  className={`p-4 border-b hover:bg-blue-50 cursor-pointer ${
                    selectedNotif === notif ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{notif.studentName}</div>
                      <div className="text-sm text-gray-500">
                        {notif.class} | Adm# {notif.admissionNo}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                  
                  <div className="mt-2 flex justify-between items-center">
                    <div className={`px-2 py-1 rounded text-xs ${severityClass}`}>
                      {notif.feeHead}
                    </div>
                    <div className="font-semibold">₹{inr(notif.amount)}</div>
                  </div>
                  
                  <div className="mt-2 flex justify-between text-sm">
                    <div className="flex items-center text-gray-600">
                      <Calendar className="w-4 h-4 mr-1" />
                      Due: {new Date(notif.dueDate).toLocaleDateString()}
                    </div>
                    <div className="text-red-600 font-medium">
                      {days} days overdue
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Detail panel */}
          <div className="md:w-1/2 p-4 bg-gray-50 overflow-y-auto">
            {selectedNotif ? (
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Notification Detail</h3>
                  <button 
                    onClick={() => setSelectedNotif(null)}
                    className="p-1 rounded-full hover:bg-gray-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 block">Student Name</label>
                      <div className="font-medium">{selectedNotif.studentName}</div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block">Admission No.</label>
                      <div>{selectedNotif.admissionNo}</div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block">Class</label>
                      <div>{selectedNotif.class}</div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block">Contact</label>
                      <div>{selectedNotif.phone || 'Not available'}</div>
                    </div>
                  </div>
                  
                  <div className="border-t pt-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 block">Fee Head</label>
                        <div className="font-medium">{selectedNotif.feeHead}</div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block">Amount</label>
                        <div className="text-lg font-bold text-blue-600">₹{inr(selectedNotif.amount)}</div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block">Due Date</label>
                        <div>{new Date(selectedNotif.dueDate).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block">Days Overdue</label>
                        <div className="text-red-600 font-medium">
                          {getOverdueDays(selectedNotif.dueDate)} days
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {selectedNotif.notes && (
                    <div className="border-t pt-3">
                      <label className="text-xs text-gray-500 block">Notes</label>
                      <div className="mt-1 text-gray-700">{selectedNotif.notes}</div>
                    </div>
                  )}
                  
                  <div className="border-t pt-3 flex gap-2">
                    <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                      Record Payment
                    </button>
                    {selectedNotif.phone && (
                      <a
                        href={`https://wa.me/${selectedNotif.phone}?text=${encodeURIComponent(
                          `Reminder: Fee payment of ₹${selectedNotif.amount} for ${selectedNotif.feeHead} was due on ${
                            new Date(selectedNotif.dueDate).toLocaleDateString()
                          }. Please arrange payment as soon as possible.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Send Reminder
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                Select a notification to view details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DueNotifications;