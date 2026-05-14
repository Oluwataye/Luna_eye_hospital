import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Search, Trash2, ShoppingCart, 
  Plus, Minus,
  RefreshCcw,
  Receipt,
  X,
  CreditCard,
  Banknote,
  Printer,
  History,
  ShieldCheck,
  ChevronDown,
  AlertTriangle,
  Layers
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { buildReceiptHtml, printReceiptContent } from '../utils/printHelpers';
import { formatDateStandard, formatDateTimeStandard } from '../utils/date';
import { PatientStatus } from '../constants/workflow';
import './Billing.css';

export const Billing: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notify } = useNotification();
  const [searchParams] = useSearchParams();
  
  // Tabs State
  const [activeTab, setActiveTab] = useState<'inventory' | 'history'>('inventory');
  
  // Patient Context State
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [patientDebt, setPatientDebt] = useState<number>(0);
  
  // Catalog State
  const [catalog, setCatalog] = useState<any[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogResults, setCatalogResults] = useState<any[]>([]);
  
  // Cart & Financial State
  const [cart, setCart] = useState<any[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [manualDiscount, setManualDiscount] = useState<number>(0);
  const [isManualDiscountUnlocked, setIsManualDiscountUnlocked] = useState(false);
  const [amountTendred, setAmountTendred] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'POS' | 'Transfer' | 'Mixed'>('Cash');
  const [mixedBreakdown, setMixedBreakdown] = useState({ cash: 0, bank: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  
  // History State
  const [transactions, setTransactions] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    fetchPatients();
    fetchCatalog();
  }, []);

  const fetchPatients = async () => {
    try {
      const data = await api.getPatients();
      setPatients(Array.isArray(data) ? data : []);
      
      const urlPatientId = searchParams.get('patient_id') || searchParams.get('patientId');
      const urlVisitId = searchParams.get('visit_id') || searchParams.get('visitId');
      
      if (urlPatientId) {
        const found = data.find((p: any) => String(p.id) === String(urlPatientId));
        if (found) handlePatientSelect(found, urlVisitId);
      }
    } catch (err) {
      notify('error', 'Registry Link Failure');
    }
  };

  const fetchCatalog = async () => {
    try {
      const [services, inventory] = await Promise.all([api.getServices(), api.getInventory()]);
      setCatalog([
        ...services.map((s: any) => ({ ...s, type: 'service', identifier: s.id })),
        ...inventory.map((i: any) => ({ ...i, type: 'product', identifier: i.id }))
      ]);
    } catch (err) {
      notify('error', 'Catalog Synchronization Failure');
    }
  };

  const fetchPatientDebt = async (patientId: string) => {
    try {
      // Reusing the debtors details endpoint but filtering for the selected patient
      const debtors = await api.getDebtorsReport();
      const patientTotal = debtors
        .filter((d: any) => String(d.file_no) === String(patientId))
        .reduce((sum: number, d: any) => sum + d.balance_due, 0);
      setPatientDebt(patientTotal);
    } catch (err) {
      console.error('Failed to fetch patient debt status');
    }
  };

  // Live Patient Search
  useEffect(() => {
    if (patientSearchQuery.length >= 2) {
      const q = patientSearchQuery.toLowerCase();
      setPatientResults(patients.filter(p => 
        p.full_name?.toLowerCase().includes(q) || p.id?.toString().includes(q)
      ));
    } else {
      setPatientResults([]);
    }
  }, [patientSearchQuery, patients]);

  // Live Catalog Search
  useEffect(() => {
    if (catalogSearch.length >= 3) {
      const q = catalogSearch.toLowerCase();
      setCatalogResults(catalog.filter(item => 
        item.name?.toLowerCase().includes(q) || 
        item.category?.toLowerCase().includes(q) ||
        item.id?.toString().includes(q)
      ).slice(0, 10));
    } else {
      setCatalogResults([]);
    }
  }, [catalogSearch, catalog]);

  // Load History
  useEffect(() => {
    if (activeTab === 'history') {
      setHistoryLoading(true);
      api.getTransactions()
        .then(data => setTransactions(Array.isArray(data) ? data : []))
        .finally(() => setHistoryLoading(false));
    }
  }, [activeTab]);

  const handlePatientSelect = (p: any, visitId: string | null = null) => {
    setSelectedPatient(p);
    setSelectedVisitId(visitId || p.current_visit_id || null);
    setPatientSearchQuery('');
    setPatientResults([]);
    fetchPatientDebt(p.id);
    notify('success', `Billing Context: ${p.full_name}`);
  };

  const addToCart = (item: any) => {
    const existingIdx = cart.findIndex(c => c.identifier === item.identifier && c.type === item.type);
    if (existingIdx >= 0) {
      const newCart = [...cart];
      newCart[existingIdx].qty += 1;
      setCart(newCart);
    } else {
      setCart([...cart, { 
        ...item, 
        qty: 1, 
        unit_price: item.price,
        description: item.name
      }]);
    }
    setCatalogSearch('');
    setCatalogResults([]);
  };

  const updateQty = (idx: number, delta: number) => {
    const newCart = [...cart];
    newCart[idx].qty = Math.max(1, newCart[idx].qty + delta);
    setCart(newCart);
  };

  const removeFromCart = (idx: number) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.unit_price * item.qty), 0);
  const discountAmount = ((subtotal * discountPercent) / 100) + manualDiscount;
  const totalPayable = Math.max(0, subtotal - discountAmount);
  const balance = Math.max(0, totalPayable - amountTendred);

  // Sync amount tendred when total payable changes, unless it was manually edited
  useEffect(() => {
    if (amountTendred === 0 || amountTendred > totalPayable) {
       setAmountTendred(totalPayable);
    }
  }, [totalPayable]);

  const handleProcessPayment = async () => {
    if (!selectedPatient) return notify('error', 'Select a patient first');
    if (cart.length === 0) return notify('error', 'Cart is empty');
    if (amountTendred < 0) return notify('error', 'Invalid payment amount');

    setIsProcessing(true);
    try {
      const transactionData = {
        patient_id: selectedPatient.id,
        visit_id: selectedVisitId,
        total_amount: subtotal,
        amount_paid: amountTendred,
        discount: discountAmount,
        payment_method: paymentMethod,
        payment_details: paymentMethod === 'Mixed' ? mixedBreakdown : {},
        items: cart.map(item => ({
          inventory_id: item.type === 'product' ? item.identifier : null,
          description: item.name,
          qty: item.qty,
          unit_price: item.unit_price
        })),
        cashier: user?.full_name || 'System'
      };

      const res = await api.createTransaction(transactionData);
      
      // Clinical Gate: Only update visit status if payment is FULL
      if (transactionData.visit_id && balance === 0) {
        await api.updateVisitStatus(transactionData.visit_id, 'Paid - Waiting for Triage', user?.full_name);
      }

      notify('success', balance === 0 ? 'Payment Settled' : 'Partial Payment Recorded');
      
      // Print Receipt
      if (window.confirm('Transaction successful. Print official receipt?')) {
        const receiptHtml = buildReceiptHtml({ 
          ...transactionData, 
          receipt_no: res.receipt_no, 
          created_at: new Date(),
          patient_name: selectedPatient.full_name,
          balance: balance
        }, user);
        printReceiptContent(receiptHtml);
      }

      // Reset
      setCart([]);
      setDiscountPercent(0);
      setManualDiscount(0);
      setIsManualDiscountUnlocked(false);
      setAmountTendred(0);
      setSelectedPatient(null);
      setPatientDebt(0);
      setActiveTab('history');
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateAge = (dob: string) => {
    if (!dob) return '—';
    const birthDate = new Date(dob);
    const difference = Date.now() - birthDate.getTime();
    return Math.floor(difference / (1000 * 60 * 60 * 24 * 365.25));
  };

  return (
    <div className="billing-page-container animate-fade-in">
      {showCancelModal && (
        <div className="leh-modal-overlay">
          <div className="leh-modal-content" style={{ maxWidth: '480px' }}>
            <div className="leh-modal-header">
              <div className="leh-modal-title">
                <AlertTriangle style={{ color: 'var(--leh-red)' }} />
                <span>Terminate Billing Session?</span>
              </div>
              <button className="leh-modal-close" onClick={() => setShowCancelModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="leh-modal-body">
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ 
                  width: '64px', 
                  height: '64px', 
                  background: '#fff1f2', 
                  color: '#e11d48', 
                  borderRadius: '20px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  margin: '0 auto 20px' 
                }}>
                  <X size={32} />
                </div>
                <p className="leh-label" style={{ fontSize: '15px', color: 'var(--leh-text-dark)', lineHeight: '1.6' }}>
                  You are about to cancel the current billing session for <br/>
                  <strong style={{ color: 'var(--leh-primary)' }}>{selectedPatient?.full_name || "this patient"}</strong>.
                </p>
                <p className="leh-label" style={{ marginTop: '12px' }}>
                  All unsaved items in the cart and discount configurations will be permanently cleared. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="leh-modal-footer">
              <button 
                className="leh-btn-outline"
                style={{ flex: 1, height: '48px' }}
                onClick={() => setShowCancelModal(false)}
              >
                RESUME SESSION
              </button>
              <button 
                className="leh-btn-primary"
                style={{ flex: 1, height: '48px', background: 'var(--leh-red)' }}
                onClick={() => {
                  setCart([]); setDiscountPercent(0); setManualDiscount(0); setIsManualDiscountUnlocked(false); setAmountTendred(0); setSelectedPatient(null); setPatientDebt(0);
                  setShowCancelModal(false);
                }}
              >
                CONFIRM TERMINATION
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="billing-header">
        <div className="billing-title-section">
          <h1>New Billing</h1>
        </div>

        <div className="billing-header-actions">
          <button className="btn-cancel-session" onClick={() => setShowCancelModal(true)}>
            Cancel Session
          </button>
          <button className="btn-print-receipt" onClick={() => {
            api.getTransactions().then((txs: any[]) => {
               if (!txs || txs.length === 0) return notify('info', 'No transactions found in system.');
               
               let targetTx;
               if (selectedPatient) {
                 targetTx = txs.find(tx => String(tx.patient_id) === String(selectedPatient.id));
                 if (!targetTx) return notify('info', `No recent receipts found for ${selectedPatient.full_name}.`);
               } else {
                 targetTx = txs[0]; // Absolute latest
                 notify('info', `Printing most recent system receipt: ${targetTx.receipt_no}`);
               }

               const html = buildReceiptHtml(targetTx, user, true);
               printReceiptContent(html);
            }).catch(() => notify('error', 'Failed to fetch receipts.'));
          }}>
            <Printer size={16} /> Print Last Receipt
          </button>
        </div>
      </header>

      <div className="billing-tabs-container">
        <button className={`billing-tab ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}>
          STANDARD BILLING
        </button>
        <button className={`billing-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          CORPORATE / HMO BILLING
        </button>
      </div>

      {/* PATIENT CONTEXT BAR */}
      <section className="patient-context-bar">
         <div className="context-field">
            <span className="context-field-label">PATIENT NAME</span>
            <span className="context-field-value" style={{ color: '#0f172a', textTransform: 'uppercase' }}>{selectedPatient ? selectedPatient.full_name : '—'}</span>
         </div>
         <div className="context-field">
            <span className="context-field-label">FILE NUMBER</span>
            <span className="context-field-value">{selectedPatient ? selectedPatient.id : '—'}</span>
         </div>
         <div className="context-field">
            <span className="context-field-label">VISIT DATE</span>
            <span className="context-field-value">{selectedPatient ? formatDateStandard(new Date()) : '—'}</span>
         </div>
         <div className="context-field">
            <span className="context-field-label">ATTENDING CLINICIAN</span>
            <span className="context-field-value">{selectedPatient ? 'Medical Team' : '—'}</span>
         </div>
      </section>

      {activeTab === 'inventory' ? (
        <div className="billing-main-grid">
           {/* LEFT PANEL */}
           <div className="billing-left-panel">
              <div className="billing-panel">
                 <div className="panel-header">
                    <h3 className="panel-title"><Search size={18} /> Item & Service Search</h3>
                    <span className="panel-badge">F2 TO FOCUS</span>
                 </div>
                 <div className="leh-search-box" style={{ marginBottom: '16px' }}>
                    <Search size={18} className="leh-search-icon" />
                    <input 
                      ref={searchInputRef}
                      placeholder="Search services, drugs, lens..." 
                      value={catalogSearch} 
                      onChange={(e) => setCatalogSearch(e.target.value)} 
                    />
                    {catalogResults.length > 0 && (
                      <div className="search-results-popover">
                         {catalogResults.map(item => (
                           <div key={item.identifier + item.type} className="search-result-item" onClick={() => addToCart(item)}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                 <span style={{ fontWeight: '800', fontSize: '13px' }}>{item.name}</span>
                                 <span style={{ fontSize: '10px', color: '#94a3b8' }}>{item.category}</span>
                              </div>
                              <span style={{ fontWeight: '900', color: '#3b82f6' }}>₦{item.price?.toLocaleString()}</span>
                           </div>
                         ))}
                      </div>
                    )}
                 </div>
              </div>

              <div className="billing-panel">
                 <div className="panel-header">
                    <h3 className="panel-title" style={{ color: '#0f172a' }}>
                       <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', border: '1px solid #e2e8f0' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                       </div> 
                       Patient Details
                    </h3>
                 </div>
                 <div className="search-input-wrapper" style={{ marginBottom: '16px' }}>
                    <input 
                      className="billing-search-input" 
                      style={{ paddingLeft: '16px' }}
                      placeholder="Search patient name or ID..." 
                      value={patientSearchQuery} 
                      onChange={(e) => setPatientSearchQuery(e.target.value)} 
                    />
                    {patientResults.length > 0 && (
                      <div className="search-results-popover">
                         {patientResults.map(p => (
                           <div key={p.id} className="search-result-item" onClick={() => handlePatientSelect(p)}>
                              <span style={{ fontWeight: '800' }}>{p.full_name}</span>
                              <span style={{ color: '#3b82f6', fontSize: '11px' }}>#{p.id}</span>
                           </div>
                         ))}
                      </div>
                    )}
                 </div>
                 
                 <div style={{ padding: '0 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                       <span style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>FILE NUMBER</span>
                       <span style={{ fontSize: '14px', fontWeight: '800', color: '#64748b' }}>{selectedPatient ? selectedPatient.id : '—'}</span>
                    </div>
                 </div>
              </div>
           </div>

           {/* RIGHT PANEL */}
           <div className="billing-right-panel">
              <div className="billing-panel" style={{ padding: '0' }}>
                 <div className="panel-header" style={{ padding: '24px 24px 0 24px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                       <h3 className="panel-title" style={{ background: '#e2e8f0', padding: '4px 8px', borderRadius: '4px' }}>
                          <ShoppingCart size={16} /> Current Billing
                       </h3>
                       {selectedPatient && (
                          <span className="patient-pill">{selectedPatient.full_name.toUpperCase()}</span>
                       )}
                    </div>
                 </div>
                 
                 <div style={{ padding: '0 24px' }}>
                    <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '0 0 24px 0' }} />
                 </div>

                 {/* Cart Items Area */}
                 <div className="cart-table-container" style={{ padding: '0 24px' }}>
                    {cart.length === 0 ? (
                      <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0', fontWeight: '600' }}>No items added yet. Search and add services above.</p>
                    ) : (
                      <table className="cart-table">
                         <thead>
                            <tr>
                               <th>ITEM</th>
                               <th>QTY</th>
                               <th>PRICE</th>
                               <th style={{ textAlign: 'right' }}>TOTAL</th>
                            </tr>
                         </thead>
                         <tbody>
                            {cart.map((item, idx) => (
                              <tr key={idx}>
                                 <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                       <button className="leh-icon-btn red" style={{ padding: '2px' }} onClick={() => removeFromCart(idx)}><Trash2 size={12} /></button>
                                       <span>{item.name}</span>
                                    </div>
                                 </td>
                                 <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                       <button className="qty-btn" style={{ width: '20px', height: '20px' }} onClick={() => updateQty(idx, -1)}><Minus size={10} /></button>
                                       <span>{item.qty}</span>
                                       <button className="qty-btn" style={{ width: '20px', height: '20px' }} onClick={() => updateQty(idx, 1)}><Plus size={10} /></button>
                                    </div>
                                 </td>
                                 <td>₦{item.unit_price?.toLocaleString()}</td>
                                 <td style={{ textAlign: 'right', fontWeight: '900' }}>₦{(item.qty * item.unit_price).toLocaleString()}</td>
                              </tr>
                            ))}
                         </tbody>
                      </table>
                    )}
                 </div>

                 <div style={{ padding: '24px' }}>
                    <div className="discount-container">
                       <div className="discount-field">
                          <span className="discount-label">OVERALL DISCOUNT %</span>
                          <div className="discount-input-row">
                             <input 
                               className="discount-input" 
                               type="number"
                               value={discountPercent} 
                               onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)} 
                             />
                             <span className="discount-symbol">%</span>
                          </div>
                       </div>
                       
                       <div className="discount-field">
                          <span className="discount-label">
                             MANUAL DISCOUNT (₦) 
                             <button onClick={() => {
                                if(isManualDiscountUnlocked) return;
                                const pin = window.prompt("Enter Admin PIN to unlock manual discount:");
                                if (pin === "1234" || pin === "ADMIN") {
                                  setIsManualDiscountUnlocked(true);
                                  notify('success', 'Manual discount unlocked');
                                } else if (pin) {
                                  notify('error', 'Invalid Admin PIN');
                                }
                             }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                               <ShieldCheck size={10} color={isManualDiscountUnlocked ? '#10b981' : '#94a3b8'} />
                             </button>
                          </span>
                          <div className="discount-input-row">
                             <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '14px', fontWeight: '800' }}>₦</span>
                                <input 
                                  className="discount-input" 
                                  type="number"
                                  style={{ width: '120px', paddingLeft: '24px', background: isManualDiscountUnlocked ? 'white' : '#f1f5f9', color: isManualDiscountUnlocked ? '#0f172a' : '#64748b' }}
                                  value={manualDiscount}
                                  readOnly={!isManualDiscountUnlocked}
                                  onChange={(e) => setManualDiscount(parseFloat(e.target.value) || 0)}
                                />
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* Preserved Settlement logic */}
                    <div className="settlement-card-light">
                       <div className="settlement-line-light">
                          <span>Subtotal</span>
                          <span>₦{subtotal.toLocaleString()}</span>
                       </div>
                       <div className="settlement-line-light">
                          <span>Discount</span>
                          <span style={{ color: '#ef4444' }}>-₦{discountAmount.toLocaleString()}</span>
                       </div>
                       <div className="settlement-grand-light">
                          <span>Net Payable</span>
                          <span>₦{totalPayable.toLocaleString()}</span>
                       </div>

                       <div className="amount-tendred-section" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                          <span className="discount-label" style={{ marginBottom: '8px' }}>AMOUNT PAID (₦)</span>
                          <input 
                            className="billing-search-input" 
                            style={{ textAlign: 'center', fontSize: '18px', fontWeight: '900', height: '48px', padding: '0' }}
                            value={amountTendred} 
                            onChange={(e) => setAmountTendred(parseFloat(e.target.value) || 0)} 
                          />
                       </div>
                       
                       <div className="payment-mode-grid" style={{ marginTop: '16px' }}>
                           {[
                             { id: 'Cash', icon: Banknote },
                             { id: 'POS', icon: CreditCard },
                             { id: 'Transfer', icon: RefreshCcw },
                             { id: 'Mixed', icon: Layers }
                           ].map(m => (
                             <button 
                               key={m.id} 
                               className={`mode-btn ${paymentMethod === m.id ? 'active' : ''}`} 
                               onClick={() => setPaymentMethod(m.id as any)}
                               data-tooltip={`Select ${m.id} payment method`}
                               aria-label={`Pay via ${m.id}`}
                             >
                                <m.icon size={20} />
                                <span>{m.id}</span>
                             </button>
                           ))}
                        </div>

                       {paymentMethod === 'Mixed' && (
                         <div style={{ marginTop: '16px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                           <p className="leh-label" style={{ fontSize: '10px', fontWeight: '900', marginBottom: '12px', color: 'var(--leh-primary)' }}>SPLIT PAYMENT BREAKDOWN</p>
                           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                             <div className="leh-form-group">
                               <label className="leh-label" style={{ fontSize: '9px' }}>CASH PORTION (₦)</label>
                               <input 
                                 type="number" 
                                 className="leh-input" 
                                 style={{ height: '36px', fontSize: '13px' }}
                                 value={mixedBreakdown.cash}
                                 onChange={(e) => setMixedBreakdown({ ...mixedBreakdown, cash: parseFloat(e.target.value) || 0 })}
                               />
                             </div>
                             <div className="leh-form-group">
                               <label className="leh-label" style={{ fontSize: '9px' }}>BANK/POS PORTION (₦)</label>
                               <input 
                                 type="number" 
                                 className="leh-input" 
                                 style={{ height: '36px', fontSize: '13px' }}
                                 value={mixedBreakdown.bank}
                                 onChange={(e) => setMixedBreakdown({ ...mixedBreakdown, bank: parseFloat(e.target.value) || 0 })}
                               />
                             </div>
                           </div>
                           <div style={{ marginTop: '8px', textAlign: 'right' }}>
                             <span style={{ fontSize: '11px', fontWeight: '800', color: Math.abs((mixedBreakdown.cash + mixedBreakdown.bank) - totalPayable) < 0.01 ? 'var(--leh-green)' : 'var(--leh-red)' }}>
                               Total Mixed: ₦{(mixedBreakdown.cash + mixedBreakdown.bank).toLocaleString()}
                             </span>
                           </div>
                         </div>
                       )}

                        <button 
                          className={`btn-finalize ${isProcessing ? 'processing' : ''}`} 
                          disabled={isProcessing || cart.length === 0 || (paymentMethod === 'Mixed' && Math.abs((mixedBreakdown.cash + mixedBreakdown.bank) - totalPayable) > 0.01)} 
                          onClick={handleProcessPayment} 
                          data-tooltip={paymentMethod === 'Mixed' && Math.abs((mixedBreakdown.cash + mixedBreakdown.bank) - totalPayable) > 0.01 ? "Mixed payment amounts must match total payable" : "Process this transaction"}
                        >
                           <div className="btn-finalize-inner">
                              {isProcessing ? <RefreshCcw className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                              <span>{balance > 0 ? 'RECORD PARTIAL PAYMENT' : 'PROCESS PAYMENT'}</span>
                           </div>
                           {!isProcessing && (
                             <div className="btn-finalize-amount">
                                ₦{totalPayable.toLocaleString()}
                             </div>
                           )}
                        </button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      ) : (
        <div className="billing-main-grid">
           <div className="billing-panel" style={{ gridColumn: 'span 2' }}>
              <h3 className="panel-title" style={{ marginBottom: '24px' }}>Corporate / HMO History</h3>
              <table className="cart-table">
                 <thead>
                    <tr>
                       <th>RECEIPT</th>
                       <th>PATIENT</th>
                       <th style={{ textAlign: 'center' }}>TIMESTAMP</th>
                       <th>TOTAL</th>
                       <th>PAID</th>
                       <th>BALANCE</th>
                       <th>STATUS</th>
                       <th style={{ textAlign: 'center' }}>ACTION</th>
                    </tr>
                 </thead>
                 <tbody>
                    {transactions.map(tx => (
                      <tr key={tx.id}>
                         <td style={{ fontWeight: '800', color: '#3b82f6' }}>{tx.receipt_no}</td>
                         <td>{tx.patient_name}</td>
                         <td>
                            <div className="leh-date-display" style={{ alignItems: 'center' }}>
                               <span className="leh-date-main">
                                 {formatDateStandard(tx.created_at)}
                               </span>
                              <span className="leh-date-sub">
                                {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                         </td>
                         <td>₦{tx.total_amount?.toLocaleString()}</td>
                         <td style={{ color: '#10b981', fontWeight: '800' }}>₦{tx.amount_paid?.toLocaleString()}</td>
                         <td style={{ color: tx.balance > 0 ? '#ef4444' : '#0f172a' }}>₦{tx.balance?.toLocaleString()}</td>
                         <td><span className={`panel-badge`}>{tx.status}</span></td>
                         <td style={{ textAlign: 'center' }}>
                            <button 
                              className="leh-btn-icon" 
                              style={{ padding: '4px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                              onClick={() => {
                                const html = buildReceiptHtml(tx, user, true);
                                printReceiptContent(html);
                              }}
                              title="Reprint Receipt"
                            >
                               <Printer size={14} color="#3b82f6" />
                            </button>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {/* POS Footer */}
      <div className="pos-footer">
         <span className="pos-footer-text">LUNA EYE HOSPITAL POS • V2.2.0</span>
         <span className="pos-footer-text">BUILD: 07/05/2026 14:52</span>
      </div>
    </div>
  );
};
