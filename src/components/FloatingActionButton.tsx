import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Users, 
  Receipt, 
  Package, 
  BarChart3, 
  X 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const FloatingActionButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  if (!user || user.role.toLowerCase() !== 'admin') return null;

  const actions = [
    { label: 'Register Patient', icon: <Users size={18} />, path: '/patients/register' },
    { label: 'New Billing', icon: <Receipt size={18} />, path: '/billing' },
    { label: 'Add Inventory', icon: <Package size={18} />, path: '/inventory' },
    { label: 'View Reports', icon: <BarChart3 size={18} />, path: '/reports' },
  ];

  return (
    <div className={`fab-container no-print ${isOpen ? 'active' : ''}`}>
      <div className="fab-menu">
        {actions.map((action, i) => (
          <Link 
            key={i} 
            to={action.path} 
            className="fab-item"
            onClick={() => setIsOpen(false)}
          >
            <div className="fab-item-icon">{action.icon}</div>
            <span>{action.label}</span>
          </Link>
        ))}
      </div>
      <button 
        className={`fab-main ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Quick actions"
      >
        {isOpen ? <X size={28} /> : <Plus size={28} />}
      </button>
    </div>
  );
};
