import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DollarSign, Plus, Search, Edit2, Trash2,
  CheckCircle, XCircle, RefreshCw,
  Upload, Download, AlertTriangle, FileText
} from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../context/NotificationContext';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { InsuranceNavHeader } from './InsuranceNavHeader';
import {
  InsuranceModal,
  FormField,
  FormInput,
  FormSelect,
  FormButton,
  FormGrid,
  FormSection
} from '../../components/insurance';
import './Insurance.css';

// ─── RFC 4180 Quote-Aware CSV Parser (browser-safe, zero deps) ────────────
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsvText(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (values[i] || '').trim(); });
    return row;
  }).filter((r) => Object.values(r).some(Boolean));
}

const ITEM_TYPE_OPTIONS = [
  { value: 'SERVICE', label: 'Medical Service / Consultation' },
  { value: 'INVESTIGATION', label: 'Diagnostic / Laboratory' },
  { value: 'SURGERY', label: 'Surgical Procedure' },
  { value: 'MEDICATION', label: 'Medication' },
  { value: 'FRAME', label: 'Optical Frame' },
  { value: 'LENS', label: 'Optical Lens' },
  { value: 'OPTICAL', label: 'Optical (Other)' },
  { value: 'LAB', label: 'Lab Test' },
];

const EMPTY_MODAL = {
  open: false,
  editingId: null as number | null,
  payer_id: '',
  plan_id: '',
  item_type: 'SERVICE',
  item_ref_id: '',
  item_description: '',
  payer_price: 0,
  covered: true,
  requires_preauth: false,
};

export const InsuranceTariffs: React.FC = () => {
  const { notify } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tariffs, setTariffs] = useState<any[]>([]);
  const [payers, setPayers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [payerFilter, setPayerFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState('');

  const [modal, setModal] = useState(EMPTY_MODAL);

  const [importModal, setImportModal] = useState(false);
  const [importPayerId, setImportPayerId] = useState('');
  const [importPlanId, setImportPlanId] = useState('');
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importProgress, setImportProgress] = useState<{
    currentChunk: number;
    totalChunks: number;
    percent: number;
    created: number;
    updated: number;
    failed: number;
    statusText: string;
  } | null>(null);
  const abortImportRef = useRef<boolean>(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tarRes, payersRes, plansRes] = await Promise.all([
        api.insurance.getTariffs({
          payer_id: payerFilter || undefined,
          plan_id: planFilter || undefined,
          item_type: itemTypeFilter || undefined,
        }),
        api.insurance.getPayers(true),
        api.insurance.getPlans(),
      ]);
      setTariffs(tarRes || []);
      setPayers(payersRes || []);
      setPlans(plansRes || []);
    } catch (err: any) {
      notify('error', err.message || 'Failed to load tariffs');
    } finally {
      setLoading(false);
    }
  }, [payerFilter, planFilter, itemTypeFilter, notify]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    if (!modal.payer_id || !modal.item_description.trim() || modal.payer_price < 0) {
      notify('error', 'Payer, Description, and Price are required');
      return;
    }
    try {
      const payload = {
        payer_id: parseInt(modal.payer_id),
        plan_id: modal.plan_id ? parseInt(modal.plan_id) : null,
        item_type: modal.item_type,
        item_ref_id: modal.item_ref_id || 'GEN',
        item_description: modal.item_description,
        payer_price_kobo: Math.round(modal.payer_price * 100),
        covered: modal.covered ? 1 : 0,
        requires_preauth: modal.requires_preauth ? 1 : 0,
      };
      if (modal.editingId) {
        await api.insurance.updateTariff(modal.editingId, payload);
        notify('success', 'Tariff updated successfully');
      } else {
        await api.insurance.createTariff(payload);
        notify('success', 'New tariff rate added');
      }
      setModal(EMPTY_MODAL);
      loadData();
    } catch (err: any) {
      notify('error', err.message || 'Save failed');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this tariff record?')) return;
    try {
      await api.insurance.deleteTariff(id);
      notify('success', 'Tariff removed');
      loadData();
    } catch (err: any) {
      notify('error', err.message || 'Delete failed');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const rows = parseCsvText(text);
      const warnings: string[] = [];
      rows.forEach((row, i) => {
        const code = row.item_ref_id || row.item_code || '';
        const price = parseFloat(row.payer_price_naira || row.price || '0');
        if (!code) warnings.push(`Row ${i + 2}: Missing item code`);
        if (!row.item_description && !row.description) warnings.push(`Row ${i + 2}: Missing description`);
        if (isNaN(price) || price < 0) warnings.push(`Row ${i + 2}: Invalid price`);
      });
      setImportRows(rows);
      setImportWarnings(warnings);
      setImportResult(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRunImport = async () => {
    if (!importPayerId) { notify('error', 'Select a payer first'); return; }
    if (importRows.length === 0) { notify('error', 'No rows to import'); return; }

    const CHUNK_SIZE = 500;
    const totalChunks = Math.ceil(importRows.length / CHUNK_SIZE);
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalFailed = 0;
    const errors: string[] = [];
    abortImportRef.current = false;

    setImporting(true);
    setImportResult(null);
    setImportProgress({
      currentChunk: 0,
      totalChunks,
      percent: 0,
      created: 0,
      updated: 0,
      failed: 0,
      statusText: `Streaming ${importRows.length} rows across ${totalChunks} chunk(s)...`,
    });

    try {
      for (let i = 0; i < totalChunks; i++) {
        if (abortImportRef.current) {
          notify('info', 'Bulk import paused/aborted by user');
          break;
        }

        const chunk = importRows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const currentChunk = i + 1;
        const percent = Math.round((currentChunk / totalChunks) * 100);

        try {
          const res = await api.insurance.importTariffs({
            payer_id: parseInt(importPayerId),
            plan_id: importPlanId ? parseInt(importPlanId) : null,
            rows: chunk,
          });
          totalCreated += res.created || 0;
          totalUpdated += res.updated || 0;
          totalFailed += res.failed || 0;
          if (res.errors?.length) {
            errors.push(...res.errors);
          }
        } catch (chunkErr: any) {
          totalFailed += chunk.length;
          errors.push(`Chunk ${currentChunk} error: ${chunkErr.message || 'Network error'}`);
        }

        setImportProgress({
          currentChunk,
          totalChunks,
          percent,
          created: totalCreated,
          updated: totalUpdated,
          failed: totalFailed,
          statusText: `Chunk ${currentChunk} of ${totalChunks} processed (${percent}%)`,
        });
      }

      setImportResult({
        total: totalCreated + totalUpdated + totalFailed,
        created: totalCreated,
        updated: totalUpdated,
        failed: totalFailed,
        errors: errors.slice(0, 15),
      });

      notify('success', `Import complete: ${totalCreated} created, ${totalUpdated} updated${totalFailed > 0 ? `, ${totalFailed} errors` : ''}`);
      loadData();
    } catch (err: any) {
      notify('error', err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleAbortImport = () => {
    abortImportRef.current = true;
  };

  const closeImportModal = () => {
    if (importing) {
      abortImportRef.current = true;
    }
    setImportModal(false);
    setImportRows([]);
    setImportWarnings([]);
    setImportResult(null);
    setImportProgress(null);
    setImportPayerId('');
    setImportPlanId('');
  };

  const formatNaira = (kobo: number) => {
    const amount = (kobo || 0) / 100;
    return `\u20a6${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const filteredTariffs = tariffs.filter((t) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      t.item_description?.toLowerCase().includes(term) ||
      t.item_ref_id?.toLowerCase().includes(term) ||
      t.payer_name?.toLowerCase().includes(term)
    );
  });

  const availablePlans = plans.filter(
    (p) => !modal.payer_id || p.payer_id === parseInt(modal.payer_id)
  );

  const importAvailablePlans = plans.filter(
    (p) => !importPayerId || p.payer_id === parseInt(importPayerId)
  );

  return (
    <div className="insurance-container">
      <InsuranceNavHeader
        title="Payer Tariff Schedules"
        subtitle="Agreed pricing contracts and pre-authorization requirements per HMO"
        actions={
          <>
            <button
              className="btn-leh-forest"
              onClick={() => setModal({ ...EMPTY_MODAL, open: true, payer_id: payers[0]?.id ? String(payers[0].id) : '' })}
            >
              <Plus size={15} /> Add Tariff Rate
            </button>
            <button
              className="btn-leh-secondary"
              onClick={() => setImportModal(true)}
            >
              <Upload size={15} /> Bulk Import CSV
            </button>
            <button
              className="btn-leh-secondary"
              onClick={loadData}
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </>
        }
      />

      <div className="insurance-card">
        <div className="insurance-filter-bar">
          <div className="insurance-search-input">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search by code, procedure, service..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="insurance-filter-select" style={{ minWidth: '180px' }} value={payerFilter} onChange={(e) => setPayerFilter(e.target.value)}>
            <option value="">All Payers</option>
            {payers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {payerFilter && (
            <select className="insurance-filter-select" style={{ minWidth: '160px' }} value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
              <option value="">All Plans</option>
              {plans.filter((pl) => pl.payer_id === parseInt(payerFilter)).map((pl) => (
                <option key={pl.id} value={pl.id}>{pl.plan_name}</option>
              ))}
            </select>
          )}
          <select className="insurance-filter-select" style={{ minWidth: '160px' }} value={itemTypeFilter} onChange={(e) => setItemTypeFilter(e.target.value)}>
            <option value="">All Categories</option>
            {ITEM_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {(search || payerFilter || planFilter || itemTypeFilter) && (
            <button className="btn-leh-secondary" style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem' }} onClick={() => { setSearch(''); setPayerFilter(''); setPlanFilter(''); setItemTypeFilter(''); }}>Clear</button>
          )}
        </div>

        <div className="insurance-table-container">
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}><LoadingSpinner /></div>
          ) : filteredTariffs.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--leh-muted)' }}>
              <DollarSign size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>No tariff schedules configured. Use <strong>Bulk Import CSV</strong> or <strong>Add Tariff Rate</strong>.</p>
            </div>
          ) : (
            <table className="insurance-table">
              <thead>
                <tr>
                  <th>Payer</th><th>Plan</th><th>Category</th><th>Code</th><th>Item Description</th>
                  <th style={{ textAlign: 'right' }}>Agreed Price</th>
                  <th style={{ textAlign: 'center' }}>Covered?</th>
                  <th style={{ textAlign: 'center' }}>Pre-Auth?</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTariffs.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.payer_name}</td>
                    <td style={{ fontSize: '0.85rem' }}>{t.plan_name || 'All Plans'}</td>
                    <td><span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 6px', background: '#f1f5f9', borderRadius: '4px' }}>{t.item_type}</span></td>
                    <td>{t.item_ref_id || '\u2014'}</td>
                    <td style={{ fontWeight: 500 }}>{t.item_description}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--leh-forest)' }}>{formatNaira(t.payer_price_kobo)}</td>
                    <td style={{ textAlign: 'center' }}>{t.covered ? <CheckCircle size={16} color="#15803d" /> : <XCircle size={16} color="#dc2626" />}</td>
                    <td style={{ textAlign: 'center' }}>{t.requires_preauth ? <span className="ins-badge ins-badge--under_review">Required</span> : <span style={{ color: 'var(--leh-muted)' }}>No</span>}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button className="btn btn-sm btn-link" onClick={() => setModal({
                          open: true, editingId: t.id,
                          payer_id: String(t.payer_id),
                          plan_id: t.plan_id ? String(t.plan_id) : '',
                          item_type: t.item_type,
                          item_ref_id: t.item_ref_id || '',
                          item_description: t.item_description,
                          payer_price: (t.payer_price_kobo || 0) / 100,
                          covered: !!t.covered,
                          requires_preauth: !!t.requires_preauth,
                        })}><Edit2 size={14} /></button>
                        <button className="btn btn-sm btn-link text-danger" onClick={() => handleDelete(t.id)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      <InsuranceModal
        isOpen={modal.open}
        onClose={() => setModal(EMPTY_MODAL)}
        title={modal.editingId ? 'Edit Agreed Tariff' : 'Add Agreed Tariff Rate'}
        subtitle="Define contracted fee schedule and pre-authorization policy"
        icon={<DollarSign size={20} />}
        size="md"
        isDirty={Boolean(modal.payer_id || modal.item_description || modal.payer_price > 0)}
        footer={
          <>
            <FormButton
              type="button"
              variant="secondary"
              onClick={() => setModal(EMPTY_MODAL)}
            >
              Cancel
            </FormButton>
            <FormButton
              type="button"
              variant="primary"
              disabled={!modal.payer_id || !modal.item_description.trim() || modal.payer_price < 0}
              onClick={handleSave}
            >
              {modal.editingId ? 'Save Changes' : 'Save Tariff'}
            </FormButton>
          </>
        }
      >
        <FormSection title="Payer & Plan Classification">
          <FormGrid>
            <FormField id="tariff-payer" label="Payer / HMO" required>
              <FormSelect
                id="tariff-payer"
                value={modal.payer_id}
                onChange={(e) => setModal({ ...modal, payer_id: e.target.value, plan_id: '' })}
                placeholderOption="Choose Payer"
              >
                {payers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </FormSelect>
            </FormField>

            <FormField id="tariff-plan" label="Plan (Optional)" helperText="Applies to all plans if unselected">
              <FormSelect
                id="tariff-plan"
                value={modal.plan_id}
                onChange={(e) => setModal({ ...modal, plan_id: e.target.value })}
                placeholderOption="All Plans Under Payer"
              >
                {availablePlans.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.plan_name}
                  </option>
                ))}
              </FormSelect>
            </FormField>

            <FormField id="tariff-cat" label="Service Category">
              <FormSelect
                id="tariff-cat"
                value={modal.item_type}
                onChange={(e) => setModal({ ...modal, item_type: e.target.value })}
              >
                {ITEM_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </FormSelect>
            </FormField>

            <FormField id="tariff-code" label="Item Code / Ref ID" helperText="Internal code or NHIA tariff ref">
              <FormInput
                id="tariff-code"
                type="text"
                placeholder="e.g. VIS-OCT-01"
                value={modal.item_ref_id}
                onChange={(e) => setModal({ ...modal, item_ref_id: e.target.value })}
              />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Description & Agreed Rate">
          <FormGrid>
            <FormField id="tariff-desc" label="Procedure / Item Description" required fullWidth>
              <FormInput
                id="tariff-desc"
                type="text"
                placeholder="e.g. Visual Field Analysis (Humphrey)"
                value={modal.item_description}
                onChange={(e) => setModal({ ...modal, item_description: e.target.value })}
              />
            </FormField>

            <FormField id="tariff-price" label="Payer Agreed Price (₦)" required fullWidth>
              <FormInput
                id="tariff-price"
                type="number"
                currency
                min={0}
                placeholder="0.00"
                value={modal.payer_price || ''}
                onChange={(e) => setModal({ ...modal, payer_price: parseFloat(e.target.value) || 0 })}
              />
            </FormField>

            <div
              className="ins-col-span-2"
              style={{
                display: 'flex',
                gap: '24px',
                padding: '12px 16px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                flexWrap: 'wrap'
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  color: 'var(--leh-ink)'
                }}
              >
                <input
                  type="checkbox"
                  style={{ width: '16px', height: '16px', accentColor: 'var(--leh-forest)' }}
                  checked={modal.covered}
                  onChange={(e) => setModal({ ...modal, covered: e.target.checked })}
                />
                <span>Covered by Payer</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  color: 'var(--leh-ink)'
                }}
              >
                <input
                  type="checkbox"
                  style={{ width: '16px', height: '16px', accentColor: 'var(--leh-forest)' }}
                  checked={modal.requires_preauth}
                  onChange={(e) => setModal({ ...modal, requires_preauth: e.target.checked })}
                />
                <span>Requires Pre-Authorization</span>
              </label>
            </div>
          </FormGrid>
        </FormSection>
      </InsuranceModal>


      {/* Bulk Import Modal */}
      <InsuranceModal
        isOpen={importModal}
        onClose={closeImportModal}
        title="Bulk Tariff Import — HMO CSV Upload"
        subtitle="Upload contracted pricing catalog from Excel / CSV template"
        icon={<Upload size={20} />}
        size="lg"
        isDirty={importRows.length > 0}
        footer={
          <>
            {importing ? (
              <FormButton variant="danger" type="button" onClick={handleAbortImport}>
                Stop Import
              </FormButton>
            ) : (
              <FormButton variant="secondary" type="button" onClick={closeImportModal}>
                Close
              </FormButton>
            )}
            <FormButton
              variant="primary"
              type="button"
              disabled={!importPayerId || importRows.length === 0 || importing}
              onClick={handleRunImport}
              loading={importing}
              icon={!importing ? <Upload size={15} /> : undefined}
            >
              {importing
                ? `Processing Chunk ${importProgress?.currentChunk || 1}…`
                : `Run Import (${importRows.length} rows)`}
            </FormButton>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Step 1 */}
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '10px',
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div>
              <strong style={{ fontSize: '14px', color: '#14532d' }}>Step 1 — Download the CSV template</strong>
              <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#166534' }}>
                Open in Excel, fill tariff rows, then save as CSV before uploading.
              </p>
            </div>
            <FormButton
              variant="secondary"
              type="button"
              icon={<Download size={14} />}
              onClick={() => api.insurance.downloadTariffTemplate().catch((e: any) => notify('error', e.message))}
            >
              Download Template
            </FormButton>
          </div>

          {/* Step 2 */}
          <FormSection title="Step 2 — Select Payer & Target Plan">
            <FormGrid>
              <FormField id="import-payer" label="Select Payer" required>
                <FormSelect
                  id="import-payer"
                  value={importPayerId}
                  onChange={(e) => {
                    setImportPayerId(e.target.value);
                    setImportPlanId('');
                  }}
                  placeholderOption="Choose HMO / Payer"
                >
                  {payers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </FormSelect>
              </FormField>

              <FormField id="import-plan" label="Target Plan (Optional)">
                <FormSelect
                  id="import-plan"
                  value={importPlanId}
                  onChange={(e) => setImportPlanId(e.target.value)}
                  disabled={!importPayerId}
                  placeholderOption="Apply to All Plans Under Payer"
                >
                  {importAvailablePlans.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.plan_name}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
            </FormGrid>
          </FormSection>

          {/* Step 3 */}
          <FormSection title="Step 3 — Upload CSV File">
            <div
              style={{
                border: '2px dashed var(--leh-border, #cbd5e1)',
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center',
                cursor: 'pointer',
                background: '#f8fafc',
                transition: 'border-color 0.2s'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText size={32} style={{ color: 'var(--leh-forest)', margin: '0 auto 8px auto' }} />
              <p style={{ margin: 0, color: 'var(--leh-ink)', fontSize: '14.5px', fontWeight: 600 }}>
                Click to browse or drag a <strong>.csv</strong> file here
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--leh-muted)' }}>
                Columns: item_type, item_ref_id, item_description, payer_price_naira, covered, requires_preauth
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>
          </FormSection>

          {/* Warnings */}
          {importWarnings.length > 0 && (
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fcd34d',
                borderRadius: '10px',
                padding: '12px 16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <AlertTriangle size={16} color="#d97706" />
                <strong style={{ fontSize: '13.5px', color: '#92400e' }}>
                  {importWarnings.length} warning(s) — valid rows will still be imported
                </strong>
              </div>
              {importWarnings.slice(0, 5).map((w, i) => (
                <div key={i} style={{ fontSize: '12.5px', color: '#78350f' }}>
                  {w}
                </div>
              ))}
              {importWarnings.length > 5 && (
                <div style={{ fontSize: '12.5px', color: '#92400e', marginTop: '4px' }}>
                  …and {importWarnings.length - 5} more
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          {importRows.length > 0 && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}
              >
                <strong style={{ fontSize: '14px', color: 'var(--leh-ink)' }}>
                  Preview — {importRows.length} row(s) parsed
                </strong>
                <span style={{ fontSize: '12.5px', color: 'var(--leh-muted)' }}>Showing first 5 rows</span>
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table className="insurance-table" style={{ marginBottom: 0 }}>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Code</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Price (₦)</th>
                      <th style={{ textAlign: 'center' }}>Covered</th>
                      <th style={{ textAlign: 'center' }}>Pre-Auth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        <td>
                          <span
                            style={{
                              fontSize: '11px',
                              background: '#f1f5f9',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 600
                            }}
                          >
                            {(row.item_type || 'SERVICE').toUpperCase()}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                          {row.item_ref_id || row.item_code || '—'}
                        </td>
                        <td>{row.item_description || row.description || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          ₦{parseFloat(row.payer_price_naira || row.price || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {row.covered === '0' || row.is_covered === '0' ? (
                            <XCircle size={15} color="#dc2626" />
                          ) : (
                            <CheckCircle size={15} color="#16a34a" />
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {row.requires_preauth === '1' || row.requires_authorization === '1' ? (
                            <CheckCircle size={15} color="#d97706" />
                          ) : (
                            <span style={{ color: 'var(--leh-muted)', fontSize: '12px' }}>No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {importRows.length > 5 && (
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            textAlign: 'center',
                            color: 'var(--leh-muted)',
                            fontSize: '12.5px',
                            padding: '8px'
                          }}
                        >
                          …{importRows.length - 5} more rows not shown
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Streaming Progress Bar */}
          {importProgress && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '14px 18px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                  fontSize: '13.5px'
                }}
              >
                <span style={{ fontWeight: 600, color: '#334155' }}>{importProgress.statusText}</span>
                <span style={{ fontWeight: 700, color: 'var(--leh-forest)' }}>{importProgress.percent}%</span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '8px',
                  background: '#e2e8f0',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    width: `${importProgress.percent}%`,
                    height: '100%',
                    background: 'var(--leh-forest)',
                    transition: 'width 0.25s ease'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '20px', marginTop: '8px', fontSize: '12.5px' }}>
                <span style={{ color: '#15803d' }}>
                  + <strong>{importProgress.created}</strong> created
                </span>
                <span style={{ color: '#1d4ed8' }}>
                  ~ <strong>{importProgress.updated}</strong> updated
                </span>
                {importProgress.failed > 0 && (
                  <span style={{ color: '#dc2626' }}>
                    ! <strong>{importProgress.failed}</strong> failed
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Result */}
          {importResult && (
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: '10px',
                padding: '14px 18px'
              }}
            >
              <strong style={{ color: '#15803d', fontSize: '14px' }}>✓ Import Completed Successfully</strong>
              <div style={{ marginTop: '6px', fontSize: '13px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <span>
                  Total: <strong>{importResult.total}</strong>
                </span>
                <span style={{ color: '#15803d' }}>
                  Created: <strong>{importResult.created}</strong>
                </span>
                <span style={{ color: '#1d4ed8' }}>
                  Updated: <strong>{importResult.updated}</strong>
                </span>
                {importResult.failed > 0 && (
                  <span style={{ color: '#dc2626' }}>
                    Failed: <strong>{importResult.failed}</strong>
                  </span>
                )}
              </div>
              {importResult.errors?.length > 0 &&
                importResult.errors.map((e: string, i: number) => (
                  <div key={i} style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>
                    {e}
                  </div>
                ))}
            </div>
          )}
        </div>
      </InsuranceModal>

    </div>
  );
};
