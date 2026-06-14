import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, Trash2, ShoppingCart, 
  Plus, Minus,
  RefreshCcw,
  X,
  CreditCard,
  Banknote,
  Printer,
  ShieldCheck,
  AlertTriangle,
  Layers
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { buildReceiptHtml, printReceiptContent } from '../utils/printHelpers';
import { formatDateStandard } from '../utils/date';
import './Billing.css';

export const Billing: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [searchParams] = useSearchParams();
  
  // Tabs State
  const [activeTab, setActiveTab] = useState<'inventory' | 'pending' | 'history'>('inventory');
  
  // Pending State
  const [pendingBills, setPendingBills] = useState<any[]>([]);
  const [pendingSearch, setPendingSearch] = useState('');
  const [loadingPending, setLoadingPending] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [reconcileTx, setReconcileTx] = useState<any>(null);
  const [reconcileAmount, setReconcileAmount] = useState<number>(0);
  const [reconcilePaymentMethod, setReconcilePaymentMethod] = useState<'Cash' | 'POS' | 'Transfer' | 'Mixed'>('Cash');
  const [reconcileMixedBreakdown, setReconcileMixedBreakdown] = useState({ cash: 0, bank: 0 });
  
  // Patient Context State
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [patientResults, setPatientResults] = useState<any[]>([]);
  
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
  const [pendingInvestigations, setPendingInvestigations] = useState<any[]>([]);
  
  // History State
  const [transactions, setTransactions] = useState<any[]>([]);
  
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
      const fullCatalog = [
        ...services.map((s: any) => ({ ...s, type: 'service', identifier: s.id })),
        ...inventory.map((i: any) => ({ ...i, type: 'product', identifier: i.id }))
      ];
      setCatalog(fullCatalog);

      // Auto-select item from URL query parameter (e.g. auto_select=Registration)
      const autoSelect = searchParams.get('auto_select') || searchParams.get('autoSelect');
      if (autoSelect) {
        const itemToSelect = fullCatalog.find(
          (item: any) => item.name.toLowerCase() === autoSelect.toLowerCase()
        );
        if (itemToSelect) {
          setCart(prevCart => {
            const existingIdx = prevCart.findIndex(c => c.identifier === itemToSelect.identifier && c.type === itemToSelect.type);
            if (existingIdx >= 0) {
              const newCart = [...prevCart];
              newCart[existingIdx].qty += 1;
              return newCart;
            } else {
              return [...prevCart, { 
                ...itemToSelect, 
                qty: 1, 
                unit_price: itemToSelect.price,
                description: itemToSelect.name
              }];
            }
          });
        }
      }
    } catch (err) {
      notify('error', 'Catalog Synchronization Failure');
    }
  };



  // Live Patient Search
  useEffect(() => {
    if (patientSearchQuery.length >= 2) {
      const q = patientSearchQuery.toLowerCase();
      setPatientResults(patients.filter(p => 
        p.full_name?.toLowerCase().includes(q) || 
        p.id?.toString().toLowerCase().includes(q) ||
        (p.phone && p.phone.toString().includes(q))
      ));
    } else {
      setPatientResults([]);
    }
  }, [patientSearchQuery, patients]);

  // Fetch pending investigations when patient is selected
  useEffect(() => {
    if (selectedPatient) {
      api.getInvestigations(selectedPatient.id, undefined, 'Unpaid')
        .then(data => {
          setPendingInvestigations(data);
        })
        .catch(err => {
          console.error('[Billing] Failed to fetch pending investigations:', err);
        });
    } else {
      setPendingInvestigations([]);
    }
  }, [selectedPatient]);

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

  // Synchronize Tab from URL parameters
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'pending') {
      setActiveTab('pending');
    } else if (tab === 'history') {
      setActiveTab('history');
    } else if (tab === 'inventory') {
      setActiveTab('inventory');
    }
  }, [searchParams]);

  // Load History
  useEffect(() => {
    if (activeTab === 'history') {
      api.getTransactions()
        .then(data => setTransactions(Array.isArray(data) ? data : []))
        .finally(() => {});
    }
  }, [activeTab]);

  const fetchPendingBills = async () => {
    setLoadingPending(true);
    try {
      const data = await api.getDebtorsReport();
      setPendingBills(Array.isArray(data) ? data : []);
    } catch (err) {
      notify('error', 'Failed to fetch pending bills');
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'pending') {
      fetchPendingBills();
    }
  }, [activeTab]);

  const handleOpenReconcile = (tx: any) => {
    setReconcileTx(tx);
    setReconcileAmount(tx.balance_due);
    setReconcilePaymentMethod('Cash');
    setReconcileMixedBreakdown({ cash: tx.balance_due, bank: 0 });
    setShowReconcileModal(true);
  };

  const handleCloseReconcile = () => {
    setShowReconcileModal(false);
    setReconcileTx(null);
    setReconcileAmount(0);
  };

  const handleReconcileSubmit = async () => {
    if (!reconcileTx) return;
    if (reconcileAmount <= 0 || reconcileAmount > reconcileTx.balance_due) {
      return notify('error', 'Invalid payment amount');
    }

    setIsProcessing(true);
    try {
      const paymentData = {
        amount_paid: reconcileAmount,
        payment_method: reconcilePaymentMethod,
        payment_details: reconcilePaymentMethod === 'Mixed' ? reconcileMixedBreakdown : {},
        cashier: user?.full_name || 'System'
      };

      await api.recordPayment(reconcileTx.transaction_id, paymentData);
      notify('success', 'Payment recorded successfully!');

      // Fetch transaction details and items to print updated receipt
      try {
        const items = await api.getTransactionItems(reconcileTx.transaction_id);
        if (window.confirm('Payment recorded successfully. Print updated receipt?')) {
          const receiptHtml = buildReceiptHtml({
            receipt_no: reconcileTx.receipt_no,
            created_at: new Date(reconcileTx.visit_date),
            patient_id: reconcileTx.file_no,
            patient_name: reconcileTx.patient_name,
            total_amount: reconcileTx.total_amount,
            discount: reconcileTx.discount,
            amount_paid: reconcileTx.amount_paid + reconcileAmount,
            balance: reconcileTx.balance_due - reconcileAmount,
            payment_method: reconcilePaymentMethod,
            payment_details: reconcilePaymentMethod === 'Mixed' ? reconcileMixedBreakdown : {},
            cashier: user?.full_name || 'System',
            items: items
          }, user);
          printReceiptContent(receiptHtml);
        }
      } catch (errPrint) {
        console.error('Failed to auto-print receipt:', errPrint);
      }

      handleCloseReconcile();
      fetchPendingBills();
    } catch (err: any) {
      notify('error', err.message || 'Failed to record payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePatientSelect = (p: any, visitId: string | null = null) => {
    setSelectedPatient(p);
    setSelectedVisitId(visitId || p.current_visit_id || null);
    setPatientSearchQuery('');
    setPatientResults([]);
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
      setActiveTab('history');
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setIsProcessing(false);
    }
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
                  setCart([]); setDiscountPercent(0); setManualDiscount(0); setIsManualDiscountUnlocked(false); setAmountTendred(0); setSelectedPatient(null);
                  setShowCancelModal(false);
                }}
              >
                CONFIRM TERMINATION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECONCILE PAYMENT MODAL */}
      {showReconcileModal && reconcileTx && (
        <div className="leh-modal-overlay">
          <div className="leh-modal-content" style={{ maxWidth: '520px' }}>
            <div className="leh-modal-header">
              <div className="leh-modal-title">
                <Banknote style={{ color: 'var(--leh-primary)' }} />
                <span>Reconcile Pending Bill</span>
              </div>
              <button className="leh-modal-close" onClick={handleCloseReconcile}>
                <X size={20} />
              </button>
            </div>
            
            <div className="leh-modal-body" style={{ padding: '24px' }}>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>PATIENT NAME</span>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>{reconcileTx.patient_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>FILE NUMBER</span>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>{reconcileTx.file_no}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>RECEIPT NUMBER</span>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#3b82f6', fontFamily: 'monospace' }}>{reconcileTx.receipt_no || `TX-${reconcileTx.transaction_id}`}</span>
                </div>
                <div style={{ borderTop: '1px dashed #cbd5e1', margin: '12px 0' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>TOTAL AMOUNT</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>₦{reconcileTx.total_amount?.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>AMOUNT PAID YET</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#10b981' }}>₦{reconcileTx.amount_paid?.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#ef4444' }}>BALANCE DUE</span>
                  <span style={{ fontSize: '16px', fontWeight: '900', color: '#ef4444' }}>₦{reconcileTx.balance_due?.toLocaleString()}</span>
                </div>
              </div>

              <div className="amount-tendred-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                <label className="discount-label" style={{ fontSize: '12px', color: '#475569' }}>
                   AMOUNT TO RECORD (₦)
                </label>
                <input 
                  type="number" 
                  step="any"
                  className="billing-search-input" 
                  style={{ paddingLeft: '16px', height: '48px', fontSize: '18px', fontWeight: '900' }}
                  value={reconcileAmount}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setReconcileAmount(val);
                    if (reconcilePaymentMethod === 'Mixed') {
                      setReconcileMixedBreakdown({ cash: val, bank: 0 });
                    }
                  }}
                />
              </div>

              <label className="discount-label" style={{ fontSize: '12px', color: '#475569', marginBottom: '8px', display: 'block' }}>
                 PAYMENT CHANNEL
              </label>
              <div className="payment-mode-grid" style={{ marginBottom: '20px' }}>
                {[
                  { id: 'Cash', label: 'Cash' },
                  { id: 'POS', label: 'POS' },
                  { id: 'Transfer', label: 'Transfer' },
                  { id: 'Mixed', label: 'Mixed' }
                ].map(m => (
                  <button 
                    key={m.id}
                    type="button"
                    className={`mode-btn ${reconcilePaymentMethod === m.id ? 'active' : ''}`} 
                    onClick={() => {
                      setReconcilePaymentMethod(m.id as any);
                      if (m.id === 'Mixed') {
                        setReconcileMixedBreakdown({ cash: reconcileAmount, bank: 0 });
                      }
                    }}
                  >
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>

              {reconcilePaymentMethod === 'Mixed' && (
                <div style={{ background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '800', color: '#64748b' }}>CASH AMOUNT</label>
                      <input 
                        type="number"
                        className="leh-input" 
                        style={{ height: '36px', fontSize: '13px' }}
                        value={reconcileMixedBreakdown.cash}
                        onChange={(e) => {
                          const cashVal = parseFloat(e.target.value) || 0;
                          setReconcileMixedBreakdown({ ...reconcileMixedBreakdown, cash: cashVal, bank: Math.max(0, reconcileAmount - cashVal) });
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '800', color: '#64748b' }}>BANK / POS AMOUNT</label>
                      <input 
                        type="number"
                        className="leh-input" 
                        style={{ height: '36px', fontSize: '13px' }}
                        value={reconcileMixedBreakdown.bank}
                        onChange={(e) => {
                          const bankVal = parseFloat(e.target.value) || 0;
                          setReconcileMixedBreakdown({ ...reconcileMixedBreakdown, bank: bankVal, cash: Math.max(0, reconcileAmount - bankVal) });
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: '8px', textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: Math.abs((reconcileMixedBreakdown.cash + reconcileMixedBreakdown.bank) - reconcileAmount) < 0.01 ? 'var(--leh-green)' : 'var(--leh-red)' }}>
                      Total Mixed: ₦{(reconcileMixedBreakdown.cash + reconcileMixedBreakdown.bank).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                <button 
                  type="button"
                  className="btn-cancel-session" 
                  style={{ flex: 1, height: '48px', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  onClick={handleCloseReconcile}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  className="btn-finalize" 
                  style={{ flex: 2, height: '48px', borderRadius: '12px', marginTop: 0, padding: '0 20px', animation: 'none' }}
                  disabled={isProcessing || reconcileAmount <= 0 || reconcileAmount > reconcileTx.balance_due || (reconcilePaymentMethod === 'Mixed' && Math.abs((reconcileMixedBreakdown.cash + reconcileMixedBreakdown.bank) - reconcileAmount) > 0.01)}
                  onClick={handleReconcileSubmit}
                >
                  <div className="btn-finalize-inner">
                    {isProcessing ? <RefreshCcw className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                    <span>Finalize Settlement</span>
                  </div>
                </button>
              </div>
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
        <button className={`billing-tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
          PENDING BILLS / DEBTS
        </button>
        <button className={`billing-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          BILLING HISTORY
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
                           <div key={p.id} className="search-result-item" onClick={() => handlePatientSelect(p)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                 <span style={{ fontWeight: '800' }}>{p.full_name}</span>
                                 {p.phone && <span style={{ color: '#64748b', fontSize: '10px', marginTop: '2px' }}>Tel: {p.phone}</span>}
                              </div>
                              <span style={{ color: '#3b82f6', fontSize: '11px', fontWeight: '800', whiteSpace: 'nowrap' }}>#{p.id}</span>
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

               {selectedPatient && pendingInvestigations.length > 0 && (
                  <div className="billing-panel" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', marginTop: '16px' }}>
                     <div className="panel-header" style={{ padding: '16px 16px 8px 16px' }}>
                        <h3 className="panel-title" style={{ color: '#166534', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                           <Layers size={16} />
                           Pending Investigations ({pendingInvestigations.length})
                        </h3>
                     </div>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 16px 16px 16px' }}>
                        {pendingInvestigations.map(inv => (
                          <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                             <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '700', fontSize: '12px', color: '#0f172a' }}>{inv.test_name}</span>
                                <span style={{ fontSize: '10px', color: '#64748b' }}>₦{(inv.price || 0).toLocaleString()}</span>
                             </div>
                             <button 
                                className="leh-btn-icon" 
                                style={{ padding: '4px 8px', fontSize: '10px', background: 'var(--leh-primary)', color: 'white', borderRadius: '4px', fontWeight: '800', border: 'none', cursor: 'pointer' }}
                                onClick={() => {
                                  addToCart({
                                    identifier: inv.inventory_id,
                                    type: 'product',
                                    name: inv.test_name,
                                    price: inv.price || 0,
                                    category: 'Laboratory'
                                  });
                                  setPendingInvestigations(prev => prev.filter(p => p.id !== inv.id));
                                  notify('success', `Added ${inv.test_name} to cart`);
                                }}
                             >
                                ADD
                             </button>
                          </div>
                        ))}
                     </div>
                  </div>
               )}
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
                           <span className="patient-pill">{(selectedPatient.full_name || '').toUpperCase()}</span>
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
       ) : activeTab === 'pending' ? (
         <div className="billing-main-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="billing-panel">
               <div className="panel-header">
                  <h3 className="panel-title"><Banknote size={18} /> Pending Bills & Debtors</h3>
                  <span className="panel-badge">AWAITING SETTLEMENT</span>
               </div>
               
               <div style={{ position: 'relative', marginBottom: '20px' }}>
                  <Search style={{ position: 'absolute', left: '16px', top: '14px', color: '#9ca3af' }} size={18} />
                  <input 
                    type="text" 
                    placeholder="Search pending bills by patient name, file number, or receipt..." 
                    className="billing-search-input"
                    style={{ paddingLeft: '48px', height: '48px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
                    value={pendingSearch}
                    onChange={(e) => setPendingSearch(e.target.value)}
                  />
               </div>

               {loadingPending ? (
                 <div style={{ padding: '60px 0', textAlign: 'center' }}>
                   <RefreshCcw className="animate-spin" size={32} style={{ margin: '0 auto 12px', color: 'var(--leh-primary)' }} />
                   <p className="leh-label" style={{ fontWeight: '800' }}>Loading pending transactions...</p>
                 </div>
               ) : (
                 <div className="cart-table-container" style={{ maxHeight: '550px' }}>
                   <table className="cart-table">
                      <thead>
                         <tr>
                            <th>RECEIPT</th>
                            <th>PATIENT</th>
                            <th>FILE NUMBER</th>
                            <th style={{ textAlign: 'center' }}>OUTSTANDING</th>
                            <th>TOTAL BILLED</th>
                            <th>PAID</th>
                            <th>BALANCE DUE</th>
                            <th style={{ textAlign: 'center' }}>ACTION</th>
                         </tr>
                      </thead>
                      <tbody>
                         {pendingBills
                           .filter(tx => {
                             const q = pendingSearch.toLowerCase();
                             return (
                               (tx.patient_name || '').toLowerCase().includes(q) ||
                               (tx.file_no || '').toLowerCase().includes(q) ||
                               (tx.receipt_no || '').toLowerCase().includes(q)
                             );
                           })
                           .map(tx => (
                             <tr key={tx.transaction_id}>
                                <td style={{ fontWeight: '800', color: '#3b82f6' }}>{tx.receipt_no || `TX-${tx.transaction_id}`}</td>
                                <td>
                                   <div style={{ display: 'flex', flexDirection: 'column' }}>
                                     <span style={{ fontWeight: '800' }}>{tx.patient_name}</span>
                                     <span style={{ fontSize: '11px', color: '#64748b' }}>{tx.phone || 'No phone'}</span>
                                   </div>
                                </td>
                                <td><code>{tx.file_no}</code></td>
                                <td style={{ textAlign: 'center' }}>
                                   <span className={`leh-status-badge ${tx.days_outstanding > 30 ? 'red' : tx.days_outstanding > 7 ? 'amber' : 'blue'}`}>
                                     {tx.days_outstanding} Days
                                   </span>
                                </td>
                                <td>₦{tx.total_amount?.toLocaleString()}</td>
                                <td style={{ color: '#10b981', fontWeight: '800' }}>₦{tx.amount_paid?.toLocaleString()}</td>
                                <td style={{ color: '#ef4444', fontWeight: '800' }}>₦{tx.balance_due?.toLocaleString()}</td>
                                <td style={{ textAlign: 'center' }}>
                                   <button 
                                     className="btn-print-receipt" 
                                     style={{ padding: '6px 14px', height: 'auto', borderRadius: '8px', display: 'inline-flex', gap: '6px' }}
                                     onClick={() => handleOpenReconcile(tx)}
                                   >
                                      <CreditCard size={14} /> Reconcile
                                   </button>
                                </td>
                             </tr>
                           ))
                         }
                         {pendingBills.length === 0 && (
                           <tr>
                             <td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                               No pending bills found.
                             </td>
                           </tr>
                         )}
                      </tbody>
                   </table>
                 </div>
               )}
            </div>
         </div>
       ) : (
         <div className="billing-main-grid">
            <div className="billing-panel" style={{ gridColumn: 'span 2' }}>
               <h3 className="panel-title" style={{ marginBottom: '24px' }}>Billing History</h3>
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
