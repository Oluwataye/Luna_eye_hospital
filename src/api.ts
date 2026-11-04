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

  async getPatients(params?: { search?: string; limit?: number; offset?: number; id?: string; file_no?: string }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.id) query.set('id', params.id);
    if (params?.file_no) query.set('file_no', params.file_no);
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const qs = query.toString();
    const data = await request(qs ? `/patients?${qs}` : '/patients');
    return Array.isArray(data) ? data : [];
  },

  async getPatient(id: string | number) {
    const rawId = String(id).trim();
    try {
      // Primary: URL-safe query parameter lookup (avoids slash route normalization bugs on IIS/Nginx reverse proxies)
      return await request(`/patients/by-number?file_no=${encodeURIComponent(rawId)}`);
    } catch {
      try {
        // Fallback 1: Legacy path parameter route
        return await request(`/patients/${encodeURIComponent(rawId)}`);
      } catch {
        // Fallback 2: General patients query
        const res = await request(`/patients?id=${encodeURIComponent(rawId)}`);
        if (Array.isArray(res) && res.length > 0) return res[0];
        throw new Error(`Patient ${id} not found`);
      }
    }
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

  async getTriageStats() {
    return request('/triage-stats');
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

  async createService(serviceData: any) {
    return request('/services', {
      method: 'POST',
      body: JSON.stringify(serviceData)
    });
  },

  async updateService(id: number | string, serviceData: any) {
    return request(`/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(serviceData)
    });
  },

  async deleteService(id: number | string) {
    return request(`/services/${id}`, {
      method: 'DELETE'
    });
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
    const rawId = String(id).trim();
    try {
      // Primary: URL-safe query parameter lookup
      return await request(`/patients/by-number?file_no=${encodeURIComponent(rawId)}`, {
        method: 'PUT',
        body: JSON.stringify(patientData)
      });
    } catch {
      // Fallback: Path parameter route
      return await request(`/patients/${encodeURIComponent(rawId)}`, {
        method: 'PUT',
        body: JSON.stringify(patientData)
      });
    }
  },

  // Family Households API
  async getFamilies(params?: { search?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const qs = query.toString();
    const data = await request(qs ? `/families?${qs}` : '/families');
    return Array.isArray(data) ? data : [];
  },

  async getFamily(idOrCardNumber: number | string) {
    return request(`/families/${encodeURIComponent(String(idOrCardNumber))}`);
  },

  async createFamily(familyData: any) {
    return request('/families', {
      method: 'POST',
      body: JSON.stringify(familyData)
    });
  },

  async updateFamily(id: number | string, familyData: any) {
    return request(`/families/${id}`, {
      method: 'PUT',
      body: JSON.stringify(familyData)
    });
  },

  async deleteFamily(id: number | string) {
    return request(`/families/${id}`, {
      method: 'DELETE'
    });
  },

  async addFamilyMember(familyId: number | string, memberData: any) {
    return request(`/families/${familyId}/members`, {
      method: 'POST',
      body: JSON.stringify(memberData)
    });
  },

  async linkPatientToFamily(familyId: number | string, data: { patient_id: string; relationship_to_family: string }) {
    return request(`/families/${familyId}/link-patient`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async removeFamilyMember(familyId: number | string, patientId: string) {
    return request(`/families/${familyId}/members/${encodeURIComponent(patientId)}`, {
      method: 'DELETE'
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

  async verifySupervisor(credentials: { username: string; password: string }) {
    return request('/auth/verify-supervisor', {
      method: 'POST',
      body: JSON.stringify(credentials)
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

  async getSalesReport(startDate: string, endDate: string, cashier?: string) {
    let url = `/reports/sales?start_date=${startDate}&end_date=${endDate}`;
    if (cashier) {
      url += `&cashier=${encodeURIComponent(cashier)}`;
    }
    const data = await request(url);
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
  async getDiscountsReport(startDate: string, endDate: string) {
    const data = await request(`/reports/discounts?start_date=${startDate}&end_date=${endDate}`);
    return Array.isArray(data) ? data : [];
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

  // Voice AI & Dictation Settings
  async getVoiceSettings() {
    return request('/voice/settings');
  },
  async updateVoiceSettings(data: any) {
    return request('/voice/settings', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async testVoiceLLM(data: { ollama_base_url?: string; ollama_model?: string }) {
    return request('/voice/test-llm', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Thermal Receipt Direct Raw Printing
  async printNetworkRaw(data: { ip: string; port?: number; dataBase64?: string; rawBytes?: number[] }) {
    return request('/print/network', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async testNetworkPrinter(data: { ip: string; port?: number }) {
    return request('/print/test', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // ── Expenses CRUD ──────────────────────────────────────────────────────────
  async getExpenses(params: { start_date?: string; end_date?: string; category?: string; expense_type?: string } = {}) {
    const q = new URLSearchParams(params as any).toString();
    return request(`/expenses${q ? '?' + q : ''}`);
  },
  async createExpense(data: any) {
    return request('/expenses', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateExpense(id: number, data: any) {
    return request(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deleteExpense(id: number) {
    return request(`/expenses/${id}`, { method: 'DELETE' });
  },

  // ── Staff Salaries ────────────────────────────────────────────────────────
  async getStaffSalaries(params: { status?: 'active' | 'archived' | 'all' } = {}) {
    const q = new URLSearchParams(params as any).toString();
    return request(`/staff-salaries${q ? '?' + q : ''}`);
  },
  async createStaffSalary(data: any) {
    return request('/staff-salaries', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateStaffSalary(id: number, data: any) {
    return request(`/staff-salaries/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deleteStaffSalary(id: number) {
    return request(`/staff-salaries/${id}`, { method: 'DELETE' });
  },
  async restoreStaffSalary(id: number) {
    return request(`/staff-salaries/${id}/restore`, { method: 'PUT' });
  },

  // ── Payroll ───────────────────────────────────────────────────────────────
  async getPayroll(month_year?: string) {
    return request(`/payroll${month_year ? '?month_year=' + month_year : ''}`);
  },
  async getPayrollSummary(month_year?: string) {
    return request(`/payroll/summary${month_year ? '?month_year=' + month_year : ''}`);
  },
  async runPayroll(month_year: string) {
    return request('/payroll/run', { method: 'POST', body: JSON.stringify({ month_year }) });
  },
  async postPayrollToExpenses(month_year: string) {
    return request('/payroll/post-to-expenses', { method: 'POST', body: JSON.stringify({ month_year }) });
  },
  async markPayrollEntryPaid(id: number, data: any) {
    return request(`/payroll/${id}/pay`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deletePayroll(month_year: string) {
    return request(`/payroll/${month_year}`, { method: 'DELETE' });
  },

  // ── Tax Records ───────────────────────────────────────────────────────────
  async getTaxRecords(params: { tax_type?: string; period?: string; status?: string } = {}) {
    const q = new URLSearchParams(params as any).toString();
    return request(`/tax-records${q ? '?' + q : ''}`);
  },
  async getTaxSummary(period?: string) {
    return request(`/tax-records/summary${period ? '?period=' + period : ''}`);
  },
  async remitTaxRecord(id: number, data: { remittance_date?: string; remittance_ref?: string }) {
    return request(`/tax-records/${id}/remit`, { method: 'PUT', body: JSON.stringify(data) });
  },

  // ── Procurement Payment Update ────────────────────────────────────────────
  async updateProcurementPayment(id: number, data: { amount_paid: number; payment_ref?: string; notes?: string }) {
    return request(`/procurement/${id}/payment`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async getProcurementWhtSummary(params: { start_date?: string; end_date?: string } = {}) {
    const q = new URLSearchParams(params as any).toString();
    return request(`/reports/procurement/wht-summary${q ? '?' + q : ''}`);
  },
  async getProcurementById(id: number) {
    return request(`/procurement/${id}`);
  },
  async updateProcurement(id: number, data: any) {
    return request(`/procurement/${id}/edit`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deleteProcurement(id: number) {
    return request(`/procurement/${id}`, { method: 'DELETE' });
  },
  async getProfitLossTrend(months = 12) {
    const data = await request(`/reports/profit-loss/monthly-trend?months=${months}`);
    return Array.isArray(data) ? data : [];
  },

  // ── Medical Insurance & Claims Module ────────────────────────────────────
  insurance: {
    // Payers
    getPayers: (activeOnly = false) => request(`/insurance/payers${activeOnly ? '?active_only=true' : ''}`),
    getPayer: (id: number) => request(`/insurance/payers/${id}`),
    createPayer: (data: any) => request('/insurance/payers', { method: 'POST', body: JSON.stringify(data) }),
    updatePayer: (id: number, data: any) => request(`/insurance/payers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deletePayer: (id: number) => request(`/insurance/payers/${id}`, { method: 'DELETE' }),

    // Plans
    getPlans: (payerId?: number) => request(`/insurance/plans${payerId ? `?payer_id=${payerId}` : ''}`),
    createPlan: (data: any) => request('/insurance/plans', { method: 'POST', body: JSON.stringify(data) }),
    updatePlan: (id: number, data: any) => request(`/insurance/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deletePlan: (id: number) => request(`/insurance/plans/${id}`, { method: 'DELETE' }),

    // Tariffs
    getTariffs: (params: any = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/insurance/tariffs${q ? `?${q}` : ''}`);
    },
    createTariff: (data: any) => request('/insurance/tariffs', { method: 'POST', body: JSON.stringify(data) }),
    updateTariff: (id: number, data: any) => request(`/insurance/tariffs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteTariff: (id: number) => request(`/insurance/tariffs/${id}`, { method: 'DELETE' }),
    lookupTariff: (payerId: number, planId: number, itemType: string, itemCode: string) => {
      const q = new URLSearchParams({ payer_id: String(payerId), plan_id: String(planId), item_type: itemType, item_code: itemCode }).toString();
      return request(`/insurance/tariffs/lookup?${q}`);
    },

    // Enrollees
    getEnrollees: (params: any = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/insurance/enrollees${q ? `?${q}` : ''}`);
    },
    getEnrollee: (id: number) => request(`/insurance/enrollees/${id}`),
    createEnrollee: (data: any) => request('/insurance/enrollees', { method: 'POST', body: JSON.stringify(data) }),
    updateEnrollee: (id: number, data: any) => request(`/insurance/enrollees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    verifyEnrollee: (id: number, verification_status: string) => request(`/insurance/enrollees/${id}/verify`, { method: 'PATCH', body: JSON.stringify({ verification_status }) }),

    // Authorizations
    getAuthorizations: (params: any = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/insurance/authorizations${q ? `?${q}` : ''}`);
    },
    createAuthorization: (data: any) => request('/insurance/authorizations', { method: 'POST', body: JSON.stringify(data) }),
    decisionAuthorization: (id: number, data: any) => request(`/insurance/authorizations/${id}/decision`, { method: 'PATCH', body: JSON.stringify(data) }),

    // Claims
    getClaimsSummary: () => request('/insurance/claims/summary'),
    getClaims: (params: any = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/insurance/claims${q ? `?${q}` : ''}`);
    },
    getClaim: (id: number) => request(`/insurance/claims/${id}`),
    createClaim: (data: any) => request('/insurance/claims', { method: 'POST', body: JSON.stringify(data) }),
    updateClaim: (id: number, data: any) => request(`/insurance/claims/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateClaimItems: (id: number, items: any[]) => request(`/insurance/claims/${id}/items`, { method: 'PUT', body: JSON.stringify({ items }) }),
    transitionClaim: (id: number, to_status: string, reason?: string, note?: string) => 
      request(`/insurance/claims/${id}/transition`, { method: 'PATCH', body: JSON.stringify({ to_status, reason, note }) }),
    writeOffClaim: (id: number, reason: string) => request(`/insurance/claims/${id}/write-off`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
    addClaimNote: (id: number, note: string) => request(`/insurance/claims/${id}/notes`, { method: 'POST', body: JSON.stringify({ note }) }),

    // Batches
    getBatches: (params: any = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/insurance/batches${q ? `?${q}` : ''}`);
    },
    createBatch: (data: any) => request('/insurance/batches', { method: 'POST', body: JSON.stringify(data) }),
    getBatchClaims: (id: number) => request(`/insurance/batches/${id}/claims`),
    submitBatch: (id: number, notes?: string) => request(`/insurance/batches/${id}/submit`, { method: 'PATCH', body: JSON.stringify({ notes }) }),

    // Remittances
    getRemittances: (params: any = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/insurance/remittances${q ? `?${q}` : ''}`);
    },
    getRemittance: (id: number) => request(`/insurance/remittances/${id}`),
    createRemittance: (data: any) => request('/insurance/remittances', { method: 'POST', body: JSON.stringify(data) }),
    allocateRemittance: (id: number, allocations: any[]) => request(`/insurance/remittances/${id}/allocate`, { method: 'POST', body: JSON.stringify({ allocations }) }),

    // Utilities & Settings
    getRejectionReasons: () => request('/insurance/rejection-reasons'),
    getIcd10: (q?: string) => request(`/insurance/icd10${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    getSettings: () => request('/insurance/settings'),
    updateSettings: (data: any) => request('/insurance/settings', { method: 'PUT', body: JSON.stringify(data) }),

    // Reports
    getReport: (reportName: string, params: any = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/insurance/reports/${reportName}${q ? `?${q}` : ''}`);
    },

    // ── Bulk Tariff Import ───────────────────────────────────────────
    /** Download the CSV template for bulk HMO tariff upload */
    downloadTariffTemplate: async (): Promise<void> => {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch(`${baseUrl}/api/insurance/tariffs/template`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (!res.ok) throw new Error('Failed to download template');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hmo_tariff_template.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    /** Import tariff rows in bulk (array of parsed CSV objects) */
    importTariffs: (data: { payer_id: number; plan_id?: number | null; rows: any[] }) =>
      request('/insurance/tariffs/import', { method: 'POST', body: JSON.stringify(data) }),

    // ── EDI Clearinghouse Bridge ─────────────────────────────────────
    getEdiConfigs: () => request('/insurance/edi/configs'),
    getEdiConfig: (payerId: number) => request(`/insurance/edi/configs/${payerId}`),
    updateEdiConfig: (payerId: number, data: any) =>
      request(`/insurance/edi/configs/${payerId}`, { method: 'PUT', body: JSON.stringify(data) }),
    transmitBatch: (batchId: number, sync = false) =>
      request(`/insurance/edi/transmit/${batchId}${sync ? '?sync=true' : ''}`, { method: 'POST' }),
    getBatchEdiJob: (batchId: number) => request(`/insurance/edi/jobs/${batchId}`),
    getEdiJobs: (limit = 50) => request(`/insurance/edi/jobs?limit=${limit}`),
    retryEdiJob: (jobId: number) => request(`/insurance/edi/jobs/${jobId}/retry`, { method: 'POST' }),
    previewBatchEdi: (batchId: number, format: 'JSON' | 'CSV' = 'JSON') =>
      request(`/insurance/edi/preview/${batchId}?format=${format}`),
    getEdiTransmissions: () => request('/insurance/edi/transmissions'),
  },
};

export default api;





