// Luna Eye Hospital API Client
export const API_BASE_URL = '/api';

const request = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && token !== 'null' && token !== 'undefined' ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  const res = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `Request failed: ${res.status}`);
  }

  return res.json();
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
      body: JSON.stringify(credentials)
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Login failed');
    }
    return res.json();
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

  async dischargePatient(id: string, summary: string) {
    return request(`/admissions/${id}/discharge`, {
      method: 'PUT',
      body: JSON.stringify({ summary })
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

  async getInvestigations(patientId?: string, status?: string) {
    let url = '/investigations?';
    if (patientId) url += `patient_id=${patientId}&`;
    if (status) url += `status=${status}`;
    const data = await request(url);
    return Array.isArray(data) ? data : [];
  },

  async requestInvestigation(data: {patient_id: string, test_name: string, requested_by: string}) {
    return request('/investigations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateInvestigationResult(id: number, data: { results_notes?: string, status?: string }) {
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
    const query = new URLSearchParams(params as any).toString();
    const data = await request(`/audit-logs?${query}`);
    return Array.isArray(data) ? data : [];
  },

  // Settings API
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
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('backup', file);
    const res = await fetch(`${API_BASE_URL}/restore`, {
      method: 'POST',
      headers: {
        ...(token && token !== 'null' && token !== 'undefined' ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: formData
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

  // Reprint Management API
  async logReprint(data: { receipt_number: string, bill_id: number, patient_id: string, reprinted_by_user_id: number }) {
    return request('/reprints/log', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getReprintLogs(params: any = {}) {
    const query = new URLSearchParams(params).toString();
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

  async getReceiptForReprint(receiptNumber: string) {
    return request(`/billing/receipts/${encodeURIComponent(receiptNumber)}`);
  },


};
