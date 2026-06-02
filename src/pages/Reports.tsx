import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Users, Package, AlertCircle, Search, RefreshCcw, Printer, 
  Shield, PieChart, Activity, ChevronRight, Filter, Calendar, Download, Truck
} from 'lucide-react';
import { NairaIcon } from '../components/NairaIcon';
import { formatDateStandard } from '../utils/date';
import { api } from '../api';
import { useNotification } from '../context/NotificationContext';
import { LoadingSpinner } from '../components/LoadingSpinner';

type ReportTab = 
  | 'inventory' | 'sales' | 'profit_loss' | 'patients' 
  | 'procurement' | 'debtors' | 'expenses' | 'audit_log';

// ── SVG Donut Chart Component ──
interface DonutChartProps {
  title: string;
  data: { name: string; value: number }[];
  valueFormatter?: (v: number) => string;
}

const DonutChart: React.FC<DonutChartProps> = ({ title, data, valueFormatter = v => String(v) }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);
  
  const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];
  let accumulatedPercent = 0;
  
  return (
    <div style={{
      background: '#fff', borderRadius: '24px', padding: '24px',
      border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
      display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minWidth: '280px', maxWidth: '100%'
    }}>
      <h4 style={{ fontSize: '12px', fontWeight: '900', color: '#1e293b', letterSpacing: '0.05em', margin: 0, textTransform: 'uppercase' }}>{title}</h4>
      {total === 0 ? (
        <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '700' }}>
          NO DATA AVAILABLE
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '130px', height: '130px' }}>
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              {data.map((item, idx) => {
                const percent = (item.value / total) * 100;
                const circumference = 2 * Math.PI * 38;
                const strokeDashoffset = circumference * (1 - percent / 100);
                const rotation = (accumulatedPercent / 100) * 360;
                accumulatedPercent += percent;
                const color = colors[idx % colors.length];
                const isHovered = hoveredIdx === idx;
                
                return (
                  <circle
                    key={idx}
                    cx="50" cy="50" r="38"
                    fill="transparent" stroke={color}
                    strokeWidth={isHovered ? 11 : 7}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    transform={`rotate(${rotation} 50 50)`}
                    style={{
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'pointer',
                      opacity: hoveredIdx === null || isHovered ? 1 : 0.6
                    }}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                );
              })}
            </svg>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none'
            }}>
              <p style={{ margin: 0, fontSize: '9px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase' }}>
                {hoveredIdx !== null ? data[hoveredIdx].name : 'TOTAL'}
              </p>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '900', color: '#0f172a' }}>
                {valueFormatter(hoveredIdx !== null ? data[hoveredIdx].value : total)}
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '120px' }}>
            {data.slice(0, 5).map((item, idx) => {
              const color = colors[idx % colors.length];
              const pct = ((item.value / total) * 100).toFixed(1);
              return (
                <div 
                  key={idx} 
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                    fontSize: '10px', fontWeight: '800', padding: '3px 6px', borderRadius: '6px',
                    background: hoveredIdx === idx ? '#f8fafc' : 'transparent', transition: 'all 0.15s'
                  }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(item.name || '').toUpperCase()}</span>
                  </div>
                  <span style={{ color: '#0f172a', flexShrink: 0 }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ── SVG Bar Chart Component ──
interface BarChartProps {
  title: string;
  data: { label: string; value: number }[];
  valueFormatter?: (v: number) => string;
}

const BarChart: React.FC<BarChartProps> = ({ title, data, valueFormatter = v => String(v) }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxValue = useMemo(() => Math.max(...data.map(d => Math.abs(d.value)), 1), [data]);
  const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
  const baselineY = 70;

  return (
    <div style={{
      background: '#fff', borderRadius: '24px', padding: '24px',
      border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
      display: 'flex', flexDirection: 'column', gap: '16px', flex: 1.5, minWidth: '320px', maxWidth: '100%'
    }}>
      <h4 style={{ fontSize: '12px', fontWeight: '900', color: '#1e293b', letterSpacing: '0.05em', margin: 0, textTransform: 'uppercase' }}>{title}</h4>
      {data.length === 0 ? (
        <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '700' }}>
          NO DATA AVAILABLE
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%' }}>
          <svg viewBox="0 0 400 150" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
            <line x1="20" y1="15" x2="390" y2="15" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4" />
            <line x1="20" y1={baselineY} x2="390" y2={baselineY} stroke="#cbd5e1" strokeWidth="1.5" />
            <line x1="20" y1="125" x2="390" y2="125" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4" />
            
            {data.map((item, idx) => {
              const barWidth = Math.max(14, 250 / data.length);
              const xGap = (340 - barWidth * data.length) / Math.max(data.length - 1, 1);
              const x = 30 + idx * (barWidth + xGap);
              
              const isPositive = item.value >= 0;
              const ratio = Math.min(Math.abs(item.value) / maxValue, 1);
              const barHeight = ratio * 50;
              const y = isPositive ? baselineY - barHeight : baselineY;
              const color = colors[idx % colors.length];
              const isHovered = hoveredIdx === idx;
              
              return (
                <g key={idx}>
                  <rect
                    x={x - 4} y="10" width={barWidth + 8} height="120"
                    fill="transparent" style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                  <rect
                    x={x} y={y} width={barWidth} height={Math.max(barHeight, 2)}
                    rx="3" fill={color}
                    opacity={hoveredIdx === null || isHovered ? 1 : 0.6}
                    style={{ transition: 'all 0.2s', pointerEvents: 'none' }}
                  />
                  <text
                    x={x + barWidth / 2} y="142" textAnchor="middle"
                    fill="#94a3b8" fontSize="8px" fontWeight="800"
                    style={{ pointerEvents: 'none' }}
                  >
                    {(item.label || '').toUpperCase().substring(0, 10)}
                  </text>
                </g>
              );
            })}
          </svg>
          
          {hoveredIdx !== null && (
            <div style={{
              position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(15, 23, 42, 0.95)', color: '#fff', padding: '6px 10px',
              borderRadius: '6px', fontSize: '10px', fontWeight: '700', pointerEvents: 'none',
              boxShadow: '0 4px 6px rgba(0,0,0,0.15)', textAlign: 'center', zIndex: 10
            }}>
              <p style={{ margin: 0, textTransform: 'uppercase', fontSize: '8px', color: '#94a3b8' }}>{data[hoveredIdx].label}</p>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#38bdf8' }}>{valueFormatter(data[hoveredIdx].value)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── SVG Line Chart Component ──
interface LineChartProps {
  title: string;
  data: { label: string; value: number }[];
  valueFormatter?: (v: number) => string;
}

const LineChart: React.FC<LineChartProps> = ({ title, data, valueFormatter = v => String(v) }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxValue = useMemo(() => Math.max(...data.map(d => d.value), 1), [data]);
  
  const width = 400;
  const height = 150;
  const paddingX = 40;
  const paddingY = 25;
  
  const points = useMemo(() => {
    return data.map((d, i) => {
      const x = paddingX + (i / Math.max(data.length - 1, 1)) * (width - 2 * paddingX);
      const y = height - paddingY - (d.value / maxValue) * (height - 2 * paddingY);
      return { x, y };
    });
  }, [data, maxValue]);

  const linePath = useMemo(() => {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }, [points]);

  const fillPath = useMemo(() => {
    if (!points.length) return '';
    return `${linePath} L ${points[points.length - 1].x} ${height - paddingY + 5} L ${points[0].x} ${height - paddingY + 5} Z`;
  }, [points, linePath]);

  return (
    <div style={{
      background: '#fff', borderRadius: '24px', padding: '24px',
      border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
      display: 'flex', flexDirection: 'column', gap: '16px', flex: 1.5, minWidth: '320px', maxWidth: '100%'
    }}>
      <h4 style={{ fontSize: '12px', fontWeight: '900', color: '#1e293b', letterSpacing: '0.05em', margin: 0, textTransform: 'uppercase' }}>{title}</h4>
      {data.length === 0 ? (
        <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '700' }}>
          NO DATA AVAILABLE
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%' }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
            <defs>
              <linearGradient id="line-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#f8fafc" strokeWidth="1" />
            <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="#f1f5f9" strokeWidth="1" />
            <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#cbd5e1" strokeWidth="1.5" />
            
            {fillPath && <path d={fillPath} fill="url(#line-grad)" style={{ transition: 'all 0.3s' }} />}
            {linePath && <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.3s' }} />}
            
            {points.map((p, idx) => {
              const isHovered = hoveredIdx === idx;
              return (
                <g key={idx}>
                  <circle
                    cx={p.x} cy={p.y} r="12" fill="transparent" style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                  {isHovered && <circle cx={p.x} cy={p.y} r="7" fill="#2563eb" opacity="0.25" style={{ pointerEvents: 'none' }} />}
                  <circle
                    cx={p.x} cy={p.y} r={isHovered ? 4.5 : 3.5} fill="#fff" stroke="#2563eb"
                    strokeWidth={isHovered ? 3 : 2} style={{ transition: 'all 0.1s', pointerEvents: 'none' }}
                  />
                  {(idx === 0 || idx === points.length - 1 || (points.length > 5 && idx === Math.floor(points.length / 2))) && (
                    <text
                      x={p.x} y={height - 8} textAnchor="middle"
                      fill="#94a3b8" fontSize="8px" fontWeight="800"
                    >
                      {data[idx].label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          
          {hoveredIdx !== null && (
            <div style={{
              position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(15, 23, 42, 0.95)', color: '#fff', padding: '6px 10px',
              borderRadius: '6px', fontSize: '10px', fontWeight: '700', pointerEvents: 'none',
              boxShadow: '0 4px 6px rgba(0,0,0,0.15)', textAlign: 'center', zIndex: 10
            }}>
              <p style={{ margin: 0, textTransform: 'uppercase', fontSize: '8px', color: '#94a3b8' }}>{data[hoveredIdx].label}</p>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#38bdf8' }}>{valueFormatter(data[hoveredIdx].value)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const Reports: React.FC = () => {
  const navigate = useNavigate();
  const { notify } = useNotification();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ReportTab>((searchParams.get('tab') as ReportTab) || 'inventory');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlCategory, setSelectedPlCategory] = useState('ALL');

  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const tabs = [
    { id: 'inventory', label: 'Inventory', icon: Package, title: 'Inventory Analytics', subtitle: 'Global stock valuation & asset health' },
    { id: 'sales', label: 'Revenue Stream', icon: NairaIcon, title: 'Financial Intelligence', subtitle: 'Transaction logs & revenue performance' },
    { id: 'profit_loss', label: 'Profit & Loss', icon: PieChart, title: 'Profitability Intelligence', subtitle: 'Revenue, cost of sales & net income metrics' },
    { id: 'expenses', label: 'Expenses Log', icon: NairaIcon, title: 'Expenditure Accounts', subtitle: 'Operational disbursements & salary payouts' },
    { id: 'patients', label: 'Clinical Flow', icon: Users, title: 'Patient Dynamics', subtitle: 'Clinic throughput & admission metrics' },
    { id: 'procurement', label: 'Procurement', icon: Truck, title: 'Supply Logistics', subtitle: 'Stock acquisition & supplier accounts' },
    { id: 'debtors', label: 'Receivables', icon: AlertCircle, title: 'Outstanding Debt', subtitle: 'Awaiting settlements & aging analysis' },
    { id: 'audit_log', label: 'Security Log', icon: Shield, title: 'System Integrity', subtitle: 'Audit trail & access monitoring' },
  ];

  const fetchReportData = async () => {
    setLoading(true);
    try {
      let result: any = [];
      switch (activeTab) {
        case 'inventory': result = await api.getInventory(); break;
        case 'sales': result = await api.getSalesReport(dateRange.start, dateRange.end); break;
        case 'profit_loss': 
          const pl = await api.getProfitLoss(dateRange.start, dateRange.end);
          result = pl.details || [];
          break;
        case 'expenses': 
          result = await api.getExpensesReport(dateRange.start, dateRange.end); 
          break;
        case 'patients': result = await api.getPatientActivity(dateRange.start, dateRange.end); break;
        case 'procurement': result = await api.getProcurementReport(dateRange.start, dateRange.end); break;
        case 'debtors': result = await api.getDebtorsReport(); break;
        case 'audit_log': 
          const logs = await api.getAuditReport(dateRange.start, dateRange.end);
          result = Array.isArray(logs) ? logs : [];
          break;
      }
      setData(result || []);
    } catch (e) { notify('error', 'Telemetry Error: Report generation failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReportData(); }, [activeTab, dateRange]);

  useEffect(() => {
    setSelectedPlCategory('ALL');
    setSearchQuery('');
  }, [activeTab]);

  const profitCategories = useMemo(() => {
    if (activeTab !== 'profit_loss' || !data.length) return [];
    const cats = new Set<string>();
    data.forEach(row => {
      if (row.category) cats.add(row.category);
    });
    return Array.from(cats).sort();
  }, [data, activeTab]);

  const filteredData = useMemo(() => {
    let result = data;
    if (activeTab === 'profit_loss' && selectedPlCategory !== 'ALL') {
      result = result.filter(r => (r.category || '').toLowerCase() === selectedPlCategory.toLowerCase());
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
    }
    return result;
  }, [data, searchQuery, activeTab, selectedPlCategory]);

  const plMetrics = useMemo(() => {
    if (activeTab !== 'profit_loss') return null;
    const revenue = filteredData.reduce((sum, r) => sum + (r.revenue || 0), 0);
    const costOfSales = filteredData.reduce((sum, r) => sum + (r.cost || 0), 0);
    const overhead = costOfSales * 0.2;
    const net = revenue - costOfSales - overhead;
    return { revenue, costOfSales, overhead, net };
  }, [filteredData, activeTab]);

  const plChartData = useMemo(() => {
    if (activeTab !== 'profit_loss' || !data.length) return [];
    const groups: { [key: string]: { category: string; revenue: number; cost: number; profit: number } } = {};
    data.forEach(item => {
      const cat = item.category || 'General';
      if (!groups[cat]) {
        groups[cat] = { category: cat, revenue: 0, cost: 0, profit: 0 };
      }
      groups[cat].revenue += (item.revenue || 0);
      groups[cat].cost += (item.cost || 0);
      groups[cat].profit += (item.gross_profit || 0);
    });
    return Object.values(groups);
  }, [data, activeTab]);

  const salesTrendData = useMemo(() => {
    if (activeTab !== 'sales' || !data.length) return [];
    const groups: { [key: string]: number } = {};
    data.forEach(item => {
      if (!item.created_at) return;
      const dateStr = item.created_at.split('T')[0];
      groups[dateStr] = (groups[dateStr] || 0) + (item.total_amount || 0);
    });
    return Object.entries(groups)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data, activeTab]);

  const salesPaymentData = useMemo(() => {
    if (activeTab !== 'sales' || !data.length) return [];
    const groups: { [key: string]: number } = {};
    data.forEach(item => {
      const method = item.payment_method || 'Other';
      groups[method] = (groups[method] || 0) + (item.total_amount || 0);
    });
    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [data, activeTab]);

  const inventoryCategoryData = useMemo(() => {
    if (activeTab !== 'inventory' || !data.length) return [];
    const groups: { [key: string]: { name: string; value: number; volume: number } } = {};
    data.forEach(item => {
      const cat = item.category || 'General';
      if (!groups[cat]) {
        groups[cat] = { name: cat, value: 0, volume: 0 };
      }
      groups[cat].value += (item.stock || 0) * (item.cost_price || 0);
      groups[cat].volume += (item.stock || 0);
    });
    return Object.values(groups);
  }, [data, activeTab]);

  const expensesCategoryData = useMemo(() => {
    if (activeTab !== 'expenses' || !data.length) return [];
    const groups: { [key: string]: number } = {};
    data.forEach(item => {
      const cat = item.category || 'General';
      groups[cat] = (groups[cat] || 0) + (item.amount || 0);
    });
    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [data, activeTab]);

  const renderActiveTabCharts = () => {
    switch (activeTab) {
      case 'profit_loss': {
        const catProfitData = plChartData.map(c => ({
          label: c.category,
          value: c.profit
        }));
        const catContributionData = plChartData.map(c => ({
          name: c.category,
          value: Math.max(c.profit, 0)
        }));
        return (
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '24px', width: '100%', maxWidth: '100%' }} className="no-print">
            <BarChart 
              title="Net Profitability by Category" 
              data={catProfitData} 
              valueFormatter={v => `₦${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
            <DonutChart 
              title="Profit Contribution Share" 
              data={catContributionData} 
              valueFormatter={v => `₦${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            />
          </div>
        );
      }
      case 'sales': {
        const dailyData = salesTrendData.map(d => ({
          label: d.date,
          value: d.amount
        }));
        const paymentData = salesPaymentData.map(d => ({
          name: d.name,
          value: d.value
        }));
        return (
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '24px', width: '100%', maxWidth: '100%' }} className="no-print">
            <LineChart 
              title="Daily Revenue Trend" 
              data={dailyData} 
              valueFormatter={v => `₦${v.toLocaleString()}`}
            />
            <DonutChart 
              title="Revenue by Payment Channel" 
              data={paymentData} 
              valueFormatter={v => `₦${v.toLocaleString()}`}
            />
          </div>
        );
      }
      case 'inventory': {
        const topValued = [...data]
          .map(item => ({
            label: item.name,
            value: (item.stock || 0) * (item.cost_price || 0)
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);
        const valData = inventoryCategoryData.map(c => ({
          name: c.name,
          value: c.value
        }));
        return (
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '24px', width: '100%', maxWidth: '100%' }} className="no-print">
            <BarChart 
              title="Top 5 Products by Asset Value" 
              data={topValued} 
              valueFormatter={v => `₦${v.toLocaleString()}`}
            />
            <DonutChart 
              title="Valuation Share by Category" 
              data={valData} 
              valueFormatter={v => `₦${v.toLocaleString()}`}
            />
          </div>
        );
      }
      case 'expenses': {
        const expCatData = expensesCategoryData.map(e => ({
          label: e.name,
          value: e.value
        }));
        const dailyExpenses = (() => {
          const groups: { [key: string]: number } = {};
          data.forEach(item => {
            const dateStr = (item.date || '').split('T')[0];
            if (dateStr) groups[dateStr] = (groups[dateStr] || 0) + (item.amount || 0);
          });
          return Object.entries(groups)
            .map(([date, amount]) => ({ label: date, value: amount }))
            .sort((a, b) => a.label.localeCompare(b.label));
        })();
        return (
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '24px', width: '100%', maxWidth: '100%' }} className="no-print">
            <BarChart 
              title="Expenses by Category" 
              data={expCatData} 
              valueFormatter={v => `₦${v.toLocaleString()}`}
            />
            <LineChart 
              title="Daily Expense Outflow" 
              data={dailyExpenses} 
              valueFormatter={v => `₦${v.toLocaleString()}`}
            />
          </div>
        );
      }
      case 'patients': {
        const dailyVisits = (() => {
          const groups: { [key: string]: number } = {};
          data.forEach(item => {
            const dateStr = (item.admission_date || item.created_at || '').split('T')[0];
            if (dateStr) groups[dateStr] = (groups[dateStr] || 0) + 1;
          });
          return Object.entries(groups)
            .map(([date, count]) => ({ label: date, value: count }))
            .sort((a, b) => a.label.localeCompare(b.label));
        })();
        const patientStatusData = (() => {
          const groups: { [key: string]: number } = {};
          data.forEach(item => {
            const status = item.status || 'Active';
            groups[status] = (groups[status] || 0) + 1;
          });
          return Object.entries(groups).map(([name, value]) => ({ name, value }));
        })();
        return (
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '24px', width: '100%', maxWidth: '100%' }} className="no-print">
            <LineChart 
              title="Daily Patient Flow Volume" 
              data={dailyVisits} 
              valueFormatter={v => `${v} patients`}
            />
            <DonutChart 
              title="Active Admission Status Breakdown" 
              data={patientStatusData} 
              valueFormatter={v => `${v} cases`}
            />
          </div>
        );
      }
      default:
        return null;
    }
  };

  const activeTabData = tabs.find(t => t.id === activeTab);

  return (
    <div className="leh-page-container">
      {/* Page Header */}
      <header className="leh-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ 
            width: '56px', 
            height: '56px', 
            background: 'var(--leh-primary)', 
            borderRadius: '16px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 8px 16px -4px rgba(37, 99, 235, 0.3)'
          }}>
            <PieChart size={28} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 className="leh-page-title">{activeTabData?.title || 'System Analytics'}</h1>
            <p className="leh-page-subtitle">{activeTabData?.subtitle}</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            background: '#fff', 
            padding: '8px 16px', 
            borderRadius: '14px', 
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}>
            <Calendar size={14} style={{ color: 'var(--leh-primary)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="date" 
                className="leh-date-input" 
                style={{ height: '32px', width: '130px', border: 'none', background: 'transparent', padding: 0, fontWeight: '800', fontSize: '12px', color: '#1e293b' }} 
                value={dateRange.start} 
                onChange={e => setDateRange(p => ({...p, start: e.target.value}))} 
              />
              <span style={{ color: '#cbd5e1', fontWeight: '900' }}>—</span>
              <input 
                type="date" 
                className="leh-date-input" 
                style={{ height: '32px', width: '130px', border: 'none', background: 'transparent', padding: 0, fontWeight: '800', fontSize: '12px', color: '#1e293b' }} 
                value={dateRange.end} 
                onChange={e => setDateRange(p => ({...p, end: e.target.value}))} 
              />
            </div>
          </div>
          <button 
            className="leh-btn-secondary" 
            style={{ width: '44px', height: '44px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
            onClick={() => fetchReportData()}
          >
            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Analytics Stats Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {activeTab === 'profit_loss' ? (
          <>
            <div className="leh-stat-card">
              <p className="leh-label">GROSS REVENUE</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">₦{(plMetrics?.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                <span className="leh-status-dot" style={{ background: '#eff6ff', color: '#2563eb', fontWeight: '900' }}>INFLOW</span>
              </div>
            </div>
            <div className="leh-stat-card">
              <p className="leh-label">PROCUREMENT OUTFLOW</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">₦{(plMetrics?.costOfSales || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                <span className="leh-status-dot" style={{ background: '#fffbeb', color: '#b45309', fontWeight: '900' }}>OUTFLOW</span>
              </div>
            </div>
            <div className="leh-stat-card">
              <p className="leh-label">OVERHEAD EXPENSES (EST.)</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">₦{(plMetrics?.overhead || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                <span className="leh-status-dot" style={{ background: '#fef2f2', color: '#ef4444', fontWeight: '900' }}>OVERHEAD</span>
              </div>
            </div>
            <div className="leh-stat-card">
              <p className="leh-label">NET PROFITABILITY</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                {(() => {
                  const net = plMetrics?.net || 0;
                  return (
                    <>
                      <h3 className="leh-stat-value" style={{ color: net >= 0 ? '#10b981' : '#ef4444' }}>₦{net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                      <span className="leh-status-dot" style={{ background: net >= 0 ? '#ecfdf5' : '#fef2f2', color: net >= 0 ? '#10b981' : '#ef4444', fontWeight: '900' }}>
                        {net >= 0 ? 'SURPLUS' : 'DEFICIT'}
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>
          </>
        ) : activeTab === 'sales' ? (
          <>
            <div className="leh-stat-card">
              <p className="leh-label">TOTAL SALES RECEIPTS</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">{filteredData.length}</h3>
                <span className="leh-status-dot" style={{ background: '#eff6ff', color: '#2563eb', fontWeight: '900' }}>RECEIPTS</span>
              </div>
            </div>
            <div className="leh-stat-card">
              <p className="leh-label">GROSS SALES REVENUE</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">₦{filteredData.reduce((sum, r) => sum + (r.total_amount || 0), 0).toLocaleString()}</h3>
                <span className="leh-status-dot" style={{ background: '#ecfdf5', color: '#10b981', fontWeight: '900' }}>REVENUE</span>
              </div>
            </div>
            <div className="leh-stat-card">
              <p className="leh-label">TEMPORAL WINDOW</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">{Math.round((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000*60*60*24))} DAYS</h3>
                <span className="leh-status-dot" style={{ background: '#fffbeb', color: '#b45309', fontWeight: '900' }}>RANGE</span>
              </div>
            </div>
            <div className="leh-stat-card">
              <p className="leh-label">LAST TRANSACTION</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">{filteredData.length > 0 ? formatDateStandard(filteredData[0].created_at) : '—'}</h3>
                <span className="leh-status-dot" style={{ background: '#f5f3ff', color: '#7c3aed', fontWeight: '900' }}>LATEST</span>
              </div>
            </div>
          </>
        ) : activeTab === 'expenses' ? (
          <>
            <div className="leh-stat-card">
              <p className="leh-label">EXPENSE CLAIMS</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">{filteredData.length}</h3>
                <span className="leh-status-dot" style={{ background: '#fef2f2', color: '#ef4444', fontWeight: '900' }}>ENTRIES</span>
              </div>
            </div>
            <div className="leh-stat-card">
              <p className="leh-label">TOTAL DISBURSEMENTS</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">₦{filteredData.reduce((sum, r) => sum + (r.amount || 0), 0).toLocaleString()}</h3>
                <span className="leh-status-dot" style={{ background: '#fef2f2', color: '#ef4444', fontWeight: '900' }}>OUTFLOW</span>
              </div>
            </div>
            <div className="leh-stat-card">
              <p className="leh-label">TEMPORAL WINDOW</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">{Math.round((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000*60*60*24))} DAYS</h3>
                <span className="leh-status-dot" style={{ background: '#fffbeb', color: '#b45309', fontWeight: '900' }}>RANGE</span>
              </div>
            </div>
            <div className="leh-stat-card">
              <p className="leh-label">LAST EXPENSE</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">{filteredData.length > 0 ? formatDateStandard(filteredData[0].date) : '—'}</h3>
                <span className="leh-status-dot" style={{ background: '#f5f3ff', color: '#7c3aed', fontWeight: '900' }}>LATEST</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="leh-stat-card">
              <p className="leh-label">TELEMETRY VOLUME</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">{filteredData.length.toLocaleString()}</h3>
                <span className="leh-status-dot" style={{ background: '#eff6ff', color: '#2563eb', fontWeight: '900' }}>ENTRIES</span>
              </div>
            </div>
            <div className="leh-stat-card">
              <p className="leh-label">TEMPORAL WINDOW</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">{Math.round((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000*60*60*24))} DAYS</h3>
                <span className="leh-status-dot" style={{ background: '#fffbeb', color: '#b45309', fontWeight: '900' }}>RANGE</span>
              </div>
            </div>
            <div className="leh-stat-card">
              <p className="leh-label">SENSORY STATUS</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">OPERATIONAL</h3>
                <span className="leh-status-dot" style={{ background: '#ecfdf5', color: '#10b981', fontWeight: '900' }}>SYNCED</span>
              </div>
            </div>
            <div className="leh-stat-card">
              <p className="leh-label">LAST TELEMETRY</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</h3>
                <span className="leh-status-dot" style={{ background: '#f5f3ff', color: '#7c3aed', fontWeight: '900' }}>LIVE</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Navigation Matrix */}
        <aside className="lg:col-span-3">
          <div className="leh-table-card" style={{ position: 'sticky', top: '24px', padding: '16px' }}>
            <div style={{ padding: '0 8px 16px', borderBottom: '1px solid #f1f5f9', marginBottom: '12px' }}>
              <p className="leh-label" style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>INTELLIGENCE MODULES</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {tabs.map(tab => (
                <button 
                  key={tab.id}
                  className={`leh-tab ${activeTab === tab.id ? 'active' : ''}`}
                  style={{ 
                    width: '100%', 
                    justifyContent: 'space-between', 
                    padding: '14px 18px', 
                    borderRadius: '14px',
                    fontSize: '13px',
                    fontWeight: activeTab === tab.id ? '800' : '600',
                    border: 'none',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                  onClick={() => {
                    setActiveTab(tab.id as ReportTab);
                    navigate(`/reports?tab=${tab.id}`);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <tab.icon size={18} style={{ opacity: activeTab === tab.id ? 1 : 0.6 }} />
                    <span>{(tab.label || '').toUpperCase()}</span>
                  </div>
                  {activeTab === tab.id && <ChevronRight size={14} />}
                </button>
              ))}
            </div>
            
            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #f1f5f9' }}>
               <button 
                 className="leh-btn-primary" 
                 style={{ width: '100%', height: '52px', fontWeight: '900', fontSize: '12px' }} 
                 onClick={() => notify('info', 'Compiling encrypted report payload...')}
               >
                <Download size={18} style={{ marginRight: '10px' }} />
                GENERATE EXPORT
              </button>
            </div>
          </div>
        </aside>

        {/* Intelligence Content Area */}
        <main className="lg:col-span-9 flex flex-col gap-6">
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', width: '100%', maxWidth: '100%' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px', maxWidth: '100%' }}>
              <Search style={{ position: 'absolute', left: '16px', top: '14px', color: '#9ca3af' }} size={18} />
              <input 
                type="text" 
                placeholder="Query clinical intelligence data..." 
                className="leh-input"
                style={{ paddingLeft: '48px', height: '48px', fontSize: '14px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {activeTab === 'profit_loss' && (
              <select
                className="leh-input no-print"
                style={{ width: '200px', height: '48px', padding: '0 16px', fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', cursor: 'pointer', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}
                value={selectedPlCategory}
                onChange={(e) => setSelectedPlCategory(e.target.value)}
              >
                <option value="ALL">ALL CATEGORIES</option>
                {profitCategories.map(cat => (
                  <option key={cat} value={cat}>{(cat || '').toUpperCase()}</option>
                ))}
              </select>
            )}

            <button className="leh-btn-secondary" style={{ width: '48px', height: '48px', padding: 0 }}>
              <Filter size={18} /> 
            </button>
            <button 
              className="leh-btn-secondary" 
              style={{ height: '48px', padding: '0 24px', background: 'var(--leh-text-primary)', color: '#fff', border: 'none', fontWeight: '800', fontSize: '12px' }} 
              onClick={() => window.print()}
            >
              <Printer size={18} style={{ marginRight: '10px' }} />
              PRINT REPORT
            </button>
          </div>

          {renderActiveTabCharts()}

          <div className="leh-table-card">
            {loading ? (
              <div style={{ padding: '100px 0', textAlign: 'center' }}>
                <LoadingSpinner size="large" label="Synchronizing Clinical Telemetry..." />
              </div>
            ) : (
              <div className="leh-table-container">
                <table className="leh-table">
                  <thead>
                    <tr>
                      {activeTab === 'inventory' && (
                        <>
                          <th style={{ paddingLeft: '32px' }}>Product Specifications</th>
                          <th style={{ width: '160px' }}>Classification</th>
                          <th style={{ width: '120px', textAlign: 'center' }}>Volume</th>
                          <th style={{ width: '150px', textAlign: 'right' }}>Acquisition Cost</th>
                          <th style={{ paddingRight: '32px', textAlign: 'right', width: '180px' }}>Asset Valuation</th>
                        </>
                      )}
                      {activeTab === 'sales' && (
                        <>
                          <th style={{ paddingLeft: '32px' }}>Financial TX Hash</th>
                          <th>Counterparty</th>
                          <th style={{ width: '140px', textAlign: 'center' }}>Protocol</th>
                          <th style={{ width: '160px', textAlign: 'right' }}>Gross Revenue</th>
                          <th style={{ paddingRight: '32px', textAlign: 'right', width: '150px' }}>Temporal Stamp</th>
                        </>
                      )}
                      {activeTab === 'profit_loss' && (
                        <>
                          <th style={{ paddingLeft: '32px', width: '160px' }}>Transaction Date</th>
                          <th style={{ width: '160px' }}>Category</th>
                          <th>Description</th>
                          <th style={{ width: '150px', textAlign: 'right' }}>Revenue</th>
                          <th style={{ width: '150px', textAlign: 'right' }}>Cost of Sales</th>
                          <th style={{ paddingRight: '32px', textAlign: 'right', width: '150px' }}>Gross Profit</th>
                        </>
                      )}
                      {activeTab === 'expenses' && (
                        <>
                          <th style={{ paddingLeft: '32px', width: '160px' }}>Expense Date</th>
                          <th style={{ width: '160px' }}>Category</th>
                          <th>Description</th>
                          <th style={{ width: '160px' }}>Recorded By</th>
                          <th style={{ paddingRight: '32px', textAlign: 'right', width: '150px' }}>Amount</th>
                        </>
                      )}
                      {activeTab === 'audit_log' && (
                        <>
                          <th style={{ paddingLeft: '32px' }}>Operator Identity</th>
                          <th style={{ width: '200px' }}>Event Signature</th>
                          <th style={{ width: '180px' }}>Clinical Node</th>
                          <th style={{ paddingRight: '32px', textAlign: 'right', width: '160px' }}>Timeline</th>
                        </>
                      )}
                      {activeTab === 'patients' && (
                        <>
                          <th style={{ paddingLeft: '32px', width: '160px' }}>Encounter Date</th>
                          <th>Patient Name</th>
                          <th style={{ width: '150px' }}>File Number</th>
                          <th style={{ width: '200px' }}>Attending Clinician</th>
                          <th>Clinical Details</th>
                          <th style={{ paddingRight: '32px', textAlign: 'right', width: '155px' }}>Flow Status</th>
                        </>
                      )}
                      {activeTab === 'procurement' && (
                        <>
                          <th style={{ paddingLeft: '32px', width: '160px' }}>Acquisition Date</th>
                          <th style={{ width: '150px' }}>Invoice No</th>
                          <th>Supplier Partner</th>
                          <th>Item Description</th>
                          <th style={{ width: '100px', textAlign: 'center' }}>Qty</th>
                          <th style={{ width: '140px', textAlign: 'right' }}>Unit Cost</th>
                          <th style={{ width: '140px', textAlign: 'right' }}>Total Value</th>
                          <th style={{ paddingRight: '32px', textAlign: 'right', width: '155px' }}>Settlement</th>
                        </>
                      )}
                      {activeTab === 'debtors' && (
                        <>
                          <th style={{ paddingLeft: '32px', width: '160px' }}>Visit Date</th>
                          <th style={{ width: '150px' }}>File Number</th>
                          <th>Patient Identity</th>
                          <th style={{ width: '160px', textAlign: 'center' }}>Aging Days</th>
                          <th style={{ width: '140px', textAlign: 'right' }}>Total Billed</th>
                          <th style={{ width: '140px', textAlign: 'right' }}>Amount Paid</th>
                          <th style={{ paddingRight: '32px', textAlign: 'right', width: '155px' }}>Balance Due</th>
                        </>
                      )}
                      {!['inventory', 'sales', 'audit_log', 'profit_loss', 'expenses', 'patients', 'procurement', 'debtors'].includes(activeTab) && (
                        <>
                          <th style={{ paddingLeft: '32px' }}>Identity Hash</th>
                          <th>Event Description</th>
                          <th style={{ paddingRight: '32px', textAlign: 'right', width: '160px' }}>Node Status</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.slice(0, 50).map((row, i) => (
                      <tr key={i}>
                        {activeTab === 'inventory' && (
                          <>
                            <td style={{ paddingLeft: '32px' }}>
                               <p className="leh-table-bold" style={{ margin: 0 }}>{row.name}</p>
                               <p className="leh-label" style={{ fontSize: '9px', margin: 0 }}>SKU: #{String(row.id || '').slice(0,8).toUpperCase()}</p>
                            </td>
                            <td>
                              <span className="leh-status-dot" style={{ background: '#f1f5f9', color: '#475569', fontWeight: '800' }}>{(row.category || 'GENERAL').toUpperCase()}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                               <span className="leh-table-bold" style={{ fontSize: '15px' }}>{row.stock}</span>
                               <p className="leh-label" style={{ fontSize: '9px', margin: 0 }}>UNITS</p>
                            </td>
                            <td style={{ textAlign: 'right', color: '#64748b', fontWeight: '800', fontSize: '13px' }}>₦{(row.cost_price || 0).toLocaleString()}</td>
                            <td style={{ textAlign: 'right', paddingRight: '32px' }}>
                               <span className="leh-table-bold" style={{ fontSize: '16px', color: 'var(--leh-primary)' }}>₦{(row.stock * (row.cost_price || 0)).toLocaleString()}</span>
                            </td>
                          </>
                        )}
                        {activeTab === 'sales' && (
                          <>
                            <td style={{ paddingLeft: '32px' }}>
                               <span className="leh-table-bold" style={{ color: 'var(--leh-primary)', fontSize: '12px', fontFamily: 'monospace' }}>{row.receipt_no || String(row.id || '').toUpperCase()}</span>
                            </td>
                            <td>
                               <p className="leh-table-bold" style={{ margin: 0 }}>{row.patient_name || 'EXTERNAL WALK-IN'}</p>
                               <p className="leh-label" style={{ fontSize: '9px', margin: 0 }}>FILE: {row.file_number || 'N/A'}</p>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="leh-status-dot" style={{ background: '#ecfdf5', color: '#10b981', fontWeight: '900' }}>{(row.payment_method || 'N/A').toUpperCase()}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                               <span className="leh-table-bold" style={{ fontSize: '16px' }}>₦{(row.total_amount || 0).toLocaleString()}</span>
                            </td>
                             <td style={{ textAlign: 'right', paddingRight: '32px' }}>
                                <div className="leh-date-display" style={{ alignItems: 'flex-end' }}>
                                  <span className="leh-date-main">
                                    {formatDateStandard(row.created_at)}
                                  </span>
                                  <span className="leh-date-sub">
                                    {new Date(row.created_at).getFullYear()}
                                  </span>
                                </div>
                             </td>
                          </>
                        )}
                        {activeTab === 'profit_loss' && (
                          <>
                            <td style={{ paddingLeft: '32px' }}>
                              <div className="leh-date-display">
                                <span className="leh-date-main">
                                  {formatDateStandard(row.date)}
                                </span>
                                <span className="leh-date-sub">
                                  {new Date(row.date).getFullYear()}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span className="leh-status-dot" style={{ background: '#f1f5f9', color: '#475569', fontWeight: '800' }}>{(row.category || 'General').toUpperCase()}</span>
                            </td>
                            <td>
                              <span className="leh-table-bold">{row.description || 'N/A'}</span>
                            </td>
                            <td style={{ textAlign: 'right', color: '#10b981', fontWeight: '800' }}>
                              ₦{(row.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: '800' }}>
                              ₦{(row.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right', paddingRight: '32px' }}>
                              <span className="leh-table-bold" style={{ color: (row.gross_profit || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                                ₦{(row.gross_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </td>
                          </>
                        )}
                        {activeTab === 'expenses' && (
                          <>
                            <td style={{ paddingLeft: '32px' }}>
                              <div className="leh-date-display">
                                <span className="leh-date-main">
                                  {formatDateStandard(row.date)}
                                </span>
                                <span className="leh-date-sub">
                                  {new Date(row.date).getFullYear()}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span className="leh-status-dot" style={{ background: '#fef2f2', color: '#ef4444', fontWeight: '800' }}>{(row.category || 'General').toUpperCase()}</span>
                            </td>
                            <td>
                              <span className="leh-table-bold">{row.description || 'N/A'}</span>
                            </td>
                            <td>
                              <span className="leh-table-bold" style={{ fontSize: '13px' }}>{row.recorded_by || 'System'}</span>
                            </td>
                            <td style={{ textAlign: 'right', paddingRight: '32px' }}>
                              <span className="leh-table-bold" style={{ color: '#ef4444' }}>
                                ₦{(row.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </td>
                          </>
                        )}
                        {activeTab === 'audit_log' && (
                          <>
                            <td style={{ paddingLeft: '32px' }}>
                               <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{ width: '28px', height: '28px', background: 'var(--leh-primary-light)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--leh-primary)', fontWeight: '900', fontSize: '11px' }}>{row.user_name?.charAt(0) || 'U'}</div>
                                  <span className="leh-table-bold">{row.user_name}</span>
                                </div>
                            </td>
                            <td><span className="leh-label" style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>{row.action_type}</span></td>
                            <td>
                              <span className="leh-status-dot" style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', fontWeight: '800' }}>{row.module?.toUpperCase() || ''}</span>
                            </td>
                             <td style={{ textAlign: 'right', paddingRight: '32px' }}>
                                <div className="leh-date-display" style={{ alignItems: 'flex-end' }}>
                                  <span className="leh-date-main">
                                    {formatDateStandard(row.created_at)}
                                  </span>
                                  <span className="leh-date-sub">
                                    {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                             </td>
                          </>
                        )}
                        {activeTab === 'patients' && (
                          <>
                            <td style={{ paddingLeft: '32px' }}>
                              <div className="leh-date-display">
                                <span className="leh-date-main">{formatDateStandard(row.date)}</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span className="leh-table-bold">{row.patient_name}</span>
                                <span style={{ fontSize: '11px', color: 'var(--leh-text-muted)' }}>{row.phone || 'No phone'}</span>
                              </div>
                            </td>
                            <td>
                              <code style={{ fontSize: '12px', fontWeight: '800', color: 'var(--leh-text-dark)' }}>{row.file_no}</code>
                            </td>
                            <td className="leh-table-bold">{row.clinician || 'Triage Only'}</td>
                            <td>
                              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--leh-text-muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {row.diagnosis || 'General Checkup'}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', paddingRight: '32px' }}>
                              <span className={`leh-status-badge ${row.status === 'Discharged' ? 'green' : 'blue'}`}>
                                {row.status?.toUpperCase()}
                              </span>
                            </td>
                          </>
                        )}
                        {activeTab === 'procurement' && (
                          <>
                            <td style={{ paddingLeft: '32px' }}>
                              <div className="leh-date-display">
                                <span className="leh-date-main">{formatDateStandard(row.purchase_date)}</span>
                              </div>
                            </td>
                            <td>
                              <code style={{ fontSize: '12px', fontWeight: '800', color: 'var(--leh-text-dark)' }}>{row.invoice_number}</code>
                            </td>
                            <td className="leh-table-bold">{row.supplier_name}</td>
                            <td className="leh-table-bold" style={{ color: 'var(--leh-primary)' }}>{row.item_name}</td>
                            <td style={{ textAlign: 'center' }}>{row.quantity_received}</td>
                            <td style={{ textAlign: 'right' }}>₦{row.unit_cost?.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', fontWeight: '700' }}>₦{row.total_cost?.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', paddingRight: '32px' }}>
                              <span className={`leh-badge ${row.status === 'Paid' ? 'leh-badge-green' : row.status === 'Partial' ? 'leh-badge-amber' : 'leh-badge-red'}`}>
                                {row.status?.toUpperCase()}
                              </span>
                            </td>
                          </>
                        )}
                        {activeTab === 'debtors' && (
                          <>
                            <td style={{ paddingLeft: '32px' }}>
                              <div className="leh-date-display">
                                <span className="leh-date-main">{formatDateStandard(row.visit_date)}</span>
                              </div>
                            </td>
                            <td>
                              <code style={{ fontSize: '12px', fontWeight: '800', color: 'var(--leh-text-dark)' }}>{row.file_no}</code>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span className="leh-table-bold">{row.patient_name}</span>
                                <span style={{ fontSize: '11px', color: 'var(--leh-text-muted)' }}>{row.phone || 'No phone'}</span>
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`leh-status-badge ${row.days_outstanding > 30 ? 'red' : row.days_outstanding > 7 ? 'amber' : 'blue'}`}>
                                {row.days_outstanding} Days
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>₦{row.total_amount?.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', color: 'var(--leh-green)' }}>₦{row.amount_paid?.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', paddingRight: '32px', color: 'var(--leh-red)', fontWeight: '700' }}>
                              ₦{row.balance_due?.toLocaleString()}
                            </td>
                          </>
                        )}
                        {!['inventory', 'sales', 'audit_log', 'profit_loss', 'expenses', 'patients', 'procurement', 'debtors'].includes(activeTab) && (
                          <>
                            <td style={{ paddingLeft: '32px' }}>
                               <span className="leh-table-bold" style={{ color: 'var(--leh-primary)', fontSize: '12px', fontFamily: 'monospace' }}>#{row.id ? String(row.id).slice(0,10) : i+1}</span>
                            </td>
                            <td><span className="leh-table-bold">{row.name || row.description || 'Verified System Protocol'}</span></td>
                            <td style={{ textAlign: 'right', paddingRight: '32px' }}>
                               <span className="leh-status-dot" style={{ background: '#ecfdf5', color: '#10b981', fontWeight: '900' }}>{row.status?.toUpperCase() || 'SYNCHRONIZED'}</span>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {!loading && filteredData.length === 0 && (
              <div style={{ padding: '120px 0', textAlign: 'center', background: '#f8fafc' }}>
                 <Activity size={48} style={{ color: '#cbd5e1', marginBottom: '20px', opacity: 0.5 }} />
                 <p className="leh-label" style={{ fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: '11px' }}>No telemetry data captured for this period</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
