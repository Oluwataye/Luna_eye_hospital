// Luna Eye Hospital API Client
export const API_BASE_URL = '/api';

// ── Request deduplication: identical in-flight GETs share one Promise ──
const _pending = new Map<string, Promise<any>>();

// ── Core request function ──
// signal: optional AbortController signal (pass from useEffect cleanup)
// _retry: internal retry counter — do not pass manually
const request = async (
  endpoint: string,
  options: RequestInit & { signal?: AbortSignal } = {},
  _retry = 0
): Promise<any> => {
  // Offline guard — fail fast without a network round-trip
  if (!navigator.onLine) {
    throw new Error('No internet connection. Please check your network and try again.');
  }

  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const dedupeKey = `${method}:${endpoint}`;

  // Deduplicate identical in-flight GET requests
  if (isGet && _pending.has(dedupeKey)) {
    return _pending.get(dedupeKey)!;
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const execRequest = async (): Promise<any> => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}${endpoint}`, { 
        ...options, 
        headers,
        credentials: 'include' // Enforce cookies transmission (crucial for JWT session cookie)
      });
    } catch (networkErr: any) {
      // Network-level failure (ECONNREFUSED, DNS, etc.) — retry GETs only
      if (isGet && _retry < 2) {
        const delay = (_retry + 1) * 500; // 500ms, 1000ms
        console.warn(`[API] Network error — retry ${_retry + 1} in ${delay}ms: ${endpoint}`);
        await new Promise(r => setTimeout(r, delay));
        return request(endpoint, options, _retry + 1);
      }
      throw new Error('Unable to reach the server. Please check your connection.');
    }

    // 401 — token expired or missing: clear session and redirect to login
    if (res.status === 401) {
      localStorage.removeItem('user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      throw new Error('Session expired. Please log in again.');
    }

    // 429 / 503 — rate limited or server overloaded: retry GETs with backoff
    if ((res.status === 429 || res.status === 503) && isGet && _retry < 2) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10);
      const delay = retryAfter > 0 ? retryAfter * 1000 : (_retry + 1) * 1000;
      console.warn(`[API] ${res.status} — retry ${_retry + 1} in ${delay}ms: ${endpoint}`);
      await new Promise(r => setTimeout(r, delay));
      return request(endpoint, options, _retry + 1);
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `Request failed: ${res.status}`);
    }

    return res.json();
  };

  if (isGet) {
    const promise = execRequest().finally(() => _pending.delete(dedupeKey));
    _pending.set(dedupeKey, promise);
    return promise;
  }

  return execRequest();
};

// ── Convenience: create an AbortController tied to a React useEffect ──
// Usage: const { signal, abort } = apiAbort();
// Pass signal to api methods that accept it; call abort() in useEffect cleanup.
export const apiAbort = () => {
  const controller = new AbortController();
  return { signal: controller.signal, abort: () => controller.abort() };
};

const cleanParams = (params: any) => {
  const clean: any = {};
  if (!params) return clean;
  Object.keys(params).forEach(k => {
    const val = params[k];
    if (val !== undefined && val !== null && val !== '') {
      clean[k] = val;
    }
  });
  return clean;
};

export const api = {
  async getStatus() {
    return request('/status');
  },

  async getDashboardStats() {
    return request('/reports/patients/summary');
  },

  async login(credentials: any) {
    const res = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
      credentials: 'include' // Send cookies (session)
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Login failed');
    }
    return res.json();
  },

  async logout() {
    return request('/logout', { method: 'POST' });
  },

  async getPatients() {
    const data = await request('/patients');
    return Array.isArray(data) ? data : [];
  },

  async getQueue() {
    const data = await request('/queue');
    // Ensure all queue properties are arrays
    if (data) {
      data.waiting = Array.isArray(data.waiting) ? data.waiting : [];
      data.consulting = Array.isArray(data.consulting) ? data.consulting : [];
      data.waiting_for_consultation = Array.isArray(data.waiting_for_consultation) ? data.waiting_for_consultation : [];
      data.admitted = Array.isArray(data.admitted) ? data.admitted : [];
      data.awaiting_payment = Array.isArray(data.awaiting_payment) ? data.awaiting_payment : [];
    }
    return data || { waiting: [], consulting: [], waiting_for_consultation: [], admitted: [], awaiting_payment: [], total_today: 0 };
  },

  async getTriageQueue() {
    const data = await request('/triage-queue');
    return Array.isArray(data) ? data : [];
  },

  async getAwaitingPaymentQueue() {
    const data = await request('/awaiting-payment');
    return Array.isArray(data) ? data : [];
  },

  async getConsultationQueue() {
    const data = await request('/consultation-queue');
    return Array.isArray(data) ? data : [];
  },

  async getPatientTriage(patientId: string) {
    return request(`/triage/${encodeURIComponent(patientId)}`);
  },

  async getVisitTriage(visitId: string | number) {
    return request(`/triage/visit/${visitId}`);
  },

  async getTriageHistory(patientId: string) {
    const data = await request(`/triage/history/${encodeURIComponent(patientId)}`);
    return Array.isArray(data) ? data : [];
  },

  async saveTriage(data: any) {
    return request('/triage', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getInventory(category?: string) {
    const url = category ? `/inventory?category=${category}` : '/inventory';
    const data = await request(url);
    return Array.isArray(data) ? data : [];
  },

  async getServices() {
    const data = await request('/services');
    return Array.isArray(data) ? data : [];
  },

  async createInventoryItem(itemData: any) {
    return request('/inventory', {
      method: 'POST',
      body: JSON.stringify(itemData)
    });
  },

  async updateInventoryItem(id: string, itemData: any) {
    return request(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(itemData)
    });
  },

  async updateInventoryStock(id: string, data: { quantity_change: number, reason?: string, type?: string, performed_by?: string, reference_id?: string }) {
    return request(`/inventory/${id}/stock`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async getStockHistory(id: string) {
    const data = await request(`/inventory/${id}/history`);
    return Array.isArray(data) ? data : [];
  },

  async getInventoryValuation() {
    return request('/inventory/valuation');
  },
  async deleteInventoryItem(id: string) {
    return request(`/inventory/${id}`, { method: 'DELETE' });
  },

  async createPatient(patientData: any) {
    return request('/patients', {
      method: 'POST',
      body: JSON.stringify(patientData)
    });
  },

  async updatePatient(id: string, patientData: any) {
    return request(`/patients/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(patientData)
    });
  },

  async dischargePatient(id: string | number, summary: string) {
    return request(`/admissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'Discharged', notes: summary })
    });
  },

  async getTransactions() {
    const data = await request('/transactions');
    return Array.isArray(data) ? data : [];
  },
  async createTransaction(transactionData: any) {
    return request('/transactions', {
      method: 'POST',
      body: JSON.stringify(transactionData)
    });
  },

  async getDebtorsReport() {
    const data = await request('/reports/debtors/details');
    return Array.isArray(data) ? data : [];
  },

  async processSaleTransaction(data: any) {
    const body = await request('/transactions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return { success: true, receipt_no: body.receipt_no || body.id };
  },

  async recordPayment(transactionId: number | string, data: { amount_paid: number, payment_method: string, cashier: string }) {
    return request(`/transactions/${transactionId}/payment`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  async getConsultations(patientId?: string) {
    const url = patientId ? `/consultations?patient_id=${patientId}` : '/consultations';
    const data = await request(url);
    return Array.isArray(data) ? data : [];
  },

  async createConsultation(consultationData: any) {
    return request('/consultations', {
      method: 'POST',
      body: JSON.stringify(consultationData)
    });
  },

  async getInvestigations(patientId?: string, status?: string, billing_status?: string) {
    let url = '/investigations?';
    if (patientId) url += `patient_id=${patientId}&`;
    if (status) url += `status=${status}&`;
    if (billing_status) url += `billing_status=${billing_status}`;
    const data = await request(url);
    return Array.isArray(data) ? data : [];
  },

  async requestInvestigation(data: {patient_id: string, test_name: string, requested_by: string, inventory_id?: string, unit?: string, reference_range?: string}) {
    return request('/investigations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateInvestigationResult(id: number, data: { results_notes?: string, status?: string, test_value?: string, medical_comments?: string, billing_status?: string, unit?: string | null, reference_range?: string | null }) {
    return request(`/investigations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async getAdmissions(status?: string) {
    const url = status ? `/admissions?status=${status}` : '/admissions';
    const data = await request(url);
    return Array.isArray(data) ? data : [];
  },

  async createAdmission(data: {patient_id: string, ward_name: string, bed_number: string, admitting_doctor: string, reason: string, notes?: string}) {
    return request('/admissions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateAdmission(id: number, data: {status?: string, notes?: string}) {
    return request(`/admissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // Procurement API
  async getSuppliers() {
    const data = await request('/suppliers');
    return Array.isArray(data) ? data : [];
  },

  async createSupplier(data: any) {
    return request('/suppliers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getPurchaseOrders() {
    const data = await request('/purchase-orders');
    return Array.isArray(data) ? data : [];
  },

  async createPurchaseOrder(data: any) {
    return request('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async receiveGoods(poId: number, receivedItems: any[]) {
    return request(`/purchase-orders/${poId}/receive`, {
      method: 'POST',
      body: JSON.stringify({ received_items: receivedItems })
    });
  },
  async updatePOStatus(poId: number, status: string) {
    return request(`/purchase-orders/${poId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  async getProcurementStats() {
    return request('/procurement/stats');
  },

  // Reports API
  async getSalesReport(startDate: string, endDate: string) {
    const data = await request(`/reports/sales?start_date=${startDate}&end_date=${endDate}`);
    return Array.isArray(data) ? data : [];
  },
  async getSalesSummary() {
    return request('/reports/sales/summary');
  },
  async getTransactionItems(transactionId: string | number) {
    const data = await request(`/transactions/${transactionId}/items`);
    return Array.isArray(data) ? data : [];
  },
  async getDebtorsSummary() {
    return request('/reports/debtors/summary');
  },
  async getAuditReport(startDate: string, endDate: string) {
    const data = await request(`/reports/audit?start_date=${startDate}&end_date=${endDate}`);
    return Array.isArray(data) ? data : [];
  },
  async getAuditSummary() {
    return request('/reports/audit/summary');
  },
  async getUsersList() {
    const data = await request('/users');
    return Array.isArray(data) ? data : [];
  },
  async getPatientSummary() {
    return request('/reports/patients/summary');
  },
  async getProcurementReport(startDate: string, endDate: string) {
    const data = await request(`/reports/procurement?start_date=${startDate}&end_date=${endDate}`);
    return Array.isArray(data) ? data : [];
  },
  async getProcurementSummary() {
    return request('/reports/procurement/summary');
  },
  async getProfitLoss(startDate: string, endDate: string) {
    return request(`/reports/profit-loss?start_date=${startDate}&end_date=${endDate}`);
  },
  async getExpensesReport(startDate: string, endDate: string) {
    const data = await request(`/reports/expenses?start_date=${startDate}&end_date=${endDate}`);
    return Array.isArray(data) ? data : [];
  },
  async getExpensesSummary() {
    return request('/reports/expenses/summary');
  },
  async getVisitsReport(startDate: string, endDate: string) {
    const data = await request(`/reports/visits?start_date=${startDate}&end_date=${endDate}`);
    return Array.isArray(data) ? data : [];
  },
  async getOptometristActivity(startDate: string, endDate: string) {
    const data = await request(`/reports/activity/optometrist?start_date=${startDate}&end_date=${endDate}`);
    return Array.isArray(data) ? data : [];
  },
  async getPatientActivity(startDate: string, endDate: string) {
    const data = await request(`/reports/patients/activity?start_date=${startDate}&end_date=${endDate}`);
    return Array.isArray(data) ? data : [];
  },
  async getExpiryReport() {
    const data = await request('/reports/expiry');
    return Array.isArray(data) ? data : [];
  },
  async getLowStockReport() {
    const data = await request('/reports/low-stock');
    return Array.isArray(data) ? data : [];
  },
  async getCreditorsReport() {
    const data = await request('/reports/creditors');
    return Array.isArray(data) ? data : [];
  },
  async getAdmissionsReport(startDate: string, endDate: string) {
    const data = await request(`/reports/admissions?start_date=${startDate}&end_date=${endDate}`);
    return Array.isArray(data) ? data : [];
  },

  // User Management
  async getUsers() {
    return request('/users');
  },
  async createUser(data: any) {
    return request('/users', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async updateUser(id: number, data: any) {
    return request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  async deleteUser(id: number) {
    return request(`/users/${id}`, { method: 'DELETE' });
  },

  // Audit Logs
  async getAuditLogs(params: { user_id?: number, action_type?: string, start_date?: string, end_date?: string }) {
    const query = new URLSearchParams(cleanParams(params)).toString();
    const data = await request(`/audit-logs?${query}`);
    return Array.isArray(data) ? data : [];
  },

  // Settings API
  async getDbStats() {
    return request('/db-stats');
  },
  async getSettings() {
    return request('/settings');
  },
  async updateSettings(settings: any) {
    return request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  },

  async checkInPatient(patientId: string, target: string, user_name?: string) {
    return request('/check-in', {
      method: 'POST',
      body: JSON.stringify({ patient_id: patientId, target, user_name })
    });
  },
  async updateVisitStatus(visitId: string | number, status: string, performed_by?: string, reason?: string) {
    return request(`/visits/${visitId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, performed_by, reason })
    });
  },

  // Backup & Restore
  async getBackups() {
    const data = await request('/backups');
    return Array.isArray(data) ? data : [];
  },
  async triggerBackup(performed_by: string) {
    return request('/backups', {
      method: 'POST',
      body: JSON.stringify({ performed_by })
    });
  },
  async restoreBackup(file: File) {
    const formData = new FormData();
    formData.append('backup', file);
    const res = await fetch(`${API_BASE_URL}/restore`, {
      method: 'POST',
      body: formData,
      credentials: 'include' // Include session cookie
    });
    return res.json();
  },

  // Wards Management
  async getWards() {
    const data = await request('/wards');
    return Array.isArray(data) ? data : [];
  },
  async createWard(data: any) {
    return request('/wards', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async updateWard(id: number, data: any) {
    return request(`/wards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  async deleteWard(id: number) {
    return request(`/wards/${id}`, { method: 'DELETE' });
  },

  // Discounts Management
  async getDiscounts() {
    const data = await request('/discounts');
    return Array.isArray(data) ? data : [];
  },
  async createDiscount(data: any) {
    return request('/discounts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async updateDiscount(id: number, data: any) {
    return request(`/discounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  async deleteDiscount(id: number) {
    return request(`/discounts/${id}`, { method: 'DELETE' });
  },

  // Inventory Categories Management
  async getInventoryCategories() {
    const data = await request('/inventory-categories');
    return Array.isArray(data) ? data : [];
  },
  async createInventoryCategory(data: any) {
    return request('/inventory-categories', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async updateInventoryCategory(id: number, data: any) {
    return request(`/inventory-categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  async getInventoryCountByCategory(categoryName: string) {
    return request(`/inventory/count?category=${encodeURIComponent(categoryName)}`);
  },
  async deleteInventoryCategory(id: number) {
    return request(`/inventory-categories/${id}`, { method: 'DELETE' });
  },

  // Profile Management
  async getProfile(userId: number) {
    return request(`/profile/${userId}`);
  },

  async updateProfile(userId: number, data: { full_name: string, phone_number: string }) {
    return request(`/profile/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async changePassword(data: any) {
    return request('/change-password', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  
  async getNotifications(role: string) {
    const data = await request(`/notifications?role=${encodeURIComponent(role)}`);
    return Array.isArray(data) ? data : [];
  },

  async markNotificationAsRead(id: number) {
    return request(`/notifications/${id}/read`, {
      method: 'PUT'
    });
  },

  async deleteNotification(id: number) {
    return request(`/notifications/${id}`, {
      method: 'DELETE'
    });
  },

  async clearNotifications(role: string) {
    return request(`/notifications?role=${encodeURIComponent(role)}`, {
      method: 'DELETE'
    });
  },

  // Reprint Management API
  async logReprint(data: { receipt_number: string, bill_id: number, patient_id: string, reprinted_by_user_id: number }) {
    return request('/reprints/log', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getReprintLogs(params: any = {}) {
    const query = new URLSearchParams(cleanParams(params)).toString();
    const data = await request(`/reprints?${query}`);
    return Array.isArray(data) ? data : [];
  },

  async getReprintStats() {
    return request('/reprints/stats');
  },

  async flagReprint(id: number, data: { is_flagged: boolean, flag_reason?: string }) {
    return request(`/reprints/${id}/flag`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  async getReprintRestrictions(userId: number) {
    return request(`/reprints/restrictions/${userId}`);
  },

  async getAllReprintRestrictions() {
    const data = await request('/reprints/restrictions');
    return Array.isArray(data) ? data : [];
  },

  async setReprintRestriction(data: { user_id: number, user_name: string, admin_id: number, is_active: boolean, restriction_reason?: string }) {
    return request('/reprints/restrictions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getReprintSettings() {
    return request('/reprints/settings');
  },

  async updateReprintSettings(data: { daily_reprint_threshold: number, updated_by: number }) {
    return request('/reprints/settings', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  async searchReceiptsForReprint(params: { search?: string, start_date?: string, end_date?: string } = {}) {
    const query = new URLSearchParams(cleanParams(params)).toString();
    return request(`/reprints/search-receipts?${query}`);
  },

  async getReceiptForReprint(receiptNumber: string) {
    return request(`/billing/receipts/${encodeURIComponent(receiptNumber)}`);
  },

  // Investigation Templates Management
  async getInvestigationTemplates() {
    const data = await request('/settings/investigations/templates');
    return Array.isArray(data) ? data : [];
  },
  async createInvestigationTemplate(data: any) {
    return request('/settings/investigations/templates', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async updateInvestigationTemplate(id: number, data: any) {
    return request(`/settings/investigations/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  async deleteInvestigationTemplate(id: number) {
    return request(`/settings/investigations/templates/${id}`, { method: 'DELETE' });
  },
};
