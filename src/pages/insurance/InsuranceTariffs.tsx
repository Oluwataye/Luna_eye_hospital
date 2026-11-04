import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DollarSign, Plus, Search, Edit2, Trash2,
  CheckCircle, XCircle, RefreshCw, X,
  Upload, Download, AlertTriangle, FileText
} from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../context/NotificationContext';
import { LoadingSpinner } from '../../components/LoadingSpinner';
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
      <div className="insurance-header">
        <div>
          <h1 className="insurance-title">Payer Tariff Schedules</h1>
          <p className="insurance-subtitle">Agreed pricing contracts and pre-authorization requirements per HMO</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--leh-forest)' }}
            onClick={() => setModal({ ...EMPTY_MODAL, open: true, payer_id: payers[0]?.id ? String(payers[0].id) : '' })}
          >
            <Plus size={16} /> Add Tariff Rate
          </button>
          <button
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            onClick={() => setImportModal(true)}
          >
            <Upload size={16} /> Bulk Import CSV
          </button>
          <button className="btn btn-secondary" onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      <div className="insurance-card">
        <div className="insurance-filter-bar">
          <div className="insurance-search-input">
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--leh-muted)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '32px', height: '36px' }}
              placeholder="Search by code, procedure, service..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="form-select" style={{ width: '180px', height: '36px' }} value={payerFilter} onChange={(e) => setPayerFilter(e.target.value)}>
            <option value="">All Payers</option>
            {payers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {payerFilter && (
            <select className="form-select" style={{ width: '160px', height: '36px' }} value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
              <option value="">All Plans</option>
              {plans.filter((pl) => pl.payer_id === parseInt(payerFilter)).map((pl) => (
                <option key={pl.id} value={pl.id}>{pl.plan_name}</option>
              ))}
            </select>
          )}
          <select className="form-select" style={{ width: '160px', height: '36px' }} value={itemTypeFilter} onChange={(e) => setItemTypeFilter(e.target.value)}>
            <option value="">All Categories</option>
            {ITEM_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {(search || payerFilter || planFilter || itemTypeFilter) && (
            <button className="btn btn-sm btn-outline-secondary" onClick={() => { setSearch(''); setPayerFilter(''); setPlanFilter(''); setItemTypeFilter(''); }}>Clear</button>
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
      {modal.open && (
        <div className="ins-modal-overlay">
          <div className="ins-modal">
            <div className="ins-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{modal.editingId ? 'Edit Tariff Schedule' : 'Add Agreed Tariff Rate'}</h3>
              <button className="btn btn-sm btn-link" onClick={() => setModal(EMPTY_MODAL)}><X size={20} /></button>
            </div>
            <div className="ins-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Payer *</label>
                  <select className="form-select" value={modal.payer_id} onChange={(e) => setModal({ ...modal, payer_id: e.target.value, plan_id: '' })}>
                    <option value="">-- Choose Payer --</option>
                    {payers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Plan (Optional)</label>
                  <select className="form-select" value={modal.plan_id} onChange={(e) => setModal({ ...modal, plan_id: e.target.value })}>
                    <option value="">-- All Plans Under Payer --</option>
                    {availablePlans.map((pl) => <option key={pl.id} value={pl.id}>{pl.plan_name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Category</label>
                  <select className="form-select" value={modal.item_type} onChange={(e) => setModal({ ...modal, item_type: e.target.value })}>
                    {ITEM_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Item Code / Ref ID</label>
                  <input type="text" className="form-control" placeholder="e.g. VIS-OCT-01" value={modal.item_ref_id} onChange={(e) => setModal({ ...modal, item_ref_id: e.target.value })} />
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Item / Procedure Description *</label>
                <input type="text" className="form-control" placeholder="e.g. Visual Field Analysis (Humphrey)" value={modal.item_description} onChange={(e) => setModal({ ...modal, item_description: e.target.value })} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Payer Agreed Price (\u20a6) *</label>
                <input type="number" min={0} className="form-control" placeholder="e.g. 15000" value={modal.payer_price || ''} onChange={(e) => setModal({ ...modal, payer_price: parseFloat(e.target.value) || 0 })} />
              </div>
              <div style={{ display: 'flex', gap: '2rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={modal.covered} onChange={(e) => setModal({ ...modal, covered: e.target.checked })} />
                  <span>Covered by Payer</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={modal.requires_preauth} onChange={(e) => setModal({ ...modal, requires_preauth: e.target.checked })} />
                  <span>Requires Pre-Authorization</span>
                </label>
              </div>
            </div>
            <div className="ins-modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(EMPTY_MODAL)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save Tariff</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {importModal && (
        <div className="ins-modal-overlay">
          <div className="ins-modal" style={{ maxWidth: '780px', width: '95vw' }}>
            <div className="ins-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Upload size={20} />
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Bulk Tariff Import \u2014 HMO CSV Upload</h3>
              </div>
              <button className="btn btn-sm btn-link" onClick={closeImportModal}><X size={20} /></button>
            </div>

            <div className="ins-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Step 1 */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.9rem 1.1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '0.9rem' }}>Step 1 \u2014 Download the CSV template</strong>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#166534' }}>Open in Excel, fill tariff rows, then save as CSV before uploading.</p>
                  </div>
                  <button
                    className="btn btn-sm"
                    style={{ background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
                    onClick={() => api.insurance.downloadTariffTemplate().catch((e: any) => notify('error', e.message))}
                  >
                    <Download size={14} /> Download Template
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Step 2 \u2014 Select Payer *</label>
                  <select className="form-select" value={importPayerId} onChange={(e) => { setImportPayerId(e.target.value); setImportPlanId(''); }}>
                    <option value="">-- Choose HMO / Payer --</option>
                    {payers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Plan (Optional)</label>
                  <select className="form-select" value={importPlanId} onChange={(e) => setImportPlanId(e.target.value)} disabled={!importPayerId}>
                    <option value="">-- Apply to All Plans --</option>
                    {importAvailablePlans.map((pl) => <option key={pl.id} value={pl.id}>{pl.plan_name}</option>)}
                  </select>
                </div>
              </div>

              {/* Step 3 */}
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Step 3 \u2014 Upload CSV File</label>
                <div
                  style={{ border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileText size={28} style={{ color: '#94a3b8', marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Click to browse or drag a <strong>.csv</strong> file here</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>Columns: item_type, item_ref_id, item_description, payer_price_naira, covered, requires_preauth</p>
                  <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleFileChange} />
                </div>
              </div>

              {/* Warnings */}
              {importWarnings.length > 0 && (
                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <AlertTriangle size={16} color="#d97706" />
                    <strong style={{ fontSize: '0.85rem', color: '#92400e' }}>{importWarnings.length} warning(s) \u2014 valid rows will still be imported</strong>
                  </div>
                  {importWarnings.slice(0, 5).map((w, i) => <div key={i} style={{ fontSize: '0.8rem', color: '#78350f' }}>{w}</div>)}
                  {importWarnings.length > 5 && <div style={{ fontSize: '0.8rem', color: '#92400e', marginTop: '0.3rem' }}>\u2026and {importWarnings.length - 5} more</div>}
                </div>
              )}

              {/* Preview */}
              {importRows.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.9rem' }}>Preview \u2014 {importRows.length} row(s) parsed</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--leh-muted)' }}>Showing first 5 rows</span>
                  </div>
                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                    <table className="insurance-table" style={{ marginBottom: 0 }}>
                      <thead>
                        <tr>
                          <th>Type</th><th>Code</th><th>Description</th>
                          <th style={{ textAlign: 'right' }}>Price (\u20a6)</th>
                          <th style={{ textAlign: 'center' }}>Covered</th>
                          <th style={{ textAlign: 'center' }}>Pre-Auth</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 5).map((row, i) => (
                          <tr key={i}>
                            <td><span style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '2px 5px', borderRadius: '4px' }}>{(row.item_type || 'SERVICE').toUpperCase()}</span></td>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{row.item_ref_id || row.item_code || '\u2014'}</td>
                            <td>{row.item_description || row.description || '\u2014'}</td>
                            <td style={{ textAlign: 'right' }}>{parseFloat(row.payer_price_naira || row.price || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td style={{ textAlign: 'center' }}>{(row.covered === '0' || row.is_covered === '0') ? <XCircle size={14} color="#dc2626" /> : <CheckCircle size={14} color="#16a34a" />}</td>
                            <td style={{ textAlign: 'center' }}>{(row.requires_preauth === '1' || row.requires_authorization === '1') ? <CheckCircle size={14} color="#d97706" /> : <span style={{ color: 'var(--leh-muted)', fontSize: '0.8rem' }}>No</span>}</td>
                          </tr>
                        ))}
                        {importRows.length > 5 && (
                          <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--leh-muted)', fontSize: '0.82rem', padding: '0.5rem' }}>\u2026{importRows.length - 5} more rows not shown</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Streaming Progress Bar */}
              {importProgress && (
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.9rem 1.1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{importProgress.statusText}</span>
                    <span style={{ fontWeight: 700, color: 'var(--leh-forest)' }}>{importProgress.percent}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${importProgress.percent}%`,
                        height: '100%',
                        background: 'var(--leh-forest)',
                        transition: 'width 0.25s ease',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.5rem', fontSize: '0.82rem' }}>
                    <span style={{ color: '#15803d' }}>+ <strong>{importProgress.created}</strong> created</span>
                    <span style={{ color: '#1d4ed8' }}>~ <strong>{importProgress.updated}</strong> updated</span>
                    {importProgress.failed > 0 && <span style={{ color: '#dc2626' }}>! <strong>{importProgress.failed}</strong> failed</span>}
                  </div>
                </div>
              )}

              {/* Result */}
              {importResult && (
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '0.9rem 1.1rem' }}>
                  <strong style={{ color: '#15803d' }}>✓ Import Completed</strong>
                  <div style={{ marginTop: '0.4rem', fontSize: '0.88rem', display: 'flex', gap: '1.5rem' }}>
                    <span>Total: <strong>{importResult.total}</strong></span>
                    <span style={{ color: '#15803d' }}>Created: <strong>{importResult.created}</strong></span>
                    <span style={{ color: '#1d4ed8' }}>Updated: <strong>{importResult.updated}</strong></span>
                    {importResult.failed > 0 && <span style={{ color: '#dc2626' }}>Failed: <strong>{importResult.failed}</strong></span>}
                  </div>
                  {importResult.errors?.length > 0 && importResult.errors.map((e: string, i: number) => (
                    <div key={i} style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: '0.3rem' }}>{e}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="ins-modal-footer">
              {importing ? (
                <button className="btn btn-secondary" style={{ color: '#dc2626' }} onClick={handleAbortImport}>
                  Stop Import
                </button>
              ) : (
                <button className="btn btn-secondary" onClick={closeImportModal}>Close</button>
              )}
              <button
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--leh-forest)' }}
                disabled={!importPayerId || importRows.length === 0 || importing}
                onClick={handleRunImport}
              >
                {importing
                  ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Processing Chunk {importProgress?.currentChunk || 1}…</>
                  : <><Upload size={15} /> Run Import ({importRows.length} rows)</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
