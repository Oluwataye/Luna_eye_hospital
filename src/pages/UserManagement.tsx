import React, { useState, useEffect } from 'react';
import { 
  UserPlus, ShieldCheck, Key, Edit3, Search, Users, Shield, RefreshCcw, X, Trash2
} from 'lucide-react';
import { api } from '../api';
import { useNotification } from '../context/NotificationContext';
import { StatCard } from '../components/StatCard';

export const UserManagement: React.FC = () => {
  const { notify } = useNotification();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'Receptionist',
    department: ''
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const uData = await api.getUsers();
      setUsers(uData);
    } catch (error: any) {
      notify('error', 'Failed to load user accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = (userId: number, name: string) => {
    if (window.confirm(`Are you sure you want to deactivate account: ${name}?`)) {
      api.deleteUser(userId)
        .then(() => {
          notify('success', `Account ${name} has been deactivated.`);
          fetchUsers();
        })
        .catch((err: any) => notify('error', 'Deactivation failed: ' + err.message));
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (user: any = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        password: '', // Don't show password
        full_name: user.full_name,
        role: user.role,
        department: user.department || ''
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        password: '',
        full_name: '',
        role: 'Receptionist',
        department: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, formData);
        notify('success', 'User account updated successfully');
      } else {
        await api.createUser(formData);
        notify('success', 'New user account provisioned successfully');
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (error: any) {
      notify('error', error.message || 'Operation failed');
    }
  };

  return (
    <div className="leh-page-container">
      {/* Page Header */}
      <header className="leh-page-header">
        <div className="leh-header-left">
          <div className="leh-header-icon-box" style={{ background: 'var(--leh-primary)' }}>
            <ShieldCheck size={28} />
          </div>
          <div className="leh-header-text">
            <h1 className="leh-page-title">Identity & Access Management</h1>
            <p className="leh-page-subtitle">Administrative oversight • Role-based access control (RBAC)</p>
          </div>
        </div>

        <div className="leh-header-actions">
          <div className="leh-search-box" style={{ width: '300px' }}>
            <Search size={18} className="leh-search-icon" />
            <input
              placeholder="Search user accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              spellCheck={false}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="leh-search-clear" type="button">
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>&times;</span>
              </button>
            )}
          </div>
          <button className="leh-btn-primary" onClick={() => handleOpenModal()}>
            <UserPlus size={20} />
            <span>PROVISION ACCOUNT</span>
          </button>
        </div>
      </header>

      {/* Stats Ribbon */}
      <div className="leh-stat-grid" style={{ marginBottom: '40px' }}>
        <StatCard 
          title="TOTAL ACCOUNTS" 
          value={users.length} 
          icon={Users} 
          colorClass="blue" 
          subtitle="Provisioned users"
        />
        <StatCard 
          title="ADMINISTRATORS" 
          value={users.filter(u => u.role === 'Admin').length} 
          icon={Shield} 
          colorClass="amber" 
          subtitle="Privileged access"
        />
        <StatCard 
          title="ACTIVE CLINICIANS" 
          value={users.filter(u => ['Consultant', 'Nurse', 'Optometrist'].includes(u.role)).length} 
          icon={ShieldCheck} 
          colorClass="green" 
          subtitle="Licensed providers"
        />
      </div>

      {/* Main Content: Users Table */}
      <div className="leh-table-wrapper">
        <table className="leh-table">
          <thead>
            <tr>
              <th>STAFF IDENTITY</th>
              <th>SYSTEM USERNAME</th>
              <th>AUTHORIZATION ROLE</th>
              <th>DEPARTMENT</th>
              <th>ACCOUNT STATUS</th>
              <th style={{ textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '80px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <RefreshCcw size={40} className="animate-spin text-blue-500" />
                    <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--leh-text-muted)', textTransform: 'uppercase' }}>
                      Authenticating Registry...
                    </p>
                  </div>
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '80px' }}>
                  <div style={{ opacity: 0.3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <Users size={64} />
                    <p style={{ fontWeight: '800', textTransform: 'uppercase', fontSize: '14px' }}>No user records discovered</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredUsers.map((userAccount) => (
                <tr key={userAccount.id} className="leh-table-row">
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '700', color: 'var(--leh-text-dark)' }}>{userAccount.full_name}</span>
                      <span style={{ fontSize: '10px', color: 'var(--leh-text-light)', fontWeight: '700' }}>ID: USR-{userAccount.id.toString().padStart(4, '0')}</span>
                    </div>
                  </td>
                  <td>
                    <code style={{ fontSize: '13px', fontWeight: '900', color: 'var(--leh-primary)', background: 'var(--leh-primary-light)', padding: '2px 8px', borderRadius: '4px' }}>
                      {userAccount.username}
                    </code>
                  </td>
                  <td>
                    <span className="leh-status-badge blue" style={{ fontSize: '10px' }}>{userAccount.role}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--leh-text-muted)' }}>{userAccount.department || 'General'}</span>
                  </td>
                  <td>
                     <span className="leh-status-badge green" style={{ fontSize: '10px' }}>ACTIVE</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button 
                        className="leh-icon-btn" 
                        title="Edit Profile"
                        onClick={() => handleOpenModal(userAccount)}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        className="leh-icon-btn red" 
                        title="Deactivate Account"
                        onClick={() => handleDeactivate(userAccount.id, userAccount.full_name)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* User Modal */}
      {isModalOpen && (
        <div className="leh-modal-overlay">
          <div className="leh-modal-content" style={{ maxWidth: '520px' }}>
            <div className="leh-modal-header">
              <div className="leh-modal-title">
                <ShieldCheck style={{ color: 'var(--leh-primary)' }} />
                <span>{editingUser ? 'Update Staff Identity' : 'Provision System Identity'}</span>
              </div>
              <button className="leh-modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="leh-modal-body">
              <form onSubmit={handleSubmit}>
                <div className="leh-form-section">
                  <h4 className="leh-form-section-title">
                    <UserPlus size={14} /> Personnel Details
                  </h4>
                  <div className="leh-form-grid">
                    <div className="leh-form-group full-width">
                      <label className="leh-label">LEGAL FULL NAME</label>
                      <input
                        className="leh-input"
                        required
                        placeholder="e.g. Dr. Aminu Bello"
                        value={formData.full_name}
                        onChange={e => setFormData({...formData, full_name: e.target.value})}
                      />
                    </div>
                    <div className="leh-form-group">
                      <label className="leh-label">AUTHORIZATION ROLE</label>
                      <select
                        className="leh-select"
                        value={formData.role}
                        onChange={e => setFormData({...formData, role: e.target.value})}
                      >
                        <option value="Admin">System Administrator</option>
                        <option value="Optometrist">Optometrist</option>
                        <option value="Consultant">Consultant Ophth.</option>
                        <option value="Nurse">Ophthalmic Nurse</option>
                        <option value="Receptionist">Medical Records</option>
                      </select>
                    </div>
                    <div className="leh-form-group">
                      <label className="leh-label">OPERATIONAL UNIT</label>
                      <input
                        className="leh-input"
                        placeholder="e.g. Clinical"
                        value={formData.department}
                        onChange={e => setFormData({...formData, department: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="leh-form-section">
                  <h4 className="leh-form-section-title">
                    <Key size={14} /> Access Credentials
                  </h4>
                  <div className="leh-form-grid">
                    <div className="leh-form-group full-width">
                      <label className="leh-label">SYSTEM USERNAME</label>
                      <input
                        className="leh-input"
                        required
                        autoComplete="off"
                        placeholder="e.g. abello.clinical"
                        value={formData.username}
                        onChange={e => setFormData({...formData, username: e.target.value})}
                      />
                    </div>
                    {!editingUser && (
                      <div className="leh-form-group full-width">
                        <label className="leh-label">TEMPORARY PASSWORD</label>
                        <input
                          type="password"
                          className="leh-input"
                          required
                          placeholder="••••••••"
                          value={formData.password}
                          onChange={e => setFormData({...formData, password: e.target.value})}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="leh-modal-footer" style={{ padding: '0', marginTop: '16px' }}>
                  <button type="button" className="leh-btn-outline" style={{ flex: 1, height: '52px' }} onClick={() => setIsModalOpen(false)}>CANCEL</button>
                  <button type="submit" className="leh-btn-primary" style={{ flex: 2, height: '52px' }}>
                    <ShieldCheck size={18} />
                    <span>{editingUser ? 'SAVE IDENTITY' : 'AUTHORIZE ACCOUNT'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
