import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Users, Package, AlertCircle, Search, RefreshCcw, Printer, 
  Shield, PieChart, Activity, Filter, Calendar, Download, Truck,
  Plus, Edit2, Trash2, X, Check, DollarSign, Archive, RotateCcw
} from 'lucide-react';
import { NairaIcon } from '../components/NairaIcon';
import { formatDateStandard } from '../utils/date';
import { api } from '../api';
import { useNotification } from '../context/NotificationContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { InnerNavTabs } from '../components/InnerNavTabs';

type ReportTab = 
  | 'inventory' | 'sales' | 'profit_loss' | 'patients' 
  | 'procurement' | 'debtors' | 'expenses' | 'audit_log' | 'discounts'
  | 'payroll' | 'tax';

// ── SVG Donut Chart Component ──
interface DonutChartProps {
  title: string;
  data: { name: string; value: number }[];
  valueFormatter?: (v: number) => string;
}

const DonutChart: React.FC<DonutChartProps> = ({ title, data, valueFormatter = v => String(v) }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);
  
  const colors = ['#2E5A26', '#B8963E', '#0D9488', '#D97706', '#7C3AED', '#0284C7', '#DC2626'];
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

// ── SVG Monthly P&L Trend Component ──
interface MonthlyPLTrendChartProps {
  title?: string;
  data: {
    period: string;
    revenue: number;
    cogs: number;
    overhead: number;
    salaries: number;
    procurement_cost: number;
    gross_profit: number;
    net_profit: number;
  }[];
}

const MonthlyPLTrendChart: React.FC<MonthlyPLTrendChartProps> = ({ title = "12-Month Performance Trend (Revenue vs Net Profit)", data }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxVal = useMemo(() => {
    if (!data.length) return 1;
    return Math.max(...data.map(d => Math.max(d.revenue || 0, Math.abs(d.net_profit || 0))), 1000);
  }, [data]);

  const width = 640;
  const height = 180;
  const paddingX = 40;
  const paddingBottom = 30;
  const paddingTop = 20;
  const chartH = height - paddingTop - paddingBottom;
  const baselineY = paddingTop + chartH * 0.7; // baseline allows for negative net profit

  return (
    <div style={{
      background: '#fff', borderRadius: '24px', padding: '24px',
      border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
      display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', marginBottom: '24px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <h4 style={{ fontSize: '12px', fontWeight: '900', color: '#1e293b', letterSpacing: '0.05em', margin: 0, textTransform: 'uppercase' }}>{title}</h4>
        <div style={{ display: 'flex', gap: '16px', fontSize: '11px', fontWeight: '800' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#2E5A26', display: 'inline-block' }}></span>
            <span style={{ color: '#64748b' }}>Revenue</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#10b981', display: 'inline-block' }}></span>
            <span style={{ color: '#64748b' }}>Net Profit (Surplus)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#ef4444', display: 'inline-block' }}></span>
            <span style={{ color: '#64748b' }}>Net Deficit</span>
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '700' }}>
          NO HISTORICAL TREND TELEMETRY AVAILABLE
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%' }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
            <line x1={paddingX} y1={paddingTop} x2={width - paddingX} y2={paddingTop} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4" />
            <line x1={paddingX} y1={baselineY} x2={width - paddingX} y2={baselineY} stroke="#cbd5e1" strokeWidth="1.5" />
            
            {data.map((item, idx) => {
              const step = (width - 2 * paddingX) / Math.max(data.length, 1);
              const groupX = paddingX + idx * step + step * 0.15;
              const barW = Math.max(8, step * 0.32);
              
              const revH = ((item.revenue || 0) / maxVal) * (baselineY - paddingTop);
              const revY = baselineY - revH;
              
              const isProfit = (item.net_profit || 0) >= 0;
              const netH = (Math.abs(item.net_profit || 0) / maxVal) * (baselineY - paddingTop);
              const netY = isProfit ? baselineY - netH : baselineY;
              const netColor = isProfit ? '#10b981' : '#ef4444';
              const isHovered = hoveredIdx === idx;

              return (
                <g key={idx}>
                  <rect
                    x={paddingX + idx * step} y="0" width={step} height={height}
                    fill="transparent" style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                  {isHovered && (
                    <rect
                      x={paddingX + idx * step + 2} y={paddingTop} width={step - 4} height={height - paddingTop - 12}
                      rx="4" fill="#f8fafc" opacity="0.8" style={{ pointerEvents: 'none' }}
                    />
                  )}
                  <rect
                    x={groupX} y={revY} width={barW} height={Math.max(revH, 2)}
                    rx="3" fill="#2E5A26" opacity={hoveredIdx === null || isHovered ? 0.95 : 0.4}
                    style={{ transition: 'all 0.2s', pointerEvents: 'none' }}
                  />
                  <rect
                    x={groupX + barW + 2} y={netY} width={barW} height={Math.max(netH, 2)}
                    rx="3" fill={netColor} opacity={hoveredIdx === null || isHovered ? 0.9 : 0.4}
                    style={{ transition: 'all 0.2s', pointerEvents: 'none' }}
                  />
                  <text
                    x={groupX + barW} y={height - 8} textAnchor="middle"
                    fill="#94a3b8" fontSize="8px" fontWeight="800"
                    style={{ pointerEvents: 'none' }}
                  >
                    {item.period ? item.period.slice(2) : ''}
                  </text>
                </g>
              );
            })}
          </svg>

          {hoveredIdx !== null && data[hoveredIdx] && (
            <div style={{
              position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(20, 33, 15, 0.96)', color: '#fff', padding: '10px 14px',
              borderRadius: '8px', fontSize: '11px', fontWeight: '700', pointerEvents: 'none',
              boxShadow: '0 8px 16px rgba(0,0,0,0.2)', textAlign: 'left', zIndex: 20, minWidth: '220px'
            }}>
              <p style={{ margin: '0 0 6px', textTransform: 'uppercase', fontSize: '9px', color: '#94a3b8', borderBottom: '1px solid #334155', paddingBottom: '4px' }}>
                Period: {data[hoveredIdx].period}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span style={{ color: '#C0FF72' }}>Revenue:</span>
                <span style={{ fontWeight: 800 }}>₦{(data[hoveredIdx].revenue || 0).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span style={{ color: '#cbd5e1' }}>COGS:</span>
                <span>₦{(data[hoveredIdx].cogs || 0).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span style={{ color: '#cbd5e1' }}>Overhead + Salaries:</span>
                <span>₦{((data[hoveredIdx].overhead || 0) + (data[hoveredIdx].salaries || 0)).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0 0', paddingTop: '4px', borderTop: '1px solid #334155', color: (data[hoveredIdx].net_profit || 0) >= 0 ? '#34d399' : '#f87171' }}>
                <span>Net Surplus/Deficit:</span>
                <span style={{ fontWeight: 900 }}>₦{(data[hoveredIdx].net_profit || 0).toLocaleString()}</span>
              </div>
            </div>
          )}
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
  const colors = ['var(--leh-forest)', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
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
                <stop offset="0%" stopColor="#2E5A26" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#2E5A26" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#f8fafc" strokeWidth="1" />
            <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="#f1f5f9" strokeWidth="1" />
            <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#cbd5e1" strokeWidth="1.5" />
            
            {fillPath && <path d={fillPath} fill="url(#line-grad)" style={{ transition: 'all 0.3s' }} />}
            {linePath && <path d={linePath} fill="none" stroke="#2E5A26" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.3s' }} />}
            
            {points.map((p, idx) => {
              const isHovered = hoveredIdx === idx;
              return (
                <g key={idx}>
                  <circle
                    cx={p.x} cy={p.y} r="12" fill="transparent" style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                  {isHovered && <circle cx={p.x} cy={p.y} r="7" fill="#2E5A26" opacity="0.25" style={{ pointerEvents: 'none' }} />}
                  <circle
                    cx={p.x} cy={p.y} r={isHovered ? 4.5 : 3.5} fill="#fff" stroke="#2E5A26"
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

export interface ReportsProps {
  initialTab?: ReportTab;
}

export const Reports: React.FC<ReportsProps> = ({ initialTab }) => {
  const navigate = useNavigate();
  const { notify } = useNotification();
  const [searchParams] = useSearchParams();
  const tabFromQuery = searchParams.get('tab') as ReportTab;
  const [activeTab, setActiveTab] = useState<ReportTab>(initialTab || tabFromQuery || 'profit_loss');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlCategory, setSelectedPlCategory] = useState('ALL');
  const [cashierFilter, setCashierFilter] = useState('');
  const [cashiersList, setCashiersList] = useState<any[]>([]);

  // P&L real summary and breakdowns from server
  const [plSummary, setPlSummary] = useState<any>(null);
  const [plExpensesBreakdown, setPlExpensesBreakdown] = useState<any[]>([]);
  const [plMonthlyTrend, setPlMonthlyTrend] = useState<any[]>([]);

  // Expenses CRUD modal state
  const [expenseModal, setExpenseModal] = useState<{ open: boolean; mode: 'add' | 'edit'; record: any | null }>({ open: false, mode: 'add', record: null });
  const [expenseForm, setExpenseForm] = useState({ date: '', category: 'Utility', expense_type: 'Overhead', description: '', amount: '', approved_by: '', payment_ref: '', notes: '' });
  const [expenseSaving, setExpenseSaving] = useState(false);

  // Payroll state
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [payrollSummary, setPayrollSummary] = useState<any>(null);
  const [staffSalaries, setStaffSalaries] = useState<any[]>([]);
  const [salaryFilter, setSalaryFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [salaryModal, setSalaryModal] = useState<{ open: boolean; mode: 'add' | 'edit'; record: any | null }>({ open: false, mode: 'add', record: null });
  const [salarySaving, setSalarySaving] = useState(false);
  const [salaryForm, setSalaryForm] = useState({ user_id: '', basic_salary: '', transport_allowance: '', housing_allowance: '', other_allowances: '', effective_from: new Date().toISOString().split('T')[0] });
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Tax state
  const [taxRecords, setTaxRecords] = useState<any[]>([]);
  const [taxSummary, setTaxSummary] = useState<any>(null);
  const [taxPeriod, setTaxPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [taxLoading, setTaxLoading] = useState(false);
  const [procurementWhtSummary, setProcurementWhtSummary] = useState<any>(null);

  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const tabs = [
    { id: 'inventory', label: 'Inventory', icon: Package, title: 'Inventory Analytics', subtitle: 'Global stock valuation & asset health' },
    { id: 'sales', label: 'Revenue Stream', icon: NairaIcon, title: 'Financial Intelligence', subtitle: 'Transaction logs & revenue performance' },
    { id: 'profit_loss', label: 'Profit & Loss', icon: PieChart, title: 'Profitability Intelligence', subtitle: 'Revenue, COGS, expenses & net income' },
    { id: 'expenses', label: 'Expenses Log', icon: NairaIcon, title: 'Expenditure Accounts', subtitle: 'Overhead disbursements & salary payouts' },
    { id: 'payroll', label: 'Payroll & Salaries', icon: DollarSign, title: 'Payroll Management', subtitle: 'Staff salary schedule, PAYE & Nigeria statutory deductions' },
    { id: 'tax', label: 'Tax & Statutory', icon: Shield, title: 'Tax & Statutory Obligations', subtitle: 'PAYE, WHT, NHF & Pension accruals — remittance tracking' },
    { id: 'patients', label: 'Clinical Flow', icon: Users, title: 'Patient Dynamics', subtitle: 'Clinic throughput & admission metrics' },
    { id: 'procurement', label: 'Procurement', icon: Truck, title: 'Supply Logistics', subtitle: 'Stock acquisition & supplier accounts' },
    { id: 'debtors', label: 'Receivables', icon: AlertCircle, title: 'Outstanding Debt', subtitle: 'Awaiting settlements & aging analysis' },
    { id: 'audit_log', label: 'Security Log', icon: Shield, title: 'System Integrity', subtitle: 'Audit trail & access monitoring' },
    { id: 'discounts', label: 'Discounts & Waivers', icon: PieChart, title: 'Discounts & Waivers Leakage', subtitle: 'Revenue concession audit & justification trail' },
  ];

  const fetchReportData = async () => {
    setLoading(true);
    try {
      let result: any = [];
      switch (activeTab) {
        case 'inventory': result = await api.getInventory(); break;
        case 'sales': result = await api.getSalesReport(dateRange.start, dateRange.end, cashierFilter); break;
        case 'profit_loss': {
          const [pl, trend] = await Promise.all([
            api.getProfitLoss(dateRange.start, dateRange.end),
            api.getProfitLossTrend(12).catch(() => [])
          ]);
          setPlSummary(pl?.summary || null);
          setPlExpensesBreakdown(pl?.expenses_breakdown || []);
          setPlMonthlyTrend(Array.isArray(trend) ? trend : []);
          result = pl?.details || [];
          break;
        }
        case 'expenses':
          result = await api.getExpenses({ start_date: dateRange.start, end_date: dateRange.end });
          break;
        case 'payroll':
          await loadPayrollData();
          result = [];
          break;
        case 'tax':
          await loadTaxData();
          result = [];
          break;
        case 'patients': result = await api.getPatientActivity(dateRange.start, dateRange.end); break;
        case 'procurement': result = await api.getProcurementReport(dateRange.start, dateRange.end); break;
        case 'debtors': result = await api.getDebtorsReport(); break;
        case 'audit_log': {
          const logs = await api.getAuditReport(dateRange.start, dateRange.end);
          result = Array.isArray(logs) ? logs : [];
          break;
        }
        case 'discounts':
          result = await api.getDiscountsReport(dateRange.start, dateRange.end);
          break;
      }
      setData(result || []);
    } catch (e) { notify('error', 'Telemetry Error: Report generation failed'); }
    finally { setLoading(false); }
  };

  const loadPayrollData = async () => {
    try {
      const [pr, ps, ss, users] = await Promise.all([
        api.getPayroll(payrollMonth),
        api.getPayrollSummary(payrollMonth),
        api.getStaffSalaries({ status: salaryFilter }),
        api.getUsers(),
      ]);
      setPayrollData(Array.isArray(pr) ? pr : []);
      setPayrollSummary(ps || null);
      setStaffSalaries(Array.isArray(ss) ? ss : []);
      setAllUsers(Array.isArray(users) ? users.filter((u: any) => u.status !== 'Inactive') : []);
    } catch (e) { notify('error', 'Failed to load payroll data'); }
  };

  const loadTaxData = async () => {
    try {
      const [tr, ts, wht] = await Promise.all([
        api.getTaxRecords({ period: taxPeriod }),
        api.getTaxSummary(taxPeriod),
        api.getProcurementWhtSummary({ start_date: `${taxPeriod}-01`, end_date: `${taxPeriod}-31` }).catch(() => null),
      ]);
      setTaxRecords(Array.isArray(tr) ? tr : []);
      setTaxSummary(ts || null);
      setProcurementWhtSummary(wht || null);
    } catch (e) { notify('error', 'Failed to load tax data'); }
  };

  const handleRunPayroll = async () => {
    if (!confirm(`Run payroll for ${payrollMonth}? This will compute PAYE, NHF and pension for all active staff.`)) return;
    setPayrollLoading(true);
    try {
      const res = await api.runPayroll(payrollMonth);
      notify('success', `Payroll processed for ${payrollMonth}: ${res.count} staff entries created`);
      await loadPayrollData();
    } catch (e: any) { notify('error', e.message || 'Failed to run payroll'); }
    finally { setPayrollLoading(false); }
  };

  const handlePostPayrollToExpenses = async () => {
    if (!confirm(`Post all payroll entries for ${payrollMonth} to Expenses? This will record net salaries as expense entries.`)) return;
    setPayrollLoading(true);
    try {
      const res = await api.postPayrollToExpenses(payrollMonth);
      notify('success', `${res.posted} salary entries posted to Expenses for ${payrollMonth}`);
      await loadPayrollData();
    } catch (e: any) { notify('error', e.message || 'Failed to post payroll to expenses'); }
    finally { setPayrollLoading(false); }
  };

  const handleDeletePayroll = async () => {
    if (!confirm(`Void and delete entire payroll for ${payrollMonth}? This cannot be undone.`)) return;
    setPayrollLoading(true);
    try {
      await api.deletePayroll(payrollMonth);
      notify('success', `Payroll for ${payrollMonth} voided successfully`);
      setPayrollData([]);
      setPayrollSummary(null);
    } catch (e: any) { notify('error', e.message || 'Failed to void payroll'); }
    finally { setPayrollLoading(false); }
  };

  const openExpenseModal = (mode: 'add' | 'edit', record?: any) => {
    if (mode === 'edit' && record) {
      setExpenseForm({
        date: record.date?.split('T')[0] || '',
        category: record.category || 'Utility',
        expense_type: record.expense_type || 'Overhead',
        description: record.description || '',
        amount: String(record.amount || ''),
        approved_by: record.approved_by || '',
        payment_ref: record.payment_ref || '',
        notes: record.notes || '',
      });
    } else {
      setExpenseForm({ date: new Date().toISOString().split('T')[0], category: 'Utility', expense_type: 'Overhead', description: '', amount: '', approved_by: '', payment_ref: '', notes: '' });
    }
    setExpenseModal({ open: true, mode, record: record || null });
  };

  const handleSaveExpense = async () => {
    if (!expenseForm.description || !expenseForm.amount || !expenseForm.category) {
      notify('error', 'Category, description and amount are required'); return;
    }
    setExpenseSaving(true);
    try {
      if (expenseModal.mode === 'add') {
        await api.createExpense(expenseForm);
        notify('success', 'Expense recorded successfully');
      } else {
        await api.updateExpense(expenseModal.record.id, expenseForm);
        notify('success', 'Expense updated successfully');
      }
      setExpenseModal({ open: false, mode: 'add', record: null });
      await fetchReportData();
    } catch (e: any) { notify('error', e.message || 'Failed to save expense'); }
    finally { setExpenseSaving(false); }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm('Delete this expense entry? This cannot be undone.')) return;
    try {
      await api.deleteExpense(id);
      notify('success', 'Expense deleted');
      await fetchReportData();
    } catch (e: any) { notify('error', e.message || 'Failed to delete expense'); }
  };

  const openSalaryModal = (mode: 'add' | 'edit', record?: any) => {
    if (mode === 'edit' && record) {
      setSalaryForm({
        user_id: String(record.user_id || ''),
        basic_salary: String(record.basic_salary || ''),
        transport_allowance: String(record.transport_allowance || ''),
        housing_allowance: String(record.housing_allowance || ''),
        other_allowances: String(record.other_allowances || ''),
        effective_from: record.effective_from || new Date().toISOString().split('T')[0]
      });
      setSalaryModal({ open: true, mode: 'edit', record });
    } else {
      setSalaryForm({
        user_id: '',
        basic_salary: '',
        transport_allowance: '',
        housing_allowance: '',
        other_allowances: '',
        effective_from: new Date().toISOString().split('T')[0]
      });
      setSalaryModal({ open: true, mode: 'add', record: null });
    }
  };

  const handleDeleteSalary = async (id: number, staffName: string) => {
    if (!confirm(`Archive salary schedule for ${staffName}? It will be deactivated from active payroll runs and preserved in historical records.`)) return;
    try {
      await api.deleteStaffSalary(id);
      notify('success', `Salary schedule for ${staffName} archived successfully`);
      await loadPayrollData();
    } catch (e: any) {
      notify('error', e.message || 'Failed to archive salary schedule');
    }
  };

  const handleRestoreSalary = async (id: number, staffName: string) => {
    if (!confirm(`Restore archived salary schedule for ${staffName}? This will reactivate it and supersede any conflicting active schedule.`)) return;
    try {
      await api.restoreStaffSalary(id);
      notify('success', `Salary schedule restored for ${staffName}`);
      await loadPayrollData();
    } catch (e: any) {
      notify('error', e.message || 'Failed to restore salary schedule');
    }
  };

  const handleRemitTax = async (id: number) => {
    const ref = prompt('Enter remittance reference number (e.g. bank receipt no.):');
    if (!ref) return;
    setTaxLoading(true);
    try {
      await api.remitTaxRecord(id, { remittance_date: new Date().toISOString().split('T')[0], remittance_ref: ref });
      notify('success', 'Tax marked as remitted');
      await loadTaxData();
    } catch (e: any) { notify('error', e.message || 'Failed to update tax record'); }
    finally { setTaxLoading(false); }
  };

  const fetchCashiers = async () => {
    try {
      const usersList = await api.getUsers();
      setCashiersList(usersList || []);
    } catch (e) {
      console.error('Failed to load cashiers list:', e);
    }
  };

  useEffect(() => {
    fetchCashiers();
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get('tab') as ReportTab;
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    } else if (initialTab && initialTab !== activeTab && !tabParam) {
      setActiveTab(initialTab);
    }
  }, [searchParams, initialTab]);

  useEffect(() => {
    if (activeTab === 'payroll') {
      loadPayrollData();
    }
  }, [salaryFilter]);

  useEffect(() => { fetchReportData(); }, [activeTab, dateRange, cashierFilter]);

  useEffect(() => {
    setSelectedPlCategory('ALL');
    setSearchQuery('');
    setCashierFilter('');
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
    // Use real server summary if available, otherwise fall back to row-level aggregation
    if (plSummary) return plSummary;
    const revenue = filteredData.reduce((sum, r) => sum + (r.revenue || 0), 0);
    const cogs = filteredData.reduce((sum, r) => sum + (r.cost || 0), 0);
    const gross_profit = revenue - cogs;
    return { revenue, cogs, gross_profit, total_overhead: 0, total_salaries: 0, total_expenses: 0, net_profit: gross_profit, gross_margin_pct: 0, net_margin_pct: 0, paye_accrued: 0 };
  }, [filteredData, activeTab, plSummary]);

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
          <div className="no-print" style={{ width: '100%', marginBottom: '24px' }}>
            <MonthlyPLTrendChart data={plMonthlyTrend} />
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', width: '100%', maxWidth: '100%' }}>
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
      case 'discounts': {
        const totalDiscountAmt = data.reduce((s, r) => s + (r.discount || 0), 0);
        const totalTransactions = data.length;
        const avgDiscountPct = totalTransactions > 0
          ? (data.reduce((s, r) => s + (r.discount_pct || 0), 0) / totalTransactions)
          : 0;
        const overrideCount = data.filter(r => r.requires_override).length;
        const reasonGroups: { [key: string]: number } = {};
        data.forEach(r => {
          const reason = r.discount_reason || 'Untagged';
          reasonGroups[reason] = (reasonGroups[reason] || 0) + (r.discount || 0);
        });
        const reasonChartData = Object.entries(reasonGroups).map(([name, value]) => ({ name, value }));
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px', width: '100%' }} className="no-print">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              {[
                { label: 'Total Discount Events', value: totalTransactions, color: 'var(--leh-forest)', fmt: (v: number) => String(v) },
                { label: 'Total Amount Waived', value: totalDiscountAmt, color: '#ef4444', fmt: (v: number) => `₦${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                { label: 'Avg Discount %', value: avgDiscountPct, color: '#f59e0b', fmt: (v: number) => `${v.toFixed(1)}%` },
                { label: 'Supervisor Overrides', value: overrideCount, color: '#8b5cf6', fmt: (v: number) => String(v) },
              ].map((kpi, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: '16px', padding: '20px', border: '1px solid #f1f5f9', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
                  <p style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</p>
                  <p style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: kpi.color }}>{kpi.fmt(kpi.value)}</p>
                </div>
              ))}
            </div>
            <DonutChart
              title="Discount Amount by Justification Reason"
              data={reasonChartData}
              valueFormatter={v => `₦${v.toLocaleString()}`}
            />
          </div>
        );
      }
      default:
        return null;
    }
  };

  const activeTabData = tabs.find(t => t.id === activeTab);

  // CSV export for discounts report
  const exportDiscountsCSV = () => {
    if (!data.length) return notify('warning', 'No data to export');
    const headers = ['Date', 'Receipt No', 'Patient', 'File No', 'Total (₦)', 'Discount (₦)', 'Discount %', 'Paid (₦)', 'Balance (₦)', 'Status', 'Payment Method', 'Cashier', 'Justification Reason', 'Note', 'Supervisor', 'Supervisor Role', 'Override Timestamp'];
    const rows = data.map(r => [
      (r.created_at || '').split('T')[0],
      r.receipt_no || '',
      r.patient_name || '',
      r.file_no || '',
      (r.total_amount || 0).toFixed(2),
      (r.discount || 0).toFixed(2),
      (r.discount_pct || 0).toFixed(1),
      (r.amount_paid || 0).toFixed(2),
      (r.balance || 0).toFixed(2),
      r.status || '',
      r.payment_method || '',
      r.cashier || '',
      r.discount_reason || 'Untagged',
      r.discount_note || '',
      r.supervisor_username || '',
      r.supervisor_role || '',
      r.override_timestamp ? (r.override_timestamp || '').split('T')[0] : ''
    ]);
    const csvContent = [headers, ...rows].map(row => row.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `discounts_waivers_${dateRange.start}_to_${dateRange.end}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify('success', 'Discounts & Waivers CSV exported successfully');
  };

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
            boxShadow: '0 8px 16px -4px rgba(46, 90, 38, 0.35)'
          }}>
            <PieChart size={28} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 className="leh-page-title">{activeTabData?.title || 'System Analytics'}</h1>
            <p className="leh-page-subtitle">{activeTabData?.subtitle}</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {activeTab === 'sales' && (
            <select
              className="leh-select no-print"
              style={{
                width: '180px',
                height: '50px',
                padding: '0 16px',
                fontSize: '12px',
                fontWeight: '800',
                textTransform: 'uppercase',
                cursor: 'pointer',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                color: '#1e293b'
              }}
              value={cashierFilter}
              onChange={e => setCashierFilter(e.target.value)}
            >
              <option value="">ALL CASHIERS</option>
              {cashiersList
                .filter(u => u.status?.toLowerCase() !== 'inactive')
                .map(u => (
                  <option key={u.id} value={u.full_name}>
                    {u.full_name.toUpperCase()}
                  </option>
                ))}
            </select>
          )}
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
      <div className={`grid grid-cols-1 ${activeTab === 'profit_loss' ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-6 mb-8`}>
        {activeTab === 'profit_loss' ? (
          <>
            <div className="leh-stat-card">
              <p className="leh-label">GROSS REVENUE (COLLECTED)</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">₦{(plMetrics?.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
                <span className="leh-status-dot" style={{ background: 'var(--leh-forest-tint)', color: 'var(--leh-forest)', fontWeight: '900' }}>INFLOW</span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#64748b', fontWeight: '700' }}>Billed: ₦{(plMetrics?.billed || 0).toLocaleString()}</p>
            </div>
            <div className="leh-stat-card">
              <p className="leh-label">COST OF GOODS SOLD</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">₦{(plMetrics?.cogs || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
                <span className="leh-status-dot" style={{ background: '#fffbeb', color: '#b45309', fontWeight: '900' }}>COGS</span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#64748b', fontWeight: '700' }}>Gross Margin: {(plMetrics?.gross_margin_pct || 0).toFixed(1)}%</p>
            </div>
            <div className="leh-stat-card">
              <p className="leh-label">PROCUREMENT OUTLAY</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">₦{((plMetrics?.procurement_cost ?? plMetrics?.procurement) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
                <span className="leh-status-dot" style={{ background: '#f5f3ff', color: '#7c3aed', fontWeight: '900' }}>SUPPLY</span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#64748b', fontWeight: '700' }}>Clinical Inventory Intake</p>
            </div>
            <div className="leh-stat-card">
              <p className="leh-label">TOTAL OPERATING EXPENSES</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">₦{(plMetrics?.total_expenses || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
                <span className="leh-status-dot" style={{ background: '#fef2f2', color: '#ef4444', fontWeight: '900' }}>OPEX</span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#64748b', fontWeight: '700' }}>Salaries: ₦{(plMetrics?.total_salaries || 0).toLocaleString()} | Overhead: ₦{(plMetrics?.total_overhead || 0).toLocaleString()}</p>
            </div>
            <div className="leh-stat-card">
              <p className="leh-label">NET PROFIT / (LOSS)</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                {(() => {
                  const net = plMetrics?.net_profit ?? plMetrics?.net ?? 0;
                  return (
                    <>
                      <h3 className="leh-stat-value" style={{ color: net >= 0 ? '#10b981' : '#ef4444' }}>₦{net.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
                      <span className="leh-status-dot" style={{ background: net >= 0 ? '#ecfdf5' : '#fef2f2', color: net >= 0 ? '#10b981' : '#ef4444', fontWeight: '900' }}>
                        {net >= 0 ? 'SURPLUS' : 'DEFICIT'}
                      </span>
                    </>
                  );
                })()}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#64748b', fontWeight: '700' }}>Net Margin: {(plMetrics?.net_margin_pct || 0).toFixed(1)}% | PAYE Accrued: ₦{(plMetrics?.paye_accrued || 0).toLocaleString()}</p>
            </div>
          </>
        ) : activeTab === 'sales' ? (
          <>
            <div className="leh-stat-card">
              <p className="leh-label">TOTAL SALES RECEIPTS</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">{filteredData.length}</h3>
                <span className="leh-status-dot" style={{ background: 'var(--leh-forest-tint)', color: 'var(--leh-forest)', fontWeight: '900' }}>RECEIPTS</span>
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
              <p className="leh-label">EXPENSE ENTRIES</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">{filteredData.length}</h3>
                <span className="leh-status-dot" style={{ background: '#fef2f2', color: '#ef4444', fontWeight: '900' }}>ENTRIES</span>
              </div>
            </div>
            <div className="leh-stat-card">
              <p className="leh-label">TOTAL OVERHEAD EXPENSES</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">₦{filteredData.filter(r => r.category !== 'Salary').reduce((sum, r) => sum + (r.amount || 0), 0).toLocaleString()}</h3>
                <span className="leh-status-dot" style={{ background: '#fef2f2', color: '#ef4444', fontWeight: '900' }}>OVERHEAD</span>
              </div>
            </div>
            <div className="leh-stat-card">
              <p className="leh-label">TOTAL SALARY PAYOUTS</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">₦{filteredData.filter(r => r.category === 'Salary').reduce((sum, r) => sum + (r.amount || 0), 0).toLocaleString()}</h3>
                <span className="leh-status-dot" style={{ background: '#f0fdf4', color: '#16a34a', fontWeight: '900' }}>SALARIES</span>
              </div>
            </div>
            <div className="leh-stat-card">
              <p className="leh-label">TOTAL DISBURSEMENTS</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">₦{filteredData.reduce((sum, r) => sum + (r.amount || 0), 0).toLocaleString()}</h3>
                <span className="leh-status-dot" style={{ background: '#fffbeb', color: '#b45309', fontWeight: '900' }}>TOTAL</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="leh-stat-card">
              <p className="leh-label">TELEMETRY VOLUME</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 className="leh-stat-value">{filteredData.length.toLocaleString()}</h3>
                <span className="leh-status-dot" style={{ background: 'var(--leh-forest-tint)', color: 'var(--leh-forest)', fontWeight: '900' }}>ENTRIES</span>
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
            <InnerNavTabs<ReportTab>
              orientation="vertical"
              tabs={tabs.map(tab => ({
                id: tab.id as ReportTab,
                label: (tab.label || '').toUpperCase(),
                icon: tab.icon
              }))}
              activeTab={activeTab}
              onChange={(newTab) => {
                setActiveTab(newTab);
                navigate(`/reports?tab=${newTab}`);
              }}
              showChevronOnActive
            />
            
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
            {activeTab === 'discounts' && (
              <button
                className="leh-btn-secondary"
                style={{ height: '48px', padding: '0 20px', background: '#10b981', color: '#fff', border: 'none', fontWeight: '800', fontSize: '12px' }}
                onClick={exportDiscountsCSV}
              >
                <Download size={16} style={{ marginRight: '8px' }} />
                EXPORT CSV
              </button>
            )}
            {activeTab === 'expenses' && (
              <button
                className="leh-btn-primary"
                style={{ height: '48px', padding: '0 20px', fontWeight: '800', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={() => openExpenseModal('add')}
              >
                <Plus size={16} />
                ADD EXPENSE
              </button>
            )}
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

          {/* Profit & Loss Executive Waterfall & Expense Breakdown */}
          {activeTab === 'profit_loss' && (
            <>
              {/* Income Statement Waterfall Synthesis */}
              <div style={{
                background: '#fff', borderRadius: '24px', padding: '24px 32px',
                border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
                marginBottom: '24px'
              }} className="no-print">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: '900', color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Income Statement Waterfall (Operating Performance)
                    </h4>
                    <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                      Period: {dateRange.start} to {dateRange.end} · Financial Flow Synthesis
                    </p>
                  </div>
                  <span style={{
                    padding: '4px 12px', borderRadius: '16px', fontSize: '11px', fontWeight: '900',
                    background: (plMetrics?.net_profit || 0) >= 0 ? '#ecfdf5' : '#fef2f2',
                    color: (plMetrics?.net_profit || 0) >= 0 ? '#10b981' : '#ef4444'
                  }}>
                    {(plMetrics?.net_profit || 0) >= 0 ? 'NET SURPLUS' : 'NET DEFICIT'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'center' }}>
                  <div style={{ padding: '16px', borderRadius: '16px', background: '#f8fafc', borderLeft: '4px solid var(--leh-forest)' }}>
                    <p style={{ margin: 0, fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Gross Revenue (Inflow)</p>
                    <p style={{ margin: '6px 0 0', fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>₦{(plMetrics?.revenue || 0).toLocaleString()}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8' }}>Billed: ₦{(plMetrics?.billed || 0).toLocaleString()}</p>
                  </div>

                  <div style={{ padding: '16px', borderRadius: '16px', background: '#f8fafc', borderLeft: '4px solid #f59e0b' }}>
                    <p style={{ margin: 0, fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Cost of Sales (COGS)</p>
                    <p style={{ margin: '6px 0 0', fontSize: '18px', fontWeight: '900', color: '#b45309' }}>-₦{(plMetrics?.cogs || 0).toLocaleString()}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8' }}>Margin: {(plMetrics?.gross_margin_pct || 0).toFixed(1)}%</p>
                  </div>

                  <div style={{ padding: '16px', borderRadius: '16px', background: 'var(--leh-forest-tint)', borderLeft: '4px solid var(--leh-forest)' }}>
                    <p style={{ margin: 0, fontSize: '10px', color: 'var(--leh-forest)', fontWeight: '800', textTransform: 'uppercase' }}>Gross Operating Margin</p>
                    <p style={{ margin: '6px 0 0', fontSize: '18px', fontWeight: '900', color: 'var(--leh-forest)' }}>₦{(plMetrics?.gross_profit || 0).toLocaleString()}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'var(--leh-muted)' }}>Gross contribution</p>
                  </div>

                  <div style={{ padding: '16px', borderRadius: '16px', background: '#f8fafc', borderLeft: '4px solid #ef4444' }}>
                    <p style={{ margin: 0, fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Operating Expenses</p>
                    <p style={{ margin: '6px 0 0', fontSize: '18px', fontWeight: '900', color: '#ef4444' }}>-₦{(plMetrics?.total_expenses || 0).toLocaleString()}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8' }}>Salaries + Overheads</p>
                  </div>

                  <div style={{ padding: '16px', borderRadius: '16px', background: (plMetrics?.net_profit || 0) >= 0 ? '#ecfdf5' : '#fef2f2', borderLeft: `4px solid ${(plMetrics?.net_profit || 0) >= 0 ? '#10b981' : '#ef4444'}` }}>
                    <p style={{ margin: 0, fontSize: '10px', color: (plMetrics?.net_profit || 0) >= 0 ? '#065f46' : '#991b1b', fontWeight: '800', textTransform: 'uppercase' }}>Net Operating Income</p>
                    <p style={{ margin: '6px 0 0', fontSize: '18px', fontWeight: '900', color: (plMetrics?.net_profit || 0) >= 0 ? '#047857' : '#b91c1c' }}>₦{(plMetrics?.net_profit || 0).toLocaleString()}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: (plMetrics?.net_profit || 0) >= 0 ? '#059669' : '#dc2626' }}>Net: {(plMetrics?.net_margin_pct || 0).toFixed(1)}%</p>
                  </div>
                </div>

                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b', flexWrap: 'wrap', gap: '8px' }}>
                  <span><strong>Procurement Capital Stock:</strong> ₦{((plMetrics?.procurement_cost ?? plMetrics?.procurement) || 0).toLocaleString()} (Acquisitions directly capitalized to Inventory)</span>
                  <span><strong>PAYE Accrued:</strong> ₦{(plMetrics?.paye_accrued || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Operating Expenses Breakdown by Category Table */}
              {plExpensesBreakdown.length > 0 && (
                <div style={{
                  background: '#fff', borderRadius: '24px', padding: '24px 32px',
                  border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
                  marginBottom: '24px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h4 style={{ fontSize: '13px', fontWeight: '900', color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Operating Expenditure Breakdown by Category
                      </h4>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                        Granular view of hospital operational overhead and staff compensation
                      </p>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b' }}>
                      {plExpensesBreakdown.length} Categories Active
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="leh-table">
                      <thead>
                        <tr>
                          <th style={{ paddingLeft: '20px' }}>Category</th>
                          <th>Classification</th>
                          <th style={{ textAlign: 'right' }}>Total Disbursed</th>
                          <th style={{ textAlign: 'right', paddingRight: '20px' }}>Share of Total OPEX</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plExpensesBreakdown.map((eb: any, i: number) => {
                          const expTotal = plMetrics?.total_expenses || 1;
                          const share = Math.round(((eb.total || 0) / expTotal) * 1000) / 10;
                          return (
                            <tr key={i}>
                              <td style={{ paddingLeft: '20px', fontWeight: '800', color: '#0f172a' }}>{eb.category}</td>
                              <td>
                                <span className={`leh-badge ${eb.expense_type === 'Salary' ? 'leh-badge-blue' : 'leh-badge-amber'}`}>
                                  {eb.expense_type || 'Overhead'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: '800', color: '#ef4444' }}>₦{(eb.total || 0).toLocaleString()}</td>
                              <td style={{ textAlign: 'right', paddingRight: '20px', fontWeight: '700', color: '#64748b' }}>{share}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab !== 'payroll' && activeTab !== 'tax' && (
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
                          <th style={{ paddingLeft: '32px', width: '130px' }}>Expense Date</th>
                          <th style={{ width: '130px' }}>Category</th>
                          <th style={{ width: '120px' }}>Type</th>
                          <th>Description</th>
                          <th style={{ width: '130px' }}>Approved By</th>
                          <th style={{ textAlign: 'right', width: '150px' }}>Amount</th>
                          <th style={{ textAlign: 'center', paddingRight: '16px', width: '100px' }}>Actions</th>
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
                      {activeTab === 'discounts' && (
                        <>
                          <th style={{ paddingLeft: '32px', width: '140px' }}>Date</th>
                          <th style={{ width: '140px' }}>Receipt No</th>
                          <th>Patient</th>
                          <th style={{ width: '120px', textAlign: 'right' }}>Total (₦)</th>
                          <th style={{ width: '120px', textAlign: 'right' }}>Waived (₦)</th>
                          <th style={{ width: '80px', textAlign: 'center' }}>%</th>
                          <th style={{ width: '220px' }}>Justification Reason</th>
                          <th style={{ width: '160px' }}>Authorized By</th>
                          <th style={{ paddingRight: '32px', width: '120px', textAlign: 'center' }}>Override</th>
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
                      {!['inventory', 'sales', 'audit_log', 'profit_loss', 'expenses', 'patients', 'procurement', 'debtors', 'payroll', 'tax'].includes(activeTab) && (
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
                                <span className="leh-date-main">{formatDateStandard(row.date)}</span>
                              </div>
                            </td>
                            <td>
                              <span className="leh-status-dot" style={{
                                background: row.category === 'Salary' ? '#f0fdf4' : '#fef2f2',
                                color: row.category === 'Salary' ? '#16a34a' : '#ef4444', fontWeight: '800'
                              }}>{(row.category || 'General').toUpperCase()}</span>
                            </td>
                            <td>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', background: '#f8fafc', padding: '2px 6px', borderRadius: '4px' }}>{row.expense_type || 'Overhead'}</span>
                            </td>
                            <td>
                              <div>
                                <span className="leh-table-bold">{row.description || 'N/A'}</span>
                                {row.payment_ref && <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8', fontWeight: '700' }}>Ref: {row.payment_ref}</p>}
                              </div>
                            </td>
                            <td>
                              <span className="leh-table-bold" style={{ fontSize: '13px' }}>{row.approved_by || row.recorded_by || '—'}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span className="leh-table-bold" style={{ color: '#ef4444', fontSize: '15px' }}>
                                ₦{(row.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', paddingRight: '16px' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => openExpenseModal('edit', row)}
                                  style={{ border: 'none', background: 'var(--leh-forest-tint)', color: 'var(--leh-forest)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}
                                  title="Edit expense"
                                ><Edit2 size={12} /></button>
                                <button
                                  onClick={() => handleDeleteExpense(row.id)}
                                  style={{ border: 'none', background: '#fef2f2', color: '#ef4444', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}
                                  title="Delete expense"
                                ><Trash2 size={12} /></button>
                              </div>
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
                        {!['inventory', 'sales', 'audit_log', 'profit_loss', 'expenses', 'patients', 'procurement', 'debtors', 'discounts', 'payroll', 'tax'].includes(activeTab) && (
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
                        {activeTab === 'discounts' && (
                          <>
                            <td style={{ paddingLeft: '32px' }}>
                              <div className="leh-date-display">
                                <span className="leh-date-main">{(row.created_at || '').split('T')[0]}</span>
                              </div>
                            </td>
                            <td>
                              <code style={{ fontSize: '12px', fontWeight: '800', color: 'var(--leh-text-dark)' }}>{row.receipt_no}</code>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span className="leh-table-bold">{row.patient_name}</span>
                                <span style={{ fontSize: '11px', color: 'var(--leh-text-muted)' }}>{row.cashier}</span>
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>₦{(row.total_amount || 0).toLocaleString()}</td>
                            <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: '800' }}>₦{(row.discount || 0).toLocaleString()}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`leh-status-badge ${(row.discount_pct || 0) >= 25 ? 'red' : (row.discount_pct || 0) >= 10 ? 'amber' : 'blue'}`}>
                                {(row.discount_pct || 0).toFixed(1)}%
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>{row.discount_reason || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Untagged</span>}</span>
                                {row.discount_note && <span style={{ fontSize: '11px', color: '#64748b' }}>{row.discount_note}</span>}
                              </div>
                            </td>
                            <td>
                              {row.supervisor_username ? (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '12px', fontWeight: '700' }}>{row.supervisor_username}</span>
                                  <span style={{ fontSize: '11px', color: '#64748b' }}>{row.supervisor_role}</span>
                                </div>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center', paddingRight: '32px' }}>
                              {row.requires_override ? (
                                <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '10px', fontWeight: '900', padding: '3px 8px', borderRadius: '6px' }}>OVERRIDE</span>
                              ) : (
                                <span style={{ background: '#f0fdf4', color: '#166534', fontSize: '10px', fontWeight: '900', padding: '3px 8px', borderRadius: '6px' }}>STANDARD</span>
                              )}
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
          )}

          {/* ─── PAYROLL TAB ─────────────────────────────────────── */}
          {activeTab === 'payroll' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Payroll Controls */}
              <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', border: '1px solid #f1f5f9', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PAYROLL PERIOD</p>
                  <input type="month" className="leh-input" style={{ height: '40px', marginTop: '6px', fontWeight: '800' }} value={payrollMonth} onChange={e => { setPayrollMonth(e.target.value); }} />
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button className="leh-btn-primary" style={{ height: '40px', padding: '0 20px', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={handleRunPayroll} disabled={payrollLoading}>
                    {payrollLoading ? <RefreshCcw size={14} className="animate-spin" /> : <Plus size={14} />} RUN PAYROLL
                  </button>
                  {payrollData.length > 0 && (
                    <button className="leh-btn-secondary" style={{ height: '40px', padding: '0 20px', fontSize: '12px', fontWeight: '800', background: '#10b981', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={handlePostPayrollToExpenses} disabled={payrollLoading}>
                      <Check size={14} /> POST TO EXPENSES
                    </button>
                  )}
                  {payrollData.length > 0 && (
                    <button className="leh-btn-secondary" style={{ height: '40px', padding: '0 20px', fontSize: '12px', fontWeight: '800', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={handleDeletePayroll} disabled={payrollLoading}>
                      <Trash2 size={14} /> VOID PAYROLL
                    </button>
                  )}
                </div>
              </div>

              {/* Payroll Summary Cards */}
              {payrollSummary && payrollSummary.staff_count > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                  {[
                    { label: 'Staff Count', value: payrollSummary.staff_count, fmt: (v: number) => String(v), color: '#2E5A26', bg: '#EAF2E7' },
                    { label: 'Gross Payroll', value: payrollSummary.total_gross || 0, fmt: (v: number) => `₦${v.toLocaleString()}`, color: '#0f172a', bg: '#f8fafc' },
                    { label: 'PAYE (Income Tax)', value: payrollSummary.total_paye || 0, fmt: (v: number) => `₦${v.toLocaleString()}`, color: '#b45309', bg: '#fffbeb' },
                    { label: 'NHF', value: payrollSummary.total_nhf || 0, fmt: (v: number) => `₦${v.toLocaleString()}`, color: '#7c3aed', bg: '#f5f3ff' },
                    { label: 'Pension (Employee)', value: payrollSummary.total_pension_ee || 0, fmt: (v: number) => `₦${v.toLocaleString()}`, color: '#0891b2', bg: '#ecfeff' },
                    { label: 'Pension (Employer)', value: payrollSummary.total_pension_er || 0, fmt: (v: number) => `₦${v.toLocaleString()}`, color: '#0891b2', bg: '#ecfeff' },
                    { label: 'Net Payroll', value: payrollSummary.total_net || 0, fmt: (v: number) => `₦${v.toLocaleString()}`, color: '#10b981', bg: '#f0fdf4' },
                  ].map((kpi, i) => (
                    <div key={i} style={{ background: kpi.bg, borderRadius: '12px', padding: '16px 20px', border: `1px solid ${kpi.color}20` }}>
                      <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase' }}>{kpi.label}</p>
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: kpi.color }}>{kpi.fmt(kpi.value)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Payroll Register Table */}
              {payrollData.length > 0 ? (
                <div className="leh-table-card">
                  <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                    <p style={{ margin: 0, fontWeight: '900', fontSize: '12px', color: '#1e293b', textTransform: 'uppercase' }}>PAYROLL REGISTER — {payrollMonth}</p>
                  </div>
                  <div className="leh-table-container">
                    <table className="leh-table">
                      <thead><tr>
                        <th style={{ paddingLeft: '24px' }}>Staff Name</th>
                        <th style={{ textAlign: 'right' }}>Gross (₦)</th>
                        <th style={{ textAlign: 'right' }}>PAYE (₦)</th>
                        <th style={{ textAlign: 'right' }}>NHF (₦)</th>
                        <th style={{ textAlign: 'right' }}>Pension Ee (₦)</th>
                        <th style={{ textAlign: 'right' }}>Pension Er (₦)</th>
                        <th style={{ textAlign: 'right' }}>Net Salary (₦)</th>
                        <th style={{ textAlign: 'center', paddingRight: '16px' }}>Status</th>
                      </tr></thead>
                      <tbody>
                        {payrollData.map((pr, i) => (
                          <tr key={i}>
                            <td style={{ paddingLeft: '24px' }}>
                              <p className="leh-table-bold" style={{ margin: 0 }}>{pr.full_name}</p>
                              <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8', fontWeight: '700' }}>{pr.role} · {pr.department}</p>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '800' }}>{(pr.gross_salary || 0).toLocaleString()}</td>
                            <td style={{ textAlign: 'right', color: '#b45309', fontWeight: '700' }}>{(pr.paye_monthly || 0).toLocaleString()}</td>
                            <td style={{ textAlign: 'right', color: '#7c3aed', fontWeight: '700' }}>{(pr.nhf || 0).toLocaleString()}</td>
                            <td style={{ textAlign: 'right', color: '#0891b2', fontWeight: '700' }}>{(pr.pension_employee || 0).toLocaleString()}</td>
                            <td style={{ textAlign: 'right', color: '#0891b2', fontWeight: '700' }}>{(pr.pension_employer || 0).toLocaleString()}</td>
                            <td style={{ textAlign: 'right', color: '#10b981', fontWeight: '900', fontSize: '15px' }}>{(pr.net_salary || 0).toLocaleString()}</td>
                            <td style={{ textAlign: 'center', paddingRight: '16px' }}>
                              <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '900', background: pr.payment_status === 'Paid' ? '#f0fdf4' : '#fffbeb', color: pr.payment_status === 'Paid' ? '#16a34a' : '#b45309' }}>
                                {pr.payment_status?.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ background: '#fff', borderRadius: '16px', padding: '60px', textAlign: 'center', border: '1px solid #f1f5f9' }}>
                  <DollarSign size={40} style={{ color: '#cbd5e1', marginBottom: '16px' }} />
                  <p style={{ fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', fontSize: '12px' }}>No payroll processed for {payrollMonth}</p>
                  <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Set up staff salary schedules and click "Run Payroll" to generate.</p>
                </div>
              )}

              {/* Staff Salary Schedule */}
              <div className="leh-table-card">
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <p style={{ margin: 0, fontWeight: '900', fontSize: '12px', color: '#1e293b', textTransform: 'uppercase' }}>SALARY SCHEDULES</p>
                    <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '2px', gap: '2px' }}>
                      {(['active', 'archived', 'all'] as const).map(tabKey => (
                        <button
                          key={tabKey}
                          style={{
                            border: 'none',
                            background: salaryFilter === tabKey ? '#fff' : 'transparent',
                            color: salaryFilter === tabKey ? '#0f172a' : '#64748b',
                            fontWeight: '800',
                            fontSize: '11px',
                            padding: '4px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            boxShadow: salaryFilter === tabKey ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                          }}
                          onClick={() => setSalaryFilter(tabKey)}
                        >
                          {tabKey === 'active' ? 'Active Schedules' : tabKey === 'archived' ? 'Archived History' : 'All'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button className="leh-btn-primary" style={{ height: '34px', padding: '0 16px', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => openSalaryModal('add')}>
                    <Plus size={12} /> SET SALARY
                  </button>
                </div>
                {staffSalaries.length > 0 ? (
                  <div className="leh-table-container">
                    <table className="leh-table">
                      <thead><tr>
                        <th style={{ paddingLeft: '24px' }}>Staff Member</th>
                        <th style={{ textAlign: 'right' }}>Basic (₦)</th>
                        <th style={{ textAlign: 'right' }}>Transport (₦)</th>
                        <th style={{ textAlign: 'right' }}>Housing (₦)</th>
                        <th style={{ textAlign: 'right' }}>Gross (₦)</th>
                        <th style={{ textAlign: 'right' }}>PAYE/Mo (₦)</th>
                        <th style={{ textAlign: 'right' }}>Net Est. (₦)</th>
                        <th style={{ textAlign: 'center', width: '150px' }}>Status / Period</th>
                        <th style={{ textAlign: 'center', paddingRight: '20px', width: '160px' }}>Actions</th>
                      </tr></thead>
                      <tbody>
                        {staffSalaries.map((ss, i) => (
                          <tr key={i} style={{ opacity: ss.is_active ? 1 : 0.75, background: ss.is_active ? 'transparent' : '#fafafa' }}>
                            <td style={{ paddingLeft: '24px' }}>
                              <p className="leh-table-bold" style={{ margin: 0 }}>{ss.full_name}</p>
                              <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8', fontWeight: '700' }}>{ss.role} · {ss.department}</p>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '700' }}>{(ss.basic_salary || 0).toLocaleString()}</td>
                            <td style={{ textAlign: 'right', color: '#64748b', fontWeight: '600' }}>{(ss.transport_allowance || 0).toLocaleString()}</td>
                            <td style={{ textAlign: 'right', color: '#64748b', fontWeight: '600' }}>{(ss.housing_allowance || 0).toLocaleString()}</td>
                            <td style={{ textAlign: 'right', fontWeight: '800' }}>{(ss.gross_salary || 0).toLocaleString()}</td>
                            <td style={{ textAlign: 'right', color: '#b45309', fontWeight: '700' }}>{(ss.paye_monthly || 0).toLocaleString()}</td>
                            <td style={{ textAlign: 'right', color: '#10b981', fontWeight: '900' }}>
                              {((ss.gross_salary || 0) - (ss.paye_monthly || 0) - (ss.nhf || 0) - (ss.pensionEmployee || 0)).toLocaleString()}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '10px',
                                fontWeight: '900',
                                background: ss.is_active ? '#f0fdf4' : '#f1f5f9',
                                color: ss.is_active ? '#16a34a' : '#64748b'
                              }}>
                                {ss.is_active ? 'ACTIVE' : 'ARCHIVED'}
                              </span>
                              <p style={{ margin: '3px 0 0', fontSize: '9px', color: '#94a3b8', fontWeight: '700' }}>
                                {ss.effective_from}{ss.effective_to ? ` → ${ss.effective_to}` : ' (Current)'}
                              </p>
                            </td>
                            <td style={{ textAlign: 'center', paddingRight: '20px' }}>
                              <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                <button
                                  style={{ border: 'none', background: 'var(--leh-forest-tint)', color: 'var(--leh-forest)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '800' }}
                                  onClick={() => openSalaryModal('edit', ss)}
                                  title="Modify salary schedule"
                                >
                                  <Edit2 size={12} /> EDIT
                                </button>
                                {ss.is_active ? (
                                  <button
                                    style={{ border: 'none', background: '#fff1f2', color: '#e11d48', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '800' }}
                                    onClick={() => handleDeleteSalary(ss.id, ss.full_name)}
                                    title="Archive salary schedule (soft-delete)"
                                  >
                                    <Archive size={12} /> ARCHIVE
                                  </button>
                                ) : (
                                  <button
                                    style={{ border: 'none', background: '#f0fdf4', color: '#16a34a', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '800' }}
                                    onClick={() => handleRestoreSalary(ss.id, ss.full_name)}
                                    title="Restore this archived salary schedule"
                                  >
                                    <RotateCcw size={12} /> RESTORE
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center' }}>
                    <p style={{ color: '#94a3b8', fontWeight: '700', fontSize: '12px' }}>
                      {salaryFilter === 'archived' ? 'No archived salary schedules found.' : 'No active salary schedules found. Click "Set Salary" to assign salaries to staff members.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── TAX TAB ─────────────────────────────────────────── */}
          {activeTab === 'tax' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', border: '1px solid #f1f5f9', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase' }}>TAX PERIOD</p>
                  <input type="month" className="leh-input" style={{ height: '40px', marginTop: '6px', fontWeight: '800' }} value={taxPeriod}
                    onChange={e => { setTaxPeriod(e.target.value); }} />
                </div>
                <button className="leh-btn-secondary" style={{ height: '40px', padding: '0 20px', fontWeight: '800', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={loadTaxData} disabled={taxLoading}>
                  <RefreshCcw size={14} className={taxLoading ? 'animate-spin' : ''} /> REFRESH
                </button>
              </div>

              {/* Tax Summary Cards */}
              {taxSummary?.breakdown?.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                  {(taxSummary.breakdown as any[]).map((t: any, i: number) => (
                    <div key={i} style={{ background: '#fff', borderRadius: '12px', padding: '16px 20px', border: '1px solid #f1f5f9' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase' }}>{t.tax_type}</p>
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#0f172a' }}>₦{(t.total || 0).toLocaleString()}</p>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '12px', background: '#f0fdf4', color: '#16a34a' }}>₦{(t.remitted || 0).toLocaleString()} REMITTED</span>
                        <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '12px', background: '#fef3c7', color: '#b45309' }}>₦{(t.accrued || 0).toLocaleString()} PENDING</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Procurement & Vendor Supplies WHT Section */}
              <div style={{ background: '#fff', borderRadius: '16px', padding: '20px 24px', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: '#1e293b', textTransform: 'uppercase' }}>
                      Vendor Procurement & WHT Obligations (5% on Supplies)
                    </span>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                      Standard 5% Withholding Tax applies to supply of medicines, frames & equipment. Medical consultations are VAT-exempt.
                    </p>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: '900', padding: '4px 10px', borderRadius: '12px', background: 'var(--leh-forest-tint)', color: 'var(--leh-forest)' }}>
                    NIGERIAN TAX POLICY COMPLIANT
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '4px' }}>
                  <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '12px', borderLeft: '4px solid var(--leh-forest)' }}>
                    <p style={{ margin: 0, fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Total Procurement Volume</p>
                    <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>
                      ₦{(procurementWhtSummary?.total_procurement || 0).toLocaleString()}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8' }}>
                      {procurementWhtSummary?.transaction_count || 0} acquisition orders
                    </p>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '12px', borderLeft: '4px solid #10b981' }}>
                    <p style={{ margin: 0, fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Supplier Disbursements Paid</p>
                    <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: '900', color: '#10b981' }}>
                      ₦{(procurementWhtSummary?.total_paid || 0).toLocaleString()}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8' }}>Settled supply liabilities</p>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '12px', borderLeft: '4px solid #f59e0b' }}>
                    <p style={{ margin: 0, fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>5% WHT Provision (Accrued)</p>
                    <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: '900', color: '#b45309' }}>
                      ₦{(procurementWhtSummary?.total_wht_accrued || Math.round((procurementWhtSummary?.total_procurement || 0) * 0.05)).toLocaleString()}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8' }}>Deductible at settlement</p>
                  </div>
                </div>
              </div>

              {/* Tax Records Table */}
              <div className="leh-table-card">
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                  <p style={{ margin: 0, fontWeight: '900', fontSize: '12px', color: '#1e293b', textTransform: 'uppercase' }}>TAX OBLIGATIONS — {taxPeriod}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Tax on services is NOT tracked (exempted per business policy)</p>
                </div>
                {taxRecords.length > 0 ? (
                  <div className="leh-table-container">
                    <table className="leh-table">
                      <thead><tr>
                        <th style={{ paddingLeft: '24px' }}>Tax Type</th>
                        <th>Reference</th>
                        <th style={{ textAlign: 'right' }}>Gross (₦)</th>
                        <th style={{ textAlign: 'right' }}>Rate</th>
                        <th style={{ textAlign: 'right' }}>Tax Amount (₦)</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                        <th style={{ textAlign: 'center', paddingRight: '16px' }}>Action</th>
                      </tr></thead>
                      <tbody>
                        {taxRecords.map((tr: any, i: number) => (
                          <tr key={i}>
                            <td style={{ paddingLeft: '24px' }}>
                              <span style={{ fontWeight: '900', fontSize: '12px', color: '#0f172a' }}>{tr.tax_type}</span>
                              <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8', fontWeight: '600' }}>{tr.reference_type}</p>
                            </td>
                            <td><span className="leh-table-bold" style={{ fontSize: '13px' }}>{tr.vendor_name || '—'}</span></td>
                            <td style={{ textAlign: 'right', fontWeight: '700' }}>{(tr.gross_amount || 0).toLocaleString()}</td>
                            <td style={{ textAlign: 'right', color: '#64748b', fontWeight: '700' }}>{tr.tax_rate > 0 ? `${tr.tax_rate}%` : 'graduated'}</td>
                            <td style={{ textAlign: 'right', fontWeight: '900', color: '#b45309', fontSize: '14px' }}>{(tr.tax_amount || 0).toLocaleString()}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '900', background: tr.status === 'Remitted' ? '#f0fdf4' : '#fef3c7', color: tr.status === 'Remitted' ? '#16a34a' : '#b45309' }}>
                                {tr.status?.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', paddingRight: '16px' }}>
                              {tr.status === 'Accrued' ? (
                                <button style={{ border: 'none', background: '#ecfdf5', color: '#16a34a', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: '800' }}
                                  onClick={() => handleRemitTax(tr.id)}>REMIT</button>
                              ) : (
                                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700' }}>{tr.remittance_date || '—'}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '60px', textAlign: 'center' }}>
                    <Shield size={40} style={{ color: '#cbd5e1', marginBottom: '16px' }} />
                    <p style={{ fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', fontSize: '12px' }}>No tax records for {taxPeriod}</p>
                    <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Run payroll to auto-generate PAYE, NHF and Pension records.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ─── EXPENSE ADD/EDIT MODAL ─────────────────────────────── */}
      {expenseModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '520px', boxShadow: '0 24px 48px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#0f172a' }}>
                {expenseModal.mode === 'add' ? '+ NEW EXPENSE ENTRY' : 'EDIT EXPENSE'}
              </h3>
              <button onClick={() => setExpenseModal({ open: false, mode: 'add', record: null })} style={{ border: 'none', background: '#f8fafc', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Date *</label>
                  <input type="date" className="leh-input" style={{ height: '42px', marginTop: '4px', width: '100%' }} value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Category *</label>
                  <select className="leh-select" style={{ height: '42px', marginTop: '4px', width: '100%' }} value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))}>
                    {['Salary','Utility','Rent','Equipment','Medical Supplies','Admin','Maintenance','Other'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Expense Type</label>
                <select className="leh-select" style={{ height: '42px', marginTop: '4px', width: '100%' }} value={expenseForm.expense_type} onChange={e => setExpenseForm(p => ({ ...p, expense_type: e.target.value }))}>
                  <option value="Overhead">Overhead (Operating)</option>
                  <option value="Salary">Salary / Payroll</option>
                  <option value="Capital">Capital Expenditure</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Description *</label>
                <input type="text" className="leh-input" style={{ height: '42px', marginTop: '4px', width: '100%' }} placeholder="e.g. Electricity bill — October 2026" value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Amount (₦) *</label>
                <input type="number" className="leh-input" style={{ height: '42px', marginTop: '4px', width: '100%' }} placeholder="0.00" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Approved By</label>
                  <input type="text" className="leh-input" style={{ height: '42px', marginTop: '4px', width: '100%' }} placeholder="Approver name" value={expenseForm.approved_by} onChange={e => setExpenseForm(p => ({ ...p, approved_by: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Payment Ref</label>
                  <input type="text" className="leh-input" style={{ height: '42px', marginTop: '4px', width: '100%' }} placeholder="Cheque / Transfer ref" value={expenseForm.payment_ref} onChange={e => setExpenseForm(p => ({ ...p, payment_ref: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Notes</label>
                <textarea className="leh-input" style={{ marginTop: '4px', width: '100%', minHeight: '80px', resize: 'vertical' }} placeholder="Additional notes (optional)" value={expenseForm.notes} onChange={e => setExpenseForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '8px' }}>
                <button className="leh-btn-secondary" onClick={() => setExpenseModal({ open: false, mode: 'add', record: null })} style={{ height: '44px', padding: '0 24px' }}>Cancel</button>
                <button className="leh-btn-primary" onClick={handleSaveExpense} disabled={expenseSaving} style={{ height: '44px', padding: '0 32px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {expenseSaving ? <RefreshCcw size={14} className="animate-spin" /> : <Check size={14} />}
                  {expenseModal.mode === 'add' ? 'RECORD EXPENSE' : 'SAVE CHANGES'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── SALARY SETUP MODAL ────────────────────────────────── */}
      {salaryModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '480px', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#0f172a' }}>
                {salaryModal.mode === 'edit' ? `MODIFY SALARY — ${salaryModal.record?.full_name}` : 'SET STAFF SALARY'}
              </h3>
              <button onClick={() => setSalaryModal({ open: false, mode: 'add', record: null })} style={{ border: 'none', background: '#f8fafc', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Staff Member *</label>
                <select
                  className="leh-select"
                  style={{ height: '42px', marginTop: '4px', width: '100%', opacity: salaryModal.mode === 'edit' ? 0.75 : 1 }}
                  value={salaryForm.user_id}
                  disabled={salaryModal.mode === 'edit'}
                  onChange={e => setSalaryForm(p => ({ ...p, user_id: e.target.value }))}
                >
                  <option value="">-- Select Staff --</option>
                  {allUsers.map((u: any) => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
                </select>
                {salaryModal.mode === 'edit' && (
                  <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#94a3b8', fontWeight: '600' }}>Staff member cannot be changed while modifying; set a new schedule to reassign.</p>
                )}
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Effective From *</label>
                <input type="date" className="leh-input" style={{ height: '42px', marginTop: '4px', width: '100%' }} value={salaryForm.effective_from} onChange={e => setSalaryForm(p => ({ ...p, effective_from: e.target.value }))} />
              </div>
              {[
                { key: 'basic_salary', label: 'Basic Salary (₦) *' },
                { key: 'transport_allowance', label: 'Transport Allowance (₦)' },
                { key: 'housing_allowance', label: 'Housing Allowance (₦)' },
                { key: 'other_allowances', label: 'Other Allowances (₦)' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>{f.label}</label>
                  <input type="number" className="leh-input" style={{ height: '42px', marginTop: '4px', width: '100%' }} placeholder="0.00"
                    value={(salaryForm as any)[f.key]} onChange={e => setSalaryForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '12px 16px', marginTop: '4px' }}>
                <p style={{ margin: 0, fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Estimated Gross</p>
                <p style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>
                  ₦{(parseFloat(salaryForm.basic_salary || '0') + parseFloat(salaryForm.transport_allowance || '0') + parseFloat(salaryForm.housing_allowance || '0') + parseFloat(salaryForm.other_allowances || '0')).toLocaleString()}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '8px' }}>
                <button className="leh-btn-secondary" onClick={() => setSalaryModal({ open: false, mode: 'add', record: null })} style={{ height: '44px', padding: '0 24px' }}>Cancel</button>
                <button
                  className="leh-btn-primary"
                  style={{ height: '44px', padding: '0 32px', display: 'flex', alignItems: 'center', gap: '8px' }}
                  disabled={salarySaving}
                  onClick={async () => {
                    if (!salaryForm.user_id || !salaryForm.basic_salary) { notify('error', 'Staff member and basic salary are required'); return; }
                    setSalarySaving(true);
                    try {
                      if (salaryModal.mode === 'edit' && salaryModal.record?.id) {
                        await api.updateStaffSalary(salaryModal.record.id, salaryForm);
                        notify('success', `Salary schedule updated for ${salaryModal.record.full_name}`);
                      } else {
                        await api.createStaffSalary(salaryForm);
                        notify('success', 'Salary schedule saved successfully');
                      }
                      setSalaryModal({ open: false, mode: 'add', record: null });
                      await loadPayrollData();
                    } catch (e: any) {
                      notify('error', e.message || 'Failed to save salary schedule');
                    } finally {
                      setSalarySaving(false);
                    }
                  }}
                >
                  {salarySaving ? <RefreshCcw size={14} className="animate-spin" /> : <Check size={14} />}
                  {salaryModal.mode === 'edit' ? 'UPDATE SALARY' : 'SAVE SALARY'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
