import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  if (pathnames.length === 0 || pathnames[0] === 'dashboard') return null;

  return (
    <nav className="breadcrumbs" aria-label="breadcrumb">
      <Link to="/dashboard" className="breadcrumb-item">
        <Home size={14} />
        <span>Dashboard</span>
      </Link>
      
      {pathnames.map((value, index) => {
        const last = index === pathnames.length - 1;
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const label = value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, ' ');

        return (
          <React.Fragment key={to}>
            <ChevronRight size={14} className="breadcrumb-separator" />
            {last ? (
              <span className="breadcrumb-item active">{label}</span>
            ) : (
              <Link to={to} className="breadcrumb-item">
                {label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
