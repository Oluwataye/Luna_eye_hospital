import { useCallback } from "react";

const DRAFT_KEY = "leh_billing_draft_v1";

interface CartItem {
  identifier: string | number;
  type: "service" | "product";
  name: string;
  qty: number;
  unit_price: number;
  description: string;
  [key: string]: unknown;
}

export interface BillingDraft {
  selectedPatient: Record<string, unknown> | null;
  selectedVisitId: string | null;
  cart: CartItem[];
  discountPercent: number;
  manualDiscount: number;
  paymentMethod: "Cash" | "POS" | "Transfer" | "Mixed";
  savedAt?: number;
}

const DRAFT_TTL_MS = 8 * 60 * 60 * 1000; // 8-hour expiry

export function loadBillingDraft(): BillingDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed: BillingDraft = JSON.parse(raw);
    if (parsed.savedAt && Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      sessionStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveDraft(draft: BillingDraft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // sessionStorage unavailable — fail silently
  }
}

export function clearBillingDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

const EMPTY_DRAFT: BillingDraft = {
  selectedPatient: null,
  selectedVisitId: null,
  cart: [],
  discountPercent: 0,
  manualDiscount: 0,
  paymentMethod: "Cash",
};

/**
 * Persists in-progress billing session (cart, patient, discounts) in sessionStorage.
 * Auto-restores on page refresh or accidental navigation within the same browser tab.
 * Call discardDraft() on successful payment or session termination.
 *
 * Usage:
 *   const { initialDraft, persistDraft, discardDraft } = useBillingDraft();
 *   const [cart, setCart] = useState(initialDraft.cart);
 *   const [selectedPatient, setSelectedPatient] = useState(initialDraft.selectedPatient);
 *   // After any state change that should be saved:
 *   useEffect(() => { persistDraft({ cart, selectedPatient, ... }); }, [cart, selectedPatient]);
 */
export function useBillingDraft() {
  const initialDraft: BillingDraft = loadBillingDraft() ?? EMPTY_DRAFT;

  const persistDraft = useCallback((state: BillingDraft) => {
    const hasMeaningfulData =
      state.cart.length > 0 ||
      state.selectedPatient !== null ||
      state.discountPercent !== 0 ||
      state.manualDiscount !== 0;

    if (hasMeaningfulData) {
      saveDraft(state);
    } else {
      clearBillingDraft();
    }
  }, []);

  const discardDraft = useCallback(() => {
    clearBillingDraft();
  }, []);

  return { initialDraft, persistDraft, discardDraft };
}
