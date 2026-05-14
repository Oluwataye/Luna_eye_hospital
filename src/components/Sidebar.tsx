import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Stethoscope, 
  FlaskConical, 
  BedDouble, 
  Receipt, 
  Package, 
  Settings, 
  LogOut,
  Truck,
  BarChart3,
  Activity,
  Printer,
  Eye,
  ChevronRight,
  ShieldCheck,
  ClipboardList
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const navGroups = React.useMemo(() => [
    {
      label: 'Core Clinical',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Optometrist', 'Consultant', 'Receptionist', 'Nurse'] },
        { path: '/patients', label: 'Patients', icon: Users, roles: ['Admin', 'Optometrist', 'Consultant', 'Receptionist', 'Nurse'] },
        { path: '/triage', label: 'Triage', icon: Activity, roles: ['Admin', 'Nurse', 'Receptionist'] },
      ]
    },
    {
      label: 'Medical Services',
      items: [
        { path: '/consultations', label: 'Consultations', icon: Stethoscope, roles: ['Admin', 'Optometrist', 'Consultant'] },
        { path: '/results', label: 'Results', icon: FlaskConical, roles: ['Admin', 'Optometrist', 'Consultant', 'Nurse'] },
        { path: '/admissions', label: 'Admissions', icon: BedDouble, roles: ['Admin', 'Optometrist', 'Consultant', 'Nurse'] },
      ]
    },
    {
      label: 'Operations & Finance',
      items: [
        { path: '/billing', label: 'Billing', icon: Receipt, roles: ['Admin', 'Receptionist'] },
        { path: '/inventory', label: 'Inventory', icon: Package, roles: ['Admin'] },
        { path: '/procurement', label: 'Procurement', icon: Truck, roles: ['Admin'] },
        { path: '/reports', label: 'Reports', icon: BarChart3, roles: ['Admin'] },
      ]
    },
    {
      label: 'Administration',
      items: [
        { path: '/users', label: 'User Registry', icon: ShieldCheck, roles: ['Admin'] },
        { path: '/admin/reprint-management', label: 'Reprint Audit', icon: Printer, roles: ['Admin'] },
        { path: '/settings', label: 'Settings', icon: Settings, roles: ['Admin'] },
      ]
    }
  ], []);

  if (!user) return null;
  
  const userRole = (user.role || 'Receptionist').trim().toLowerCase();
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-container">
          <div className="sidebar-logo">
            <Eye size={24} strokeWidth={2.5} />
          </div>
          <div className="sidebar-brand-text">
            <h1 className="brand-name">Luna Eye</h1>
            <p className="brand-sub">Enterprise EMR</p>
          </div>
        </div>
      </div>

      <div className="sidebar-scrollable">
        <nav className="sidebar-nav">
          {navGroups.map((group) => {
            const filteredItems = group.items.filter(item => 
              userRole === 'admin' || item.roles.some(r => r.toLowerCase() === userRole)
            );
            
            if (filteredItems.length === 0) return null;

            return (
              <div key={group.label} className="nav-group">
                <div className="nav-group-label">{group.label}</div>
                {filteredItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  >
                    <item.icon className="sidebar-icon" size={20} />
                    <span className="sidebar-text">{item.label}</span>
                    <ChevronRight className="sidebar-chevron" size={14} />
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-profile">
          <div className="profile-avatar">
            {user.full_name?.charAt(0) || user.username?.charAt(0)}
          </div>
          <div className="profile-info">
            <span className="profile-name">{user.full_name || user.username}</span>
            <span className="profile-role">{user.role}</span>
          </div>
        </div>
        <button className="logout-btn" onClick={handleLogout} title="Sign Out">
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
