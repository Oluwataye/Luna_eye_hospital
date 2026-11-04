import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, Calendar, Download, RefreshCw, 
  FileText, Shield, PieChart, AlertTriangle, CreditCard
} from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../context/NotificationContext';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { InsuranceNavHeader } from './InsuranceNavHeader';
import './Insurance.css';

type ReportTab = 
  | 'register' 
  | 'ageing' 
  | 'rejections' 
  | 'reconciliation' 
  | 'authorizations' 
  | 'revenue_split' 
  | 'remittances';

export const InsuranceReports: React.FC = () => {
  const { notify } = useNotification();

  const [activeTab, setActiveTab] = useState<ReportTab>('register');
  const [data, setData] = useState<any[]>([]);
  const [payers, setPayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [payerFilter, setPayerFilter] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const payersRes = await api.insurance.getPayers(false);
      setPayers(payersRes || []);

      let endpoint = 'claims-register';
      if (activeTab === 'ageing') endpoint = 'ageing';
      if (activeTab === 'rejections') endpoint = 'rejections';
      if (activeTab === 'reconciliation') endpoint = 'payer-reconciliation';
      if (activeTab === 'authorizations') endpoint = 'authorizations';
      if (activeTab === 'revenue_split') endpoint = 'revenue-split';
      if (activeTab === 'remittances') endpoint = 'remittances';

      const res = await api.insurance.getReport(endpoint, {
        start_date: startDate,
        end_date: endDate,
        payer_id: payerFilter || undefined
      });
      setData(res || []);
    } catch (err: any) {
      notify('error', err.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [activeTab, startDate, endDate, payerFilter, notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatNaira = (kobo: number) => {
    const amount = (kobo || 0) / 100;
    return `₦${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const exportToCsv = () => {
    if (!data || data.length === 0) {
      notify('warning', 'No data available to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map((row) =>
        headers
          .map((h) => {
            const val = row[h];
            const str = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(',')
      )
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `insurance_${activeTab}_report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify('success', 'Report exported to CSV');
  };

  return (
    <div className="insurance-container">
      {/* Header */}
      <InsuranceNavHeader
        title="Insurance Analytics & Reports"
        subtitle="Financial audit, ageing analysis, HMO reconciliation, and revenue splits"
        actions={
          <>
            <button
              className="btn-leh-forest"
              onClick={exportToCsv}
            >
              <Download size={15} /> Export CSV
            </button>
            <button className="btn-leh-secondary" onClick={loadData}>
              <RefreshCw size={15} /> Refresh
            </button>
          </>
        }
      />

      {/* Tabs */}
      <div className="ins-tabs">
        <button
          className={`ins-tab-btn ${activeTab === 'register' ? 'active' : ''}`}
          onClick={() => setActiveTab('register')}
        >
          <FileText size={15} /> Claims Register
        </button>
        <button
          className={`ins-tab-btn ${activeTab === 'ageing' ? 'active' : ''}`}
          onClick={() => setActiveTab('ageing')}
        >
          <Calendar size={15} /> Ageing Buckets
        </button>
        <button
          className={`ins-tab-btn ${activeTab === 'reconciliation' ? 'active' : ''}`}
          onClick={() => setActiveTab('reconciliation')}
        >
          <Shield size={15} /> Payer Reconciliation
        </button>
        <button
          className={`ins-tab-btn ${activeTab === 'rejections' ? 'active' : ''}`}
          onClick={() => setActiveTab('rejections')}
        >
          <AlertTriangle size={15} /> Rejection Analysis
        </button>
        <button
          className={`ins-tab-btn ${activeTab === 'authorizations' ? 'active' : ''}`}
          onClick={() => setActiveTab('authorizations')}
        >
          <Shield size={15} /> Pre-Authorizations
        </button>
        <button
          className={`ins-tab-btn ${activeTab === 'revenue_split' ? 'active' : ''}`}
          onClick={() => setActiveTab('revenue_split')}
        >
          <PieChart size={15} /> Cash vs Insurance
        </button>
        <button
          className={`ins-tab-btn ${activeTab === 'remittances' ? 'active' : ''}`}
          onClick={() => setActiveTab('remittances')}
        >
          <CreditCard size={15} /> Remittance Log
        </button>
      </div>

      {/* Main Filter & Table Card */}
      <div className="insurance-card">
        {/* Filter bar */}
        <div className="insurance-filter-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--leh-ink)' }}>Period:</span>
            <input
              type="date"
              className="insurance-filter-date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span style={{ fontSize: '0.82rem', color: 'var(--leh-muted)' }}>to</span>
            <input
              type="date"
              className="insurance-filter-date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <select
            className="insurance-filter-select"
            style={{ minWidth: '200px' }}
            value={payerFilter}
            onChange={(e) => setPayerFilter(e.target.value)}
          >
            <option value="">All Payers</option>
            {payers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Content Views */}
        <div className="insurance-table-container">
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <LoadingSpinner />
            </div>
          ) : data.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--leh-muted)' }}>
              <BarChart3 size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>No records found for the selected period.</p>
            </div>
          ) : (
            <>
              {/* Claims Register */}
              {activeTab === 'register' && (
                <table className="insurance-table">
                  <thead>
                    <tr>
                      <th>Claim #</th>
                      <th>Patient</th>
                      <th>Payer</th>
                      <th>Service Date</th>
                      <th style={{ textAlign: 'right' }}>Billed</th>
                      <th style={{ textAlign: 'right' }}>Claimed</th>
                      <th style={{ textAlign: 'right' }}>Approved</th>
                      <th style={{ textAlign: 'right' }}>Paid</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{row.claim_number}</td>
                        <td>{row.patient_name || row.patient_id}</td>
                        <td>{row.payer_name}</td>
                        <td>{row.service_date}</td>
                        <td style={{ textAlign: 'right' }}>{formatNaira(row.total_billed)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatNaira(row.total_claimed)}</td>
                        <td style={{ textAlign: 'right', color: '#15803d' }}>{formatNaira(row.total_approved)}</td>
                        <td style={{ textAlign: 'right', color: '#0f766e' }}>{formatNaira(row.total_paid)}</td>
                        <td>
                          <span className={`ins-badge ins-badge--${row.status?.toLowerCase()}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Ageing Buckets */}
              {activeTab === 'ageing' && (
                <table className="insurance-table">
                  <thead>
                    <tr>
                      <th>Payer Name</th>
                      <th style={{ textAlign: 'right' }}>0 - 30 Days</th>
                      <th style={{ textAlign: 'right' }}>31 - 60 Days</th>
                      <th style={{ textAlign: 'right' }}>61 - 90 Days</th>
                      <th style={{ textAlign: 'right' }}>90+ Days (Overdue)</th>
                      <th style={{ textAlign: 'right' }}>Total Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, idx) => {
                      const totalOut = (row.days_0_30 || 0) + (row.days_31_60 || 0) + (row.days_61_90 || 0) + (row.days_90_plus || 0);
                      return (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{row.payer_name}</td>
                          <td style={{ textAlign: 'right' }}>{formatNaira(row.days_0_30)}</td>
                          <td style={{ textAlign: 'right', color: '#b45309' }}>{formatNaira(row.days_31_60)}</td>
                          <td style={{ textAlign: 'right', color: '#c2410c' }}>{formatNaira(row.days_61_90)}</td>
                          <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>{formatNaira(row.days_90_plus)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--leh-forest)' }}>
                            {formatNaira(totalOut)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Payer Reconciliation */}
              {activeTab === 'reconciliation' && (
                <table className="insurance-table">
                  <thead>
                    <tr>
                      <th>Payer Name</th>
                      <th style={{ textAlign: 'center' }}>Total Claims</th>
                      <th style={{ textAlign: 'right' }}>Total Claimed</th>
                      <th style={{ textAlign: 'right' }}>Total Approved</th>
                      <th style={{ textAlign: 'right' }}>Total Paid</th>
                      <th style={{ textAlign: 'right' }}>Written Off</th>
                      <th style={{ textAlign: 'right' }}>Net Balance Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, idx) => {
                      const balDue = (row.total_claimed || 0) - (row.total_paid || 0) - (row.total_written_off || 0);
                      return (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{row.payer_name}</td>
                          <td style={{ textAlign: 'center' }}>{row.claim_count}</td>
                          <td style={{ textAlign: 'right' }}>{formatNaira(row.total_claimed)}</td>
                          <td style={{ textAlign: 'right', color: '#15803d' }}>{formatNaira(row.total_approved)}</td>
                          <td style={{ textAlign: 'right', color: '#0f766e' }}>{formatNaira(row.total_paid)}</td>
                          <td style={{ textAlign: 'right', color: '#64748b' }}>{formatNaira(row.total_written_off)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: balDue > 0 ? '#b45309' : '#15803d' }}>
                            {formatNaira(balDue)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Rejection Analysis */}
              {activeTab === 'rejections' && (
                <table className="insurance-table">
                  <thead>
                    <tr>
                      <th>Rejection Code</th>
                      <th>Reason Description</th>
                      <th style={{ textAlign: 'center' }}>Rejected Claims Count</th>
                      <th style={{ textAlign: 'right' }}>Total Value Lost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700, color: '#dc2626' }}>{row.rejection_reason || 'UNSPECIFIED'}</td>
                        <td>{row.description || 'Payer rejected or queried'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.claim_count}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                          {formatNaira(row.total_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Pre-Authorizations Report */}
              {activeTab === 'authorizations' && (
                <table className="insurance-table">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Payer</th>
                      <th>Procedure</th>
                      <th>Status</th>
                      <th>Auth Code</th>
                      <th style={{ textAlign: 'right' }}>Requested</th>
                      <th style={{ textAlign: 'right' }}>Approved</th>
                      <th>Valid Until</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{row.patient_name || row.patient_id}</td>
                        <td>{row.payer_name}</td>
                        <td>{row.service_description}</td>
                        <td>
                          <span className={`ins-badge ins-badge--${row.status?.toLowerCase()}`}>
                            {row.status}
                          </span>
                        </td>
                        <td>{row.auth_code || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{formatNaira(row.requested_amount)}</td>
                        <td style={{ textAlign: 'right', color: '#15803d', fontWeight: 600 }}>
                          {formatNaira(row.approved_amount)}
                        </td>
                        <td>{row.valid_until || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Revenue Split */}
              {activeTab === 'revenue_split' && (
                <table className="insurance-table">
                  <thead>
                    <tr>
                      <th>Date / Period</th>
                      <th style={{ textAlign: 'right' }}>Cash Revenue</th>
                      <th style={{ textAlign: 'right' }}>Insurance Revenue</th>
                      <th style={{ textAlign: 'right' }}>Total Hospital Revenue</th>
                      <th style={{ textAlign: 'right' }}>Insurance Share %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, idx) => {
                      const totalRev = (row.cash_amount || 0) + (row.insurance_amount || 0);
                      const insPct = totalRev > 0 ? ((row.insurance_amount || 0) / totalRev) * 100 : 0;
                      return (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{row.period_date}</td>
                          <td style={{ textAlign: 'right', color: '#15803d' }}>
                            ₦{Number(row.cash_amount || 0).toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--leh-forest)', fontWeight: 600 }}>
                            ₦{Number(row.insurance_amount || 0).toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            ₦{totalRev.toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {insPct.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Remittance Log */}
              {activeTab === 'remittances' && (
                <table className="insurance-table">
                  <thead>
                    <tr>
                      <th>Ref Number</th>
                      <th>Payer Name</th>
                      <th>Payment Date</th>
                      <th>Method & Bank</th>
                      <th style={{ textAlign: 'right' }}>Amount Remitted</th>
                      <th style={{ textAlign: 'right' }}>Allocated</th>
                      <th style={{ textAlign: 'right' }}>Unallocated Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, color: 'var(--leh-forest)' }}>{row.payment_reference}</td>
                        <td>{row.payer_name}</td>
                        <td>{row.payment_date}</td>
                        <td>{row.payment_method} {row.bank_name ? `(${row.bank_name})` : ''}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatNaira(row.total_amount)}</td>
                        <td style={{ textAlign: 'right', color: '#15803d' }}>{formatNaira(row.allocated_amount)}</td>
                        <td style={{ textAlign: 'right', color: row.unallocated_amount > 0 ? '#b45309' : '#64748b' }}>
                          {formatNaira(row.unallocated_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
