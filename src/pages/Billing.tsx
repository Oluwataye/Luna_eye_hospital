import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  Layers,
  Sliders,
  Lock,
  CheckCircle2,
  Users
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { formatDateStandard } from '../utils/date';
import { dispatchReceiptPrint } from '../utils/thermalPrinter';
import { getPrinterSettings } from '../utils/printerConfig';
import ThermalPrinterModal from '../components/ThermalPrinterModal';
import { InnerNavTabs } from '../components/InnerNavTabs';
import './Billing.css';

export interface BillingSession {
  id: string;
  selectedPatient: any;
  selectedVisitId: string | null;
  cart: any[];
  discountPercent: number;
  manualDiscount: number;
  isManualDiscountUnlocked: boolean;
  amountTendred: number;
  paymentMethod: 'Cash' | 'POS' | 'Transfer' | 'Mixed';
  mixedBreakdown: { cash: number; bank: number };
  createdAt: number;
}

const BILLING_SESSIONS_STORAGE_KEY = 'luna_billing_multi_sessions_v2';
const LEGACY_DRAFT_KEY = 'luna_billing_active_draft_v1';

const createDefaultSession = (id = 'sess-1'): BillingSession => ({
  id,
  selectedPatient: null,
  selectedVisitId: null,
  cart: [],
  discountPercent: 0,
  manualDiscount: 0,
  isManualDiscountUnlocked: false,
  amountTendred: 0,
  paymentMethod: 'Cash',
  mixedBreakdown: { cash: 0, bank: 0 },
  createdAt: Date.now()
});

export const Billing: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
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
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
  
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

  // Concurrent Multi-Session State
  const [sessions, setSessions] = useState<BillingSession[]>([createDefaultSession('sess-1')]);
  const [activeSessionId, setActiveSessionId] = useState<string>('sess-1');
  const [isRestoredFromDraft, setIsRestoredFromDraft] = useState(false);
  const isDraftHydratedRef = useRef(false);
  const handleProcessPaymentRef = useRef<() => void>(() => {});
  const autoPopulatedKeyRef = useRef<string | null>(null);
  
  // History State
  const [transactions, setTransactions] = useState<any[]>([]);
  
  // Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPrinterConfig, setShowPrinterConfig] = useState(false);
  const [familyPaymentSuccess, setFamilyPaymentSuccess] = useState<{
    familyId: string | number;
    familyName: string;
    receiptNo: string;
    balance?: number;
    amountPaid?: number;
  } | null>(null);

  // Settings & Supervisor Authorization States
  const [clinicSettings, setClinicSettings] = useState<any>({});
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  const [supervisorUsername, setSupervisorUsername] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [isVerifyingSupervisor, setIsVerifyingSupervisor] = useState(false);
  const [supervisorAuth, setSupervisorAuth] = useState<{
    id?: number;
    username: string;
    password?: string;
    full_name: string;
    role: string;
  } | null>(null);
  const [discountReason, setDiscountReason] = useState('');
  const [discountNote, setDiscountNote] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemSearchRef = useRef<HTMLDivElement>(null);
  const patientSearchRef = useRef<HTMLDivElement>(null);

  // Global Keyboard Shortcuts (F2: Search, F9 / Ctrl+Enter: Quick Checkout)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'F9' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
        e.preventDefault();
        handleProcessPaymentRef.current();
      }
      if (e.key === 'Escape') {
        setCatalogResults([]);
        setPatientResults([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close search popovers when clicking outside the search widgets
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (itemSearchRef.current && !itemSearchRef.current.contains(e.target as Node)) {
        setCatalogResults([]);
      }
      if (patientSearchRef.current && !patientSearchRef.current.contains(e.target as Node)) {
        setPatientResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchPatients();
    fetchCatalog();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await api.getSettings();
      setClinicSettings(data || {});
    } catch (e) {
      console.warn('Failed to load clinic settings in Billing:', e);
    }
  };

  const fetchPatients = async () => {
    try {
      const data = await api.getPatients({ limit: 200 });
      setPatients(Array.isArray(data) ? data : []);
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
    } catch (err) {
      notify('error', 'Catalog Synchronization Failure');
    }
  };

  // Helper: Snapshot active states into a BillingSession
  const getActiveSessionSnapshot = (id = activeSessionId): BillingSession => ({
    id,
    selectedPatient,
    selectedVisitId,
    cart,
    discountPercent,
    manualDiscount,
    isManualDiscountUnlocked,
    amountTendred,
    paymentMethod,
    mixedBreakdown,
    createdAt: Date.now()
  });

  // Helper: Apply session into React states
  const applySessionToState = (s: BillingSession) => {
    setSelectedPatient(s.selectedPatient);
    setSelectedVisitId(s.selectedVisitId);
    setCart(Array.isArray(s.cart) ? s.cart : []);
    setDiscountPercent(s.discountPercent || 0);
    setManualDiscount(s.manualDiscount || 0);
    setIsManualDiscountUnlocked(s.isManualDiscountUnlocked || false);
    setAmountTendred(s.amountTendred || 0);
    setPaymentMethod(s.paymentMethod || 'Cash');
    setMixedBreakdown(s.mixedBreakdown || { cash: 0, bank: 0 });
    setActiveSessionId(s.id);
  };

  const switchSession = (targetId: string) => {
    if (targetId === activeSessionId) return;
    const currentSnap = getActiveSessionSnapshot();
    const updated = sessions.map(s => s.id === activeSessionId ? currentSnap : s);
    const target = updated.find(s => s.id === targetId);
    if (!target) return;
    setSessions(updated);
    applySessionToState(target);
  };

  const addNewSession = () => {
    if (sessions.length >= 5) {
      return notify('warning', 'Maximum 5 concurrent billing sessions allowed');
    }
    const currentSnap = getActiveSessionSnapshot();
    const newSession = createDefaultSession(`sess-${Date.now()}`);
    const updated = [...sessions.map(s => s.id === activeSessionId ? currentSnap : s), newSession];
    setSessions(updated);
    applySessionToState(newSession);
    notify('info', `Session ${updated.length} created`);
  };

  const closeSession = (idToClose: string) => {
    if (sessions.length <= 1) {
      const cleared = createDefaultSession('sess-1');
      setSessions([cleared]);
      applySessionToState(cleared);
      notify('info', 'Session reset');
      return;
    }

    if (idToClose === activeSessionId) {
      const remaining = sessions.filter(s => s.id !== idToClose);
      const nextSession = remaining[0];
      setSessions(remaining);
      applySessionToState(nextSession);
    } else {
      setSessions(prev => prev.filter(s => s.id !== idToClose));
    }
    notify('info', 'Billing session closed');
  };

  // Hydrate sessions from localStorage on mount (supports multi-sessions & legacy single draft)
  useEffect(() => {
    const urlPatientId = searchParams.get('patient_id') || searchParams.get('patientId');
    const autoSelect = searchParams.get('auto_select') || searchParams.get('autoSelect');

    try {
      const rawMulti = localStorage.getItem(BILLING_SESSIONS_STORAGE_KEY);
      if (rawMulti) {
        const parsed = JSON.parse(rawMulti);
        if (parsed && Array.isArray(parsed.sessions) && parsed.sessions.length > 0) {
          setSessions(parsed.sessions);
          const targetId = parsed.activeSessionId || parsed.sessions[0].id;
          const active = parsed.sessions.find((s: any) => s.id === targetId) || parsed.sessions[0];
          setActiveSessionId(active.id);
          if (!urlPatientId && !autoSelect) {
            applySessionToState(active);
            setIsRestoredFromDraft(true);
            notify('info', 'Restored open billing sessions');
          }
        }
      } else {
        // Fallback check for legacy single draft
        const rawSingle = localStorage.getItem(LEGACY_DRAFT_KEY);
        if (rawSingle) {
          const draft = JSON.parse(rawSingle);
          if (draft && (draft.selectedPatient || (Array.isArray(draft.cart) && draft.cart.length > 0))) {
            const initialSession: BillingSession = {
              id: 'sess-1',
              selectedPatient: draft.selectedPatient || null,
              selectedVisitId: draft.selectedVisitId || null,
              cart: Array.isArray(draft.cart) ? draft.cart : [],
              discountPercent: draft.discountPercent || 0,
              manualDiscount: draft.manualDiscount || 0,
              isManualDiscountUnlocked: !!draft.isManualDiscountUnlocked,
              amountTendred: draft.amountTendred || 0,
              paymentMethod: draft.paymentMethod || 'Cash',
              mixedBreakdown: draft.mixedBreakdown || { cash: 0, bank: 0 },
              createdAt: Date.now()
            };
            setSessions([initialSession]);
            if (!urlPatientId && !autoSelect) {
              applySessionToState(initialSession);
              setIsRestoredFromDraft(true);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Billing] Error loading sessions from storage:', err);
    }
    isDraftHydratedRef.current = true;
  }, []);

  // Autosave multi-sessions to localStorage
  useEffect(() => {
    if (!isDraftHydratedRef.current) return;

    const currentSnap = getActiveSessionSnapshot();
    const updated = sessions.map(s => s.id === activeSessionId ? currentSnap : s);
    try {
      localStorage.setItem(BILLING_SESSIONS_STORAGE_KEY, JSON.stringify({
        sessions: updated,
        activeSessionId
      }));
    } catch (e) {
      console.warn('[Billing] Storage write failed:', e);
    }
  }, [sessions, activeSessionId, cart, selectedPatient, selectedVisitId, discountPercent, manualDiscount, isManualDiscountUnlocked, amountTendred, paymentMethod, mixedBreakdown]);

  // Synchronize patient context from URL parameters dynamically
  useEffect(() => {
    const urlPatientId = searchParams.get('patient_id') || searchParams.get('patientId');
    const urlVisitId = searchParams.get('visit_id') || searchParams.get('visitId');
    const urlPatientName = searchParams.get('patient_name') || searchParams.get('patientName');

    if (!urlPatientId) return;

    // Skip if this patient is already selected with current visit
    if (selectedPatient && String(selectedPatient.id).trim().toLowerCase() === String(urlPatientId).trim().toLowerCase()) {
      if (urlVisitId && selectedVisitId !== urlVisitId) {
        setSelectedVisitId(urlVisitId);
      }
      return;
    }

    let isMounted = true;

    const resolvePatient = async () => {
      // 1. Check local patients state if loaded
      const found = patients.find((p: any) => 
        String(p.id).trim().toLowerCase() === String(urlPatientId).trim().toLowerCase()
      );
      if (found) {
        if (isMounted) handlePatientSelect(found, urlVisitId);
        return;
      }

      // 2. Fetch directly from server by ID
      try {
        const remote = await api.getPatient(urlPatientId);
        if (remote && isMounted) {
          handlePatientSelect(remote, urlVisitId);
          return;
        }
      } catch (err) {
        console.warn('[Billing] Direct patient fetch failed, using fallback URL context:', err);
      }

      // 3. Fallback to URL metadata so billing context is never lost
      if (isMounted) {
        const fallback = {
          id: urlPatientId,
          full_name: urlPatientName ? decodeURIComponent(urlPatientName) : `Patient #${urlPatientId}`,
          current_visit_id: urlVisitId || null,
          payment_category: 'Standard',
          family_id: searchParams.get('family_id') || null,
          is_family: searchParams.get('is_family') === '1'
        };
        handlePatientSelect(fallback, urlVisitId);
      }
    };

    resolvePatient();

    return () => {
      isMounted = false;
    };
  }, [searchParams, patients]);

  // Auto-select and populate registration card / service item into active cart
  useEffect(() => {
    const autoSelect = searchParams.get('auto_select') || searchParams.get('autoSelect');
    const urlPatientId = searchParams.get('patient_id') || searchParams.get('patientId');
    const urlCardFee = searchParams.get('card_fee') || searchParams.get('cardFee');

    if (!autoSelect) return;

    // Build unique key to avoid duplicate population during benign re-renders
    const populateKey = `${urlPatientId || 'unknown'}-${autoSelect}`;
    if (autoPopulatedKeyRef.current === populateKey) return;

    // Flexible matching: check exact match, or 'individual' / 'family' / 'registration'
    const targetQuery = autoSelect.toLowerCase().trim();
    let itemToSelect: any = null;

    if (catalog.length > 0) {
      itemToSelect = catalog.find((item: any) => {
        const n = (item.name || '').toLowerCase().trim();
        return n === targetQuery || 
          (targetQuery.includes('individual') && n.includes('individual')) ||
          (targetQuery.includes('family') && n.includes('family')) ||
          (targetQuery === 'registration' && (n.includes('individual') || n === 'registration'));
      });
    }

    // Determine price: from catalog item, URL param, or card defaults
    let fallbackPrice = 3000;
    if (urlCardFee) {
      fallbackPrice = parseFloat(urlCardFee) || 3000;
    } else if (targetQuery.includes('family')) {
      fallbackPrice = 10000;
    }

    const itemName = itemToSelect ? itemToSelect.name : (
      targetQuery.includes('family') ? 'Family Card' : 
      (targetQuery.includes('individual') ? 'Individual Card' : autoSelect)
    );
    const itemPrice = itemToSelect ? (Number(itemToSelect.price) || fallbackPrice) : fallbackPrice;

    const cartItemToAdd = {
      ...(itemToSelect || {}),
      id: itemToSelect ? itemToSelect.id : (targetQuery.includes('family') ? 'srv-family-card' : 'srv-individual-card'),
      identifier: itemToSelect ? itemToSelect.identifier : (targetQuery.includes('family') ? 'SRV-FAMILY-CARD' : 'SRV-INDIVIDUAL-CARD'),
      name: itemName,
      type: 'service' as const,
      price: itemPrice,
      unit_price: itemPrice,
      qty: 1,
      description: itemToSelect?.description || `${itemName} Registration Fee`,
      category: itemToSelect?.category || 'Registration'
    };

    setCart(prevCart => {
      const alreadyInCart = prevCart.some(
        c => (cartItemToAdd.identifier && c.identifier === cartItemToAdd.identifier) ||
             (c.name && c.name.toLowerCase() === itemName.toLowerCase())
      );
      if (alreadyInCart) return prevCart;

      return [...prevCart, cartItemToAdd];
    });

    // Automatically set amount tendered to cover registration fee so cashier can immediately complete
    setAmountTendred(prev => prev > 0 ? prev : itemPrice);

    autoPopulatedKeyRef.current = populateKey;
    notify('info', `${itemName} (₦${itemPrice.toLocaleString()}) populated into cart for registration`);
  }, [searchParams, catalog]);



  // Debounced Server-Side Patient Autocomplete Search
  useEffect(() => {
    const trimmed = patientSearchQuery.trim();
    if (trimmed.length < 2) {
      setPatientResults([]);
      setIsSearchingPatients(false);
      return;
    }

    setIsSearchingPatients(true);
    const timer = setTimeout(async () => {
      try {
        const results = await api.getPatients({ search: trimmed, limit: 12 });
        setPatientResults(Array.isArray(results) ? results : []);
      } catch (err) {
        console.warn('[Billing] Server-side patient search failed, using local fallback:', err);
        const q = trimmed.toLowerCase();
        setPatientResults(patients.filter(p => 
          p.full_name?.toLowerCase().includes(q) || 
          p.id?.toString().toLowerCase().includes(q) ||
          (p.phone && p.phone.toString().includes(q))
        ).slice(0, 12));
      } finally {
        setIsSearchingPatients(false);
      }
    }, 280);

    return () => clearTimeout(timer);
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
        const printerConfig = getPrinterSettings();
        const receiptPayload = {
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
          cashier_email: user?.email || '',
          items: items
        };

        if (printerConfig.autoPrintOnPayment || window.confirm('Payment recorded successfully. Print updated receipt?')) {
          dispatchReceiptPrint(receiptPayload, user).then(printRes => {
            if (printRes.fallbackUsed) notify('info', printRes.message);
          });
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
  const effectiveDiscountPct = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
  const totalPayable = Math.max(0, subtotal - discountAmount);
  const balance = Math.max(0, totalPayable - amountTendred);

  // Role discount limit calculations
  const userRole = (user?.role || 'Receptionist').toLowerCase();
  const roleCap = userRole === 'admin' ? 100 : parseFloat(
    userRole === 'doctor' || userRole === 'consultant' ? (clinicSettings?.discount_cap_doctor || clinicSettings?.discount_cap_consultant || '25') :
    userRole === 'optometrist' ? (clinicSettings?.discount_cap_optometrist || '15') :
    userRole === 'nurse' ? (clinicSettings?.discount_cap_nurse || '10') :
    (clinicSettings?.discount_cap_receptionist || '10')
  );
  const supervisorCeiling = parseFloat(clinicSettings?.discount_cap_supervisor_ceiling || '50');

  const isExceedingCeiling = userRole !== 'admin' && effectiveDiscountPct > supervisorCeiling;
  const isExceedingRoleCap = userRole !== 'admin' && effectiveDiscountPct > roleCap;

  // Sync amount tendred when total payable changes, unless it was manually edited
  useEffect(() => {
    if (amountTendred === 0 || amountTendred > totalPayable) {
       setAmountTendred(totalPayable);
    }
  }, [totalPayable]);

  const handleVerifySupervisor = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!supervisorUsername.trim() || !supervisorPassword) {
      return notify('error', 'Supervisor username and password are required');
    }
    setIsVerifyingSupervisor(true);
    try {
      const res = await api.verifySupervisor({
        username: supervisorUsername.trim(),
        password: supervisorPassword
      });
      if (!discountReason) {
        notify('error', 'Please select a discount justification reason before authorizing.');
        setIsVerifyingSupervisor(false);
        return;
      }
      setSupervisorAuth({ ...res.supervisor, password: supervisorPassword });
      setIsManualDiscountUnlocked(true);
      setShowSupervisorModal(false);
      setSupervisorPassword('');
      notify('success', `Override authorized by ${res.supervisor.full_name} (${res.supervisor.role})`);
    } catch (err: any) {
      notify('error', err.message || 'Supervisor authorization failed');
    } finally {
      setIsVerifyingSupervisor(false);
    }
  };

  const handleProcessPayment = async () => {
    if (!selectedPatient) return notify('error', 'Select a patient first');
    if (cart.length === 0) return notify('error', 'Cart is empty');
    if (amountTendred < 0) return notify('error', 'Invalid payment amount');

    // Revenue leakage & role cap checks
    if (isExceedingCeiling) {
      return notify(
        'error',
        `Discount of ${effectiveDiscountPct.toFixed(1)}% exceeds the maximum hospital ceiling (${supervisorCeiling}%). Cannot proceed.`
      );
    }

    if (isExceedingRoleCap && !supervisorAuth) {
      setShowSupervisorModal(true);
      return notify(
        'warning',
        `Discount of ${effectiveDiscountPct.toFixed(1)}% exceeds your ${user?.role || 'user'} allowance (${roleCap}%). Supervisor authorization required.`
      );
    }

    setIsProcessing(true);
    try {
      const isFamilyCard = searchParams.get('is_family') === '1' || searchParams.get('family_id') || selectedPatient?.is_family;
      const targetFamilyId = searchParams.get('family_id') || selectedPatient?.family_id;
      const billingType = isFamilyCard ? 'family' : (selectedPatient?.id ? 'patient' : 'walk_in');

      const transactionData = {
        patient_id: selectedPatient.id,
        billing_type: billingType,
        family_id: targetFamilyId ? parseInt(String(targetFamilyId)) : null,
        visit_id: selectedVisitId,
        total_amount: subtotal,
        amount_paid: amountTendred,
        discount: discountAmount,
        payment_method: paymentMethod,
        payment_details: {
          ...(paymentMethod === 'Mixed' ? mixedBreakdown : {}),
          ...(supervisorAuth ? {
            supervisor_override_applied: {
              authorized_by: supervisorAuth.username,
              role: supervisorAuth.role,
              full_name: supervisorAuth.full_name,
              timestamp: new Date().toISOString()
            }
          } : {})
        },
        supervisor_username: supervisorAuth?.username,
        supervisor_password: supervisorAuth?.password,
        discount_reason: discountReason || undefined,
        discount_note: discountNote || undefined,
        is_insurance_bill: ['HMO', 'NHIS', 'INSURANCE'].includes(selectedPatient?.payment_category) || !!selectedPatient?.is_insurance,
        payer_id: selectedPatient?.payer_id || undefined,
        patient_portion: amountTendred,
        payer_portion: Math.max(0, totalPayable - amountTendred),
        items: cart.map(item => ({
          inventory_id: item.type === 'product' ? item.identifier : null,
          description: item.name,
          qty: item.qty,
          unit_price: item.unit_price
        })),
        cashier: user?.full_name || 'System'
      };

      const res = await api.createTransaction(transactionData);
      setSupervisorAuth(null);
      setDiscountReason('');
      setDiscountNote('');
      
      // Clinical Gate: Only update visit status if payment is FULL
      if (transactionData.visit_id && balance === 0) {
        await api.updateVisitStatus(transactionData.visit_id, 'Paid - Waiting for Triage', user?.full_name);
      }

      notify('success', balance === 0 ? 'Payment Settled' : 'Partial Payment Recorded');
      
      // Family Card Post-Payment Check: show direct link to Family Profile
      if (isFamilyCard && targetFamilyId) {
        setFamilyPaymentSuccess({
          familyId: targetFamilyId,
          familyName: selectedPatient.full_name || 'Family Household',
          receiptNo: res.receipt_no || 'REC',
          balance: balance,
          amountPaid: amountTendred
        });
      }
      
      // Print Receipt
      const printerConfig = getPrinterSettings();
      const receiptPayload = { 
        ...transactionData, 
        receipt_no: res.receipt_no, 
        created_at: new Date(),
        patient_name: selectedPatient.full_name,
        cashier_email: user?.email || '',
        balance: balance
      };

      if (printerConfig.autoPrintOnPayment) {
        // Silent instant print in under 1 second
        dispatchReceiptPrint(receiptPayload, user).then(printRes => {
          if (printRes.fallbackUsed) {
            notify('info', printRes.message);
          } else if (printRes.mode === 'network') {
            notify('success', `Receipt printed silently to ${printerConfig.networkIp}`);
          }
        }).catch(err => console.error('Silent print failed:', err));
      } else if (window.confirm('Transaction successful. Print official receipt?')) {
        dispatchReceiptPrint(receiptPayload, user).then(printRes => {
          if (printRes.fallbackUsed) notify('info', printRes.message);
        });
      }

      // Close completed session or reset
      localStorage.removeItem(LEGACY_DRAFT_KEY);
      setIsRestoredFromDraft(false);
      if (sessions.length > 1) {
        const remaining = sessions.filter(s => s.id !== activeSessionId);
        setSessions(remaining);
        applySessionToState(remaining[0]);
      } else {
        const cleared = createDefaultSession('sess-1');
        setSessions([cleared]);
        applySessionToState(cleared);
      }
      setActiveTab('history');
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setIsProcessing(false);
    }
  };


  return (
    <div className="billing-page-container animate-fade-in">
      {/* Post-Payment Family Profile Modal */}
      {familyPaymentSuccess && (
        <div className="leh-modal-overlay" style={{ zIndex: 1200 }}>
          <div className="leh-modal-content" style={{ maxWidth: '520px', textAlign: 'center' }}>
            <div style={{ padding: '36px 28px 28px' }}>
              <div style={{
                width: '68px', height: '68px', borderRadius: '50%',
                background: '#dcfce7', color: '#16a34a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 18px'
              }}>
                <CheckCircle2 size={38} />
              </div>

              <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: '0 0 8px' }}>
                {(familyPaymentSuccess.balance ?? 0) === 0 ? 'Family Card Payment Settled!' : 'Family Card Partial Payment Recorded!'}
              </h2>
              <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 20px', lineHeight: '1.5' }}>
                {(familyPaymentSuccess.balance ?? 0) === 0 ? (
                  <>The household registration fee for <strong>{familyPaymentSuccess.familyName}</strong> has been confirmed in full (Receipt #{familyPaymentSuccess.receiptNo}).</>
                ) : (
                  <>Partial payment of <strong>₦{(familyPaymentSuccess.amountPaid ?? 0).toLocaleString()}</strong> for <strong>{familyPaymentSuccess.familyName}</strong> has been recorded (Receipt #{familyPaymentSuccess.receiptNo}). Balance remaining: <strong style={{ color: 'var(--leh-red)' }}>₦{(familyPaymentSuccess.balance ?? 0).toLocaleString()}</strong>.</>
                )}
              </p>

              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '28px',
                fontSize: '13px',
                color: '#475569',
                lineHeight: '1.5'
              }}>
                {(familyPaymentSuccess.balance ?? 0) === 0 ? (
                  'The household card is now active. You can open the Family Profile immediately to add household members with their own patient folders.'
                ) : (
                  'The household card is active and the outstanding debt is tracked under Pending Bills. You can open the Family Profile immediately to add household members.'
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setFamilyPaymentSuccess(null)}
                  className="leh-btn-outline"
                  style={{ height: '42px', padding: '0 20px' }}
                >
                  Stay on Billing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const fId = familyPaymentSuccess.familyId;
                    setFamilyPaymentSuccess(null);
                    navigate(`/patients/family/${fId}`);
                  }}
                  className="leh-btn-primary"
                  style={{ height: '42px', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Users size={18} />
                  <span>Open Family Profile & Add Members →</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  localStorage.removeItem(LEGACY_DRAFT_KEY);
                  setIsRestoredFromDraft(false);
                  if (sessions.length > 1) {
                    const remaining = sessions.filter(s => s.id !== activeSessionId);
                    setSessions(remaining);
                    applySessionToState(remaining[0]);
                  } else {
                    const cleared = createDefaultSession('sess-1');
                    setSessions([cleared]);
                    applySessionToState(cleared);
                  }
                  setShowCancelModal(false);
                  notify('info', 'Billing session terminated');
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
                  <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--leh-forest)', fontFamily: 'monospace' }}>{reconcileTx.receipt_no || `TX-${reconcileTx.transaction_id}`}</span>
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

               dispatchReceiptPrint(targetTx, user, { isReprint: true }).then(printRes => {
                 if (printRes.fallbackUsed) notify('info', printRes.message);
               });
            }).catch(() => notify('error', 'Failed to fetch receipts.'));
          }}>
            <Printer size={16} /> Print Last Receipt
          </button>
          <button 
            type="button"
            className="billing-btn-secondary" 
            onClick={() => setShowPrinterConfig(true)}
            title="Configure Direct ESC/POS Thermal Receipt Printer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#1e293b', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
          >
            <Sliders size={16} color="var(--leh-forest)" /> Thermal Setup
          </button>
        </div>
      </header>

      <InnerNavTabs<'inventory' | 'pending' | 'history'>
        tabs={[
          { id: 'inventory', label: 'STANDARD BILLING' },
          { id: 'pending', label: 'PENDING BILLS / DEBTS' },
          { id: 'history', label: 'BILLING HISTORY' }
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        style={{ marginBottom: '28px' }}
      />

      {/* CONCURRENT SESSIONS BAR */}
      {activeTab === 'inventory' && (
        <div className="billing-sessions-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px 0', overflowX: 'auto', padding: '4px 0' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '4px' }}>
            Sessions:
          </span>
          {sessions.map((sess, idx) => {
            const isActive = sess.id === activeSessionId;
            const title = sess.selectedPatient 
              ? `${sess.selectedPatient.full_name || 'Patient'} (#${sess.selectedPatient.id})`
              : `Session ${idx + 1}`;
            const itemCount = (sess.cart || []).reduce((acc: number, item: any) => acc + (item.qty || 1), 0);
            
            return (
              <div
                key={sess.id}
                onClick={() => switchSession(sess.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  borderRadius: '10px',
                  background: isActive ? 'var(--leh-primary)' : '#f8fafc',
                  color: isActive ? '#ffffff' : '#334155',
                  fontWeight: isActive ? 800 : 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                  border: isActive ? '1px solid var(--leh-primary)' : '1px solid #e2e8f0',
                  boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{title}</span>
                {itemCount > 0 && (
                  <span style={{
                    background: isActive ? 'rgba(255, 255, 255, 0.25)' : '#e2e8f0',
                    color: isActive ? '#ffffff' : '#475569',
                    borderRadius: '999px',
                    padding: '1px 6px',
                    fontSize: '10px',
                    fontWeight: 800
                  }}>
                    {itemCount}
                  </span>
                )}
                {sessions.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeSession(sess.id);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: isActive ? 'rgba(255,255,255,0.7)' : '#94a3b8',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0 2px',
                      lineHeight: 1
                    }}
                    title="Close session tab"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })}

          {sessions.length < 5 && (
            <button
              type="button"
              onClick={addNewSession}
              className="leh-btn-secondary"
              style={{
                height: '32px',
                padding: '0 12px',
                fontSize: '11px',
                borderRadius: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Open new concurrent billing session (Max 5)"
            >
              <Plus size={14} /> New Session
            </button>
          )}
        </div>
      )}

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
                 <div ref={itemSearchRef} className="search-input-wrapper" style={{ marginBottom: '16px' }}>
                    <div className="leh-search-box">
                       <Search size={18} className="leh-search-icon" />
                       <input 
                         ref={searchInputRef}
                         placeholder="Search services, drugs, lens..." 
                         value={catalogSearch} 
                         onChange={(e) => setCatalogSearch(e.target.value)} 
                       />
                       {catalogSearch && (
                         <button 
                           type="button" 
                           onClick={() => { setCatalogSearch(''); setCatalogResults([]); }}
                           className="leh-search-clear"
                           title="Clear search"
                         >
                           <X size={16} />
                         </button>
                       )}
                    </div>
                    {catalogResults.length > 0 && (
                      <div className="search-results-popover">
                         {catalogResults.map(item => (
                           <div key={item.identifier + item.type} className="search-result-item" onClick={() => addToCart(item)}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                 <span style={{ fontWeight: '800', fontSize: '13px' }}>{item.name}</span>
                                 <span style={{ fontSize: '10px', color: '#94a3b8' }}>{item.category}</span>
                              </div>
                              <span style={{ fontWeight: '900', color: 'var(--leh-forest)' }}>₦{item.price?.toLocaleString()}</span>
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
                 <div ref={patientSearchRef} className="search-input-wrapper" style={{ marginBottom: '16px', position: 'relative' }}>
                    <input 
                      className="billing-search-input" 
                      style={{ paddingLeft: '16px', paddingRight: isSearchingPatients ? '36px' : '16px' }}
                      placeholder="Search patient name, file #, or phone..." 
                      value={patientSearchQuery} 
                      onChange={(e) => setPatientSearchQuery(e.target.value)} 
                    />
                    {isSearchingPatients && (
                      <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                        <RefreshCcw size={14} className="animate-spin" color="var(--leh-primary)" />
                      </div>
                    )}
                    {patientResults.length > 0 && (
                      <div className="search-results-popover">
                         {patientResults.map(p => (
                           <div key={p.id} className="search-result-item" onClick={() => handlePatientSelect(p)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                 <span style={{ fontWeight: '800' }}>{p.full_name}</span>
                                 {p.phone && <span style={{ color: '#64748b', fontSize: '10px', marginTop: '2px' }}>Tel: {p.phone}</span>}
                              </div>
                              <span style={{ color: 'var(--leh-forest)', fontSize: '11px', fontWeight: '800', whiteSpace: 'nowrap' }}>#{p.id}</span>
                           </div>
                         ))}
                      </div>
                    )}
                 </div>
                 
                 <div style={{ padding: '0 16px' }}>
                    {selectedPatient ? (
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div>
                            <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SELECTED PATIENT</span>
                            <div style={{ fontSize: '14px', fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>{selectedPatient.full_name}</div>
                          </div>
                          <button
                            type="button"
                            className="leh-icon-btn red"
                            style={{ padding: '4px' }}
                            title="Unlink patient from billing"
                            onClick={() => {
                              setSelectedPatient(null);
                              setSelectedVisitId(null);
                              notify('info', 'Patient unlinked from billing session');
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', fontSize: '11px' }}>
                          <div>
                            <span style={{ color: '#94a3b8', fontWeight: '700' }}>FILE NO: </span>
                            <strong style={{ color: 'var(--leh-primary)' }}>{selectedPatient.id}</strong>
                          </div>
                          {selectedVisitId && (
                            <div>
                              <span style={{ color: '#94a3b8', fontWeight: '700' }}>VISIT: </span>
                              <strong style={{ color: '#64748b' }}>#{selectedVisitId}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                         <span style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>FILE NUMBER</span>
                         <span style={{ fontSize: '14px', fontWeight: '800', color: '#94a3b8' }}>No patient attached (search above)</span>
                      </div>
                    )}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                       <h3 className="panel-title" style={{ background: '#e2e8f0', padding: '4px 8px', borderRadius: '4px', margin: 0 }}>
                          <ShoppingCart size={16} /> Current Billing
                       </h3>
                       {selectedPatient ? (
                          <span className="patient-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ opacity: 0.75, fontWeight: 700 }}>#{selectedPatient.id}</span>
                            <span>{(selectedPatient.full_name || '').toUpperCase()}</span>
                          </span>
                       ) : (
                          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>No patient attached</span>
                       )}
                       {isRestoredFromDraft && (
                          <span style={{ 
                            fontSize: '10px', 
                            fontWeight: 800, 
                            background: '#fef3c7', 
                            color: '#92400e', 
                            border: '1px solid #fde68a', 
                            padding: '3px 8px', 
                            borderRadius: '6px',
                            letterSpacing: '0.04em'
                          }}>
                            DRAFT RESTORED
                          </span>
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
                                setShowSupervisorModal(true);
                                if (user?.role === 'Admin') {
                                  setIsManualDiscountUnlocked(true);
                                  notify('success', 'Manual discount unlocked (Admin)');
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

                    {/* Role-Gated Discount Cap Indicators */}
                    {effectiveDiscountPct > 0.01 && (
                      <div style={{ marginTop: '10px' }}>
                        {isExceedingCeiling ? (
                          <div style={{ padding: '8px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '11px', color: '#991b1b', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertTriangle size={14} />
                            <span>EXCEEDS CEILING ({supervisorCeiling}%). Maximum discount allowed for this transaction is {supervisorCeiling}%.</span>
                          </div>
                        ) : isExceedingRoleCap ? (
                          <div style={{ padding: '8px 12px', background: supervisorAuth ? '#ecfdf5' : '#fffbeb', border: `1px solid ${supervisorAuth ? '#a7f3d0' : '#fed7aa'}`, borderRadius: '8px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: supervisorAuth ? '#065f46' : '#9a3412', fontWeight: '700' }}>
                              <ShieldCheck size={14} color={supervisorAuth ? '#10b981' : '#f59e0b'} />
                              <span>
                                {supervisorAuth 
                                  ? `Supervisor Override Approved: ${supervisorAuth.full_name} (${supervisorAuth.role})`
                                  : `Exceeds ${user?.role || 'Cashier'} limit (${roleCap}%). Effective: ${effectiveDiscountPct.toFixed(1)}%`}
                              </span>
                            </div>
                            {!supervisorAuth && (
                              <button
                                type="button"
                                onClick={() => setShowSupervisorModal(true)}
                                style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '10px', fontWeight: '800', cursor: 'pointer' }}
                              >
                                AUTHORIZE
                              </button>
                            )}
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CheckCircle2 size={13} color="#10b981" />
                            <span>Effective discount: {effectiveDiscountPct.toFixed(1)}% (within your {roleCap}% limit)</span>
                          </div>
                        )}
                      </div>
                    )}

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
                          data-tooltip={paymentMethod === 'Mixed' && Math.abs((mixedBreakdown.cash + mixedBreakdown.bank) - totalPayable) > 0.01 ? "Mixed payment amounts must match total payable" : "Process this transaction (Quick Checkout: F9 or Ctrl+Enter)"}
                        >
                           <div className="btn-finalize-inner">
                              {isProcessing ? <RefreshCcw className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                              <span>{balance > 0 ? 'RECORD PARTIAL PAYMENT' : 'PROCESS PAYMENT'}</span>
                              <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.22)', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.04em' }}>F9</span>
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
                                <td style={{ fontWeight: '800', color: 'var(--leh-forest)' }}>{tx.receipt_no || `TX-${tx.transaction_id}`}</td>
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
                         <td style={{ fontWeight: '800', color: 'var(--leh-forest)' }}>{tx.receipt_no}</td>
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
                                dispatchReceiptPrint(tx, user, { isReprint: true }).then(printRes => {
                                  if (printRes.fallbackUsed) notify('info', printRes.message);
                                });
                              }}
                              title="Reprint Receipt"
                            >
                               <Printer size={14} color="var(--leh-forest)" />
                            </button>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {/* Thermal Printer Settings Modal */}
      {showPrinterConfig && (
        <ThermalPrinterModal 
          onClose={() => setShowPrinterConfig(false)} 
          onSaved={() => notify('success', 'Thermal printer configuration saved.')}
        />
      )}

      {/* Supervisor Discount Authorization Modal */}
      {showSupervisorModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '420px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Lock size={18} color="#ea580c" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>Supervisor Authorization</h4>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>Revenue leakage protection gate</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => { setShowSupervisorModal(false); setSupervisorPassword(''); setDiscountReason(''); setDiscountNote(''); }} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleVerifySupervisor} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '10px', background: '#fff7ed', border: '1px solid #fed7aa', fontSize: '12px', color: '#9a3412', lineHeight: 1.5 }}>
                <p style={{ margin: '0 0 4px', fontWeight: '800' }}>Discount Approval Required</p>
                <span>
                  The applied discount of <strong>{effectiveDiscountPct.toFixed(1)}% (₦{discountAmount.toLocaleString()})</strong> exceeds the {user?.role || 'cashier'} limit of <strong>{roleCap}%</strong>. An authorized Doctor, Consultant, or Admin must verify this transaction.
                </span>
              </div>

              {/* Discount Reason — required when exceeding cap */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Discount Justification <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  required
                  className="leh-input"
                  style={{ width: '100%', height: '40px', fontSize: '13px', cursor: 'pointer' }}
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                >
                  <option value="">— Select a justification reason —</option>
                  <option value="Staff/Family Waiver">Staff / Family Waiver</option>
                  <option value="Clinical Complication Courtesy">Clinical Complication Courtesy</option>
                  <option value="Indigent Patient Scheme">Indigent Patient Scheme</option>
                  <option value="Damaged Frame/Lens Good Faith">Damaged Frame / Lens Good Faith</option>
                  <option value="NGO/Partner Subsidy">NGO / Partner Subsidy</option>
                  <option value="Management Directive">Management Directive</option>
                  <option value="Referral Discount">Referral Discount</option>
                  <option value="Other (see note)">Other (see note below)</option>
                </select>
              </div>

              {/* Optional note */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Additional Note <span style={{ color: '#94a3b8', fontWeight: '400' }}>(optional)</span>
                </label>
                <textarea
                  placeholder="Brief explanation for audit trail..."
                  className="leh-input"
                  rows={2}
                  style={{ width: '100%', fontSize: '12px', resize: 'vertical', padding: '10px 12px', lineHeight: 1.5 }}
                  value={discountNote}
                  onChange={(e) => setDiscountNote(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Supervisor Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. dr_smith, admin"
                  className="leh-input"
                  style={{ width: '100%', height: '40px', fontSize: '13px' }}
                  value={supervisorUsername}
                  onChange={(e) => setSupervisorUsername(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Supervisor Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter supervisor password"
                  className="leh-input"
                  style={{ width: '100%', height: '40px', fontSize: '13px' }}
                  value={supervisorPassword}
                  onChange={(e) => setSupervisorPassword(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setShowSupervisorModal(false); setSupervisorPassword(''); setDiscountReason(''); setDiscountNote(''); }}
                  style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingSupervisor}
                  className="leh-btn-primary"
                  style={{ height: '38px', padding: '0 18px', fontSize: '12px', background: '#ea580c', borderColor: '#ea580c' }}
                >
                  <ShieldCheck size={15} />
                  {isVerifyingSupervisor ? 'VERIFYING...' : 'AUTHORIZE & UNLOCK'}
                </button>
              </div>
            </form>
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
