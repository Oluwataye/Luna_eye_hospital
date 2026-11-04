import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FileText,
  ShieldCheck,
  Users,
  Building2,
  DollarSign,
  CreditCard,
  BarChart3,
  Shield
} from 'lucide-react';
import './Insurance.css';

interface InsuranceNavHeaderProps {
  title: string;
  subtitle: string;
  badge?: string;
  actions?: React.ReactNode;
}

export const InsuranceNavHeader: React.FC<InsuranceNavHeaderProps> = ({
  title,
  subtitle,
  badge = 'Insurance & Managed Care Desk',
  actions
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { path: '/insurance/claims', label: 'Claims & Batches', icon: FileText },
    { path: '/insurance/authorizations', label: 'Authorizations', icon: ShieldCheck },
    { path: '/insurance/enrollees', label: 'Enrollees', icon: Users },
    { path: '/insurance/payers', label: 'Payers & Plans', icon: Building2 },
    { path: '/insurance/tariffs', label: 'Tariff Schedules', icon: DollarSign },
    { path: '/insurance/remittances', label: 'Remittances (EOB)', icon: CreditCard },
    { path: '/insurance/reports', label: 'Insurance Reports', icon: BarChart3 },
  ];

  return (
    <div className="insurance-module-header">
      <div className="insurance-header-top">
        <div className="insurance-title-group">
          <div className="insurance-badge-chip">
            <Shield size={12} />
            <span>{badge}</span>
          </div>
          <h1 className="insurance-title">{title}</h1>
          <p className="insurance-subtitle">{subtitle}</p>
        </div>

        {actions && (
          <div className="insurance-header-actions">
            {actions}
          </div>
        )}
      </div>

      <nav className="insurance-nav-tabs-container" aria-label="Insurance Sub-navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path || (item.path !== '/insurance/claims' && currentPath.startsWith(item.path));

          return (
            <button
              key={item.path}
              type="button"
              className={`insurance-nav-tab ${isActive ? 'insurance-nav-tab--active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <Icon size={15} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default InsuranceNavHeader;
