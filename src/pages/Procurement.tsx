import React, { useState, useEffect } from 'react';
import { 
  Truck, ShoppingBag, Plus, FileText, 
  CheckCircle, User, Users, MapPin, Loader2, AlertTriangle, Clock, Printer, TrendingUp, Search, RefreshCw, ChevronRight, Package, LayoutDashboard, ShieldCheck, X, Filter, ChevronLeft, Download, CreditCard, Box, Calendar, MessageSquare, Briefcase, Save
} from 'lucide-react';
import { NairaIcon } from '../components/NairaIcon';
import { api } from '../api';
import { useNotification } from '../context/NotificationContext';
import { formatDateStandard } from '../utils/date';

export const Procurement: React.FC = () => {
  const { notify, confirm } = useNotification();
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [procurements, setProcurements] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ total_procured: 0, total_payables: 0, total_suppliers: 0, po_this_month: 0 });
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  // Modals
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showProcurementModal, setShowProcurementModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [supplierForm, setSupplierForm] = useState({
    name: '', contact_person: '', phone: '', email: '', address: ''
  });

  const [procForm, setProcForm] = useState({
    supplier_id: '',
    item_name: '',
    quantity_received: 1,
    unit_cost: 0,
    total_cost: 0,
    invoice_number: '',
    amount_paid: 0,
    balance: 0,
    status: 'Unpaid',
    purchase_date: new Date().toISOString().split('T')[0],
    received_by: localStorage.getItem('user_name') || 'Admin',
    notes: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sData, pData, stData] = await Promise.all([
        api.getSuppliers(),
        api.getPurchaseOrders(), 
        api.getProcurementStats()
      ]);
      setSuppliers(sData);
      setProcurements(pData);
      setStats(stData);
    } catch (err: any) {
      notify('error', 'Failed to load procurement data: ' + (err.message || 'Connection error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name) return notify('error', 'Supplier name is required');
    setIsSubmitting(true);
    try {
      await api.createSupplier(supplierForm);
      notify('success', `Supplier "${supplierForm.name}" registered`);
      setShowSupplierModal(false);
      setSupplierForm({ name: '', contact_person: '', phone: '', email: '', address: '' });
      fetchData();
    } catch (err: any) {
      notify('error', err.message || "Failed to create supplier");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateProcurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!procForm.supplier_id || !procForm.item_name) {
      return notify('error', 'Supplier and Item Name are required');
    }
    setIsSubmitting(true);
    try {
      const total = procForm.quantity_received * procForm.unit_cost;
      const balance = total - procForm.amount_paid;
      const status = balance <= 0 ? 'Paid' : (procForm.amount_paid > 0 ? 'Partial' : 'Unpaid');

      await api.createPurchaseOrder({
        ...procForm,
        total_cost: total,
        balance: balance,
        status: status
      });
      notify('success', 'Procurement record saved and inventory updated');
      setShowProcurementModal(false);
      setProcForm({
        supplier_id: '', item_name: '', quantity_received: 1, unit_cost: 0, total_cost: 0,
        invoice_number: '', amount_paid: 0, balance: 0, status: 'Unpaid',
        purchase_date: new Date().toISOString().split('T')[0],
        received_by: localStorage.getItem('user_name') || 'Admin', notes: ''
      });
      fetchData();
    } catch (err: any) {
      notify('error', err.message || "Failed to save procurement");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtering Logic
  const filteredData = procurements.filter(p => {
    const matchesSearch = 
      p.item_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const currentTotal = procForm.quantity_received * procForm.unit_cost;
  const currentBalance = currentTotal - procForm.amount_paid;

  if (loading && procurements.length === 0) {
    return (
      <div className="leh-page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 className="leh-spin" size={48} style={{ color: 'var(--leh-primary)', marginBottom: '16px' }} />
          <p style={{ color: 'var(--leh-text-grey)', fontWeight: 600 }}>Syncing Supply Chain Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="leh-page-container">
      {/* Header Section */}
      <div className="leh-page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 className="leh-page-title">Procurement & Supply Chain</h1>
            <p className="leh-page-subtitle">Manage hospital acquisitions, vendor settlements, and clinical stock intake</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={fetchData} 
              className="leh-btn-outline" 
              style={{ height: '42px', width: '42px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              data-tooltip="Sync supply chain data"
              aria-label="Refresh records"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={() => setShowSupplierModal(true)} 
              className="leh-btn-outline" 
              style={{ height: '42px' }}
              data-tooltip="Register new hospital supply partner"
            >
              <Truck size={14} /> REGISTER SUPPLIER
            </button>
            <button 
              onClick={() => setShowProcurementModal(true)} 
              className="leh-btn-primary" 
              style={{ height: '42px' }}
              data-tooltip="Initialize new clinical stock acquisition"
            >
              <Plus size={14} /> NEW PROCUREMENT
            </button>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="leh-stat-grid">
        <div className="leh-stat-card blue">
          <div className="leh-stat-card-top">
            <span className="leh-stat-title">Monthly Intake</span>
            <div className="leh-stat-icon-box"><ShoppingBag /></div>
          </div>
          <span className="leh-stat-value">₦{stats.total_procured?.toLocaleString()}</span>
          <div className="leh-stat-bottom">Total value of clinical acquisitions</div>
        </div>
        <div className="leh-stat-card red">
          <div className="leh-stat-card-top">
            <span className="leh-stat-title">Total Payables</span>
            <div className="leh-stat-icon-box"><NairaIcon /></div>
          </div>
          <span className="leh-stat-value">₦{stats.total_payables?.toLocaleString()}</span>
          <div className="leh-stat-bottom">Outstanding balances to suppliers</div>
        </div>
        <div className="leh-stat-card green">
          <div className="leh-stat-card-top">
            <span className="leh-stat-title">Active Suppliers</span>
            <div className="leh-stat-icon-box"><Users /></div>
          </div>
          <span className="leh-stat-value">{stats.total_suppliers}</span>
          <div className="leh-stat-bottom">Registered supply chain partners</div>
        </div>
        <div className="leh-stat-card amber">
          <div className="leh-stat-card-top">
            <span className="leh-stat-title">Monthly Orders</span>
            <div className="leh-stat-icon-box"><FileText /></div>
          </div>
          <span className="leh-stat-value">{stats.po_this_month}</span>
          <div className="leh-stat-bottom">Procurement cycles this month</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="leh-table-card" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div className="leh-search-box" style={{ flex: 1 }}>
            <Search className="leh-search-icon" size={18} />
            <input 
              type="text" 
              placeholder="Search by Item, Supplier, or Invoice #..." 
              className="leh-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="leh-search-clear" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px' }}>
            <Filter size={16} style={{ color: 'var(--leh-text-grey)' }} />
            <select 
              className="leh-search-input" 
              style={{ padding: '8px 12px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Unpaid">Unpaid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="leh-table-card">
        <div className="leh-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="leh-table-title">Procurement Registry</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
             <button 
               className="leh-refresh-btn" 
               onClick={() => window.print()} 
               data-tooltip="Print Procurement Registry"
               aria-label="Print registry"
             >
               <Printer size={14} />
             </button>
             <button 
               className="leh-refresh-btn" 
               onClick={fetchData} 
               data-tooltip="Refresh procurement records"
               aria-label="Refresh records"
             >
               <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
             </button>
          </div>
        </div>
        <div className="leh-table-wrapper">
          <table className="leh-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: '32px' }}>Date</th>
                <th>Supplier</th>
                <th>Item Description</th>
                <th>Qty</th>
                <th>Unit Cost</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th style={{ paddingRight: '32px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '48px', color: 'var(--leh-text-grey)' }}>
                    No procurement records found matching your criteria.
                  </td>
                </tr>
              ) : (
                paginatedData.map(p => (
                  <tr key={p.id}>
                    <td style={{ paddingLeft: '32px' }} className="leh-label">
                      {formatDateStandard(p.purchase_date)}
                    </td>
                    <td className="leh-table-bold">{p.supplier_name}</td>
                    <td className="leh-table-bold" style={{ color: 'var(--leh-primary)' }}>{p.item_name}</td>
                    <td>{p.quantity_received}</td>
                    <td>₦{p.unit_cost?.toLocaleString()}</td>
                    <td className="font-bold">₦{p.total_cost?.toLocaleString()}</td>
                    <td style={{ color: 'var(--leh-success)' }}>₦{p.amount_paid?.toLocaleString()}</td>
                    <td style={{ color: 'var(--leh-red)', fontWeight: 700 }}>₦{p.balance?.toLocaleString()}</td>
                    <td>
                      <span className={`leh-badge ${p.status === 'Paid' ? 'leh-badge-green' : p.status === 'Partial' ? 'leh-badge-amber' : 'leh-badge-red'}`}>
                        {p.status?.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ paddingRight: '32px', textAlign: 'right' }}>
                      <button className="leh-refresh-btn" style={{ marginLeft: 'auto' }}>
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div style={{ padding: '16px 32px', borderTop: '1px solid var(--leh-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--leh-text-grey)' }}>
              Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, filteredData.length)} of {filteredData.length} records
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="leh-refresh-btn" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <div style={{ display: 'flex', gap: '4px' }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                  <button 
                    key={num}
                    onClick={() => setCurrentPage(num)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      border: 'none',
                      background: currentPage === num ? 'var(--leh-primary)' : 'transparent',
                      color: currentPage === num ? 'white' : 'var(--leh-text-grey)',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <button 
                className="leh-refresh-btn" 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Supplier Modal */}
      {showSupplierModal && (
        <div className="leh-modal-overlay">
          <div className="leh-modal-content" style={{ maxWidth: '640px' }}>
            <div className="leh-modal-header">
              <div className="leh-modal-title">
                <Truck style={{ color: 'var(--leh-primary)' }} />
                <span>Supplier Registry Enrollment</span>
              </div>
              <button className="leh-modal-close" onClick={() => setShowSupplierModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="leh-modal-body">
              <form onSubmit={handleCreateSupplier}>
                {/* Section 1: Corporate Identity */}
                <div className="leh-form-section">
                  <h4 className="leh-form-section-title">
                    <Briefcase size={14} /> Corporate Identity
                  </h4>
                  <div className="leh-form-grid">
                    <div className="leh-form-group full-width">
                      <label className="leh-label">FULL COMPANY NAME</label>
                      <input 
                        type="text" 
                        className="leh-input" 
                        required 
                        placeholder="e.g. MedDirect Pharmaceuticals Ltd"
                        value={supplierForm.name}
                        onChange={(e) => setSupplierForm({...supplierForm, name: e.target.value})}
                      />
                    </div>
                    <div className="leh-form-group full-width">
                      <label className="leh-label">KEY LIAISON (CONTACT PERSON)</label>
                      <input 
                        type="text" 
                        className="leh-input" 
                        placeholder="e.g. Dr. John Adebayo"
                        value={supplierForm.contact_person}
                        onChange={(e) => setSupplierForm({...supplierForm, contact_person: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Communication Protocol */}
                <div className="leh-form-section">
                  <h4 className="leh-form-section-title">
                    <MessageSquare size={14} /> Communication Protocol
                  </h4>
                  <div className="leh-form-grid">
                    <div className="leh-form-group">
                      <label className="leh-label">PRIMARY PHONE</label>
                      <input 
                        type="text" 
                        className="leh-input" 
                        placeholder="+234..."
                        value={supplierForm.phone}
                        onChange={(e) => setSupplierForm({...supplierForm, phone: e.target.value})}
                      />
                    </div>
                    <div className="leh-form-group">
                      <label className="leh-label">OFFICIAL EMAIL</label>
                      <input 
                        type="email" 
                        className="leh-input" 
                        placeholder="procurement@company.com"
                        value={supplierForm.email}
                        onChange={(e) => setSupplierForm({...supplierForm, email: e.target.value})}
                      />
                    </div>
                    <div className="leh-form-group full-width">
                      <label className="leh-label">OPERATIONAL HEADQUARTERS</label>
                      <textarea 
                        className="leh-textarea" 
                        rows={2}
                        placeholder="Physical address for logistics and deliveries..."
                        value={supplierForm.address}
                        onChange={(e) => setSupplierForm({...supplierForm, address: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="leh-modal-footer" style={{ padding: '0', marginTop: '16px' }}>
                  <button type="button" onClick={() => setShowSupplierModal(false)} className="leh-btn-outline" style={{ flex: 1, height: '52px' }}>
                    CANCEL
                  </button>
                  <button type="submit" className="leh-btn-primary" style={{ flex: 2, height: '52px' }} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                    <span>{isSubmitting ? 'ENROLLING...' : 'AUTHORIZE PARTNER'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Procurement Modal */}
      {showProcurementModal && (
        <div className="leh-modal-overlay">
          <div className="leh-modal-content" style={{ maxWidth: '800px' }}>
            <div className="leh-modal-header">
              <div className="leh-modal-title">
                <Box style={{ color: 'var(--leh-primary)' }} />
                <span>New Clinical Procurement Entry</span>
              </div>
              <button className="leh-modal-close" onClick={() => setShowProcurementModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="leh-modal-body">
              <form onSubmit={handleCreateProcurement}>
                {/* Section 1: Logistics & Sourcing */}
                <div className="leh-form-section">
                  <h4 className="leh-form-section-title">
                    <Truck size={14} /> Sourcing & Logistics
                  </h4>
                  <div className="leh-form-grid">
                    <div className="leh-form-group full-width">
                      <label className="leh-label">SUPPLIER PARTNER</label>
                      <select 
                        className="leh-select" 
                        required
                        value={procForm.supplier_id}
                        onChange={(e) => setProcForm({...procForm, supplier_id: e.target.value})}
                      >
                        <option value="">Select an authorized supplier...</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
                      </select>
                    </div>
                    <div className="leh-form-group">
                      <label className="leh-label">INVOICE / RECEIPT NUMBER</label>
                      <input 
                        type="text" 
                        className="leh-input" 
                        required
                        placeholder="e.g. INV/2026/045"
                        value={procForm.invoice_number}
                        onChange={(e) => setProcForm({...procForm, invoice_number: e.target.value})}
                      />
                    </div>
                    <div className="leh-form-group">
                      <label className="leh-label">DATE OF ACQUISITION</label>
                      <input 
                        type="date" 
                        className="leh-input" 
                        required
                        value={procForm.purchase_date}
                        onChange={(e) => setProcForm({...procForm, purchase_date: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Asset Specification */}
                <div className="leh-form-section">
                  <h4 className="leh-form-section-title">
                    <Package size={14} /> Clinical Asset Specification
                  </h4>
                  <div className="leh-form-grid">
                    <div className="leh-form-group full-width">
                      <label className="leh-label">ITEM NAME (INVENTORY MAPPING)</label>
                      <input 
                        type="text" 
                        className="leh-input" 
                        required
                        placeholder="Search or enter exact stock item name..."
                        value={procForm.item_name}
                        onChange={(e) => setProcForm({...procForm, item_name: e.target.value})}
                      />
                    </div>
                    <div className="leh-form-group">
                      <label className="leh-label">QUANTITY RECEIVED</label>
                      <input 
                        type="number" 
                        className="leh-input" 
                        required 
                        min="1"
                        value={procForm.quantity_received}
                        onChange={(e) => setProcForm({...procForm, quantity_received: Number(e.target.value)})}
                      />
                    </div>
                    <div className="leh-form-group">
                      <label className="leh-label">UNIT COST (₦)</label>
                      <input 
                        type="number" 
                        className="leh-input" 
                        required 
                        min="0"
                        value={procForm.unit_cost}
                        onChange={(e) => setProcForm({...procForm, unit_cost: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Financial Settlement */}
                <div className="leh-form-section">
                  <h4 className="leh-form-section-title">
                    <CreditCard size={14} /> Financial Settlement Protocol
                  </h4>
                  <div className="leh-form-grid">
                    <div className="leh-form-group">
                      <label className="leh-label">AMOUNT PAID (₦)</label>
                      <input 
                        type="number" 
                        className="leh-input" 
                        min="0"
                        style={{ borderLeft: '4px solid var(--leh-green)' }}
                        value={procForm.amount_paid}
                        onChange={(e) => setProcForm({...procForm, amount_paid: Number(e.target.value)})}
                      />
                    </div>
                    <div className="leh-form-group">
                      <label className="leh-label">SETTLEMENT STATUS</label>
                      <div className={`leh-badge ${currentBalance <= 0 ? 'leh-badge-green' : (procForm.amount_paid > 0 ? 'leh-badge-amber' : 'leh-badge-red')}`} style={{ height: '48px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '900' }}>
                        {currentBalance <= 0 ? 'FULLY SETTLED' : (procForm.amount_paid > 0 ? 'PARTIAL PAYMENT' : 'ACCRUED LIABILITY')}
                      </div>
                    </div>
                    <div className="leh-form-group full-width">
                      <label className="leh-label">PROCUREMENT NOTES / DISCREPANCIES</label>
                      <textarea 
                        className="leh-textarea" 
                        rows={2}
                        placeholder="Record any stock discrepancies or specific payment terms..."
                        value={procForm.notes}
                        onChange={(e) => setProcForm({...procForm, notes: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Valuation Summary */}
                <div style={{ background: 'var(--leh-primary-light)', padding: '24px', borderRadius: '20px', border: '1px solid rgba(37, 99, 235, 0.1)', marginBottom: '32px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: 'var(--leh-primary)', letterSpacing: '0.05em' }}>TOTAL ACQUISITION VALUE</span>
                    <span style={{ fontSize: '20px', fontWeight: '900', color: 'var(--leh-primary)' }}>₦{currentTotal.toLocaleString()}</span>
                  </div>
                  <div style={{ height: '1px', background: 'rgba(37, 99, 235, 0.1)', margin: '12px 0' }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: currentBalance > 0 ? 'var(--leh-red)' : 'var(--leh-green)', letterSpacing: '0.05em' }}>
                      {currentBalance > 0 ? 'OUTSTANDING LIABILITY' : 'FINANCIAL CLEARANCE'}
                    </span>
                    <span style={{ fontSize: '20px', fontWeight: '900', color: currentBalance > 0 ? 'var(--leh-red)' : 'var(--leh-green)' }}>
                      ₦{Math.max(0, currentBalance).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="leh-modal-footer" style={{ padding: '0' }}>
                  <button type="button" onClick={() => setShowProcurementModal(false)} className="leh-btn-outline" style={{ flex: 1, height: '56px' }}>
                    CANCEL
                  </button>
                  <button type="submit" className="leh-btn-primary" style={{ flex: 2, height: '56px' }} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    <span>{isSubmitting ? 'PROCESSING...' : 'COMMIT PROCUREMENT RECORD'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
