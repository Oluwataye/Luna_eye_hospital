import React, { useState, useEffect } from 'react';
import { 
  UserPlus, ShieldCheck, Key, Edit3, Search, Users, Shield, X, Eye, EyeOff, UserCheck, UserX
} from 'lucide-react';
import { api } from '../api';
import { useNotification } from '../context/NotificationContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { StatCard } from '../components/StatCard';

export const UserManagement: React.FC = () => {
  const { notify } = useNotification();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isResetOnly, setIsResetOnly] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'Receptionist',
    department: '',
    status: 'Active'
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

  const handleReactivate = (userId: number, name: string) => {
    if (window.confirm(`Are you sure you want to reactivate account: ${name}?`)) {
      api.updateUser(userId, { status: 'Active' })
        .then(() => {
          notify('success', `Account ${name} has been reactivated.`);
          fetchUsers();
        })
        .catch((err: any) => notify('error', 'Reactivation failed: ' + err.message));
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

  const handleOpenModal = (user: any = null, resetOnly: boolean = false) => {
    setIsResetOnly(resetOnly);
    setShowPassword(false);
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        password: '', // Don't show password
        full_name: user.full_name,
        role: user.role,
        department: user.department || '',
        status: user.status || 'Active'
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        password: '',
        full_name: '',
        role: 'Receptionist',
        department: '',
        status: 'Active'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        if (isResetOnly) {
          if (!formData.password) {
            notify('error', 'Password cannot be empty');
            return;
          }
          await api.updateUser(editingUser.id, { password: formData.password });
          notify('success', 'User password reset successfully');
        } else {
          const { password, ...rest } = formData;
          const payload: any = { ...rest };
          if (password) {
            payload.password = password;
          }
          await api.updateUser(editingUser.id, payload);
          notify('success', 'User account updated successfully');
        }
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
                  <LoadingSpinner size="large" label="Synchronizing Staff Registry..." />
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
                     <span className={`leh-status-badge ${userAccount.status?.toLowerCase() === 'inactive' ? 'red' : 'green'}`} style={{ fontSize: '10px' }}>
                       {userAccount.status?.toUpperCase() || 'ACTIVE'}
                     </span>
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
                        className="leh-icon-btn" 
                        title="Reset Password"
                        style={{ color: 'var(--leh-amber)' }}
                        onClick={() => handleOpenModal(userAccount, true)}
                      >
                        <Key size={16} />
                      </button>
                      {userAccount.status?.toLowerCase() === 'inactive' ? (
                        <button 
                          className="leh-icon-btn" 
                          title="Reactivate Account"
                          style={{ color: 'var(--leh-green)' }}
                          onClick={() => handleReactivate(userAccount.id, userAccount.full_name)}
                        >
                          <UserCheck size={16} />
                        </button>
                      ) : (
                        <button 
                          className="leh-icon-btn red" 
                          title="Deactivate Account"
                          onClick={() => handleDeactivate(userAccount.id, userAccount.full_name)}
                        >
                          <UserX size={16} />
                        </button>
                      )}
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
                {isResetOnly ? (
                  <Key style={{ color: 'var(--leh-amber)' }} size={24} />
                ) : (
                  <ShieldCheck style={{ color: 'var(--leh-primary)' }} />
                )}
                <span>{isResetOnly ? 'Reset Staff Password' : editingUser ? 'Update Staff Identity' : 'Provision System Identity'}</span>
              </div>
              <button className="leh-modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="leh-modal-body">
              <form onSubmit={handleSubmit}>
                {isResetOnly && (
                  <div style={{ 
                    marginBottom: '24px', 
                    padding: '16px', 
                    background: 'var(--leh-primary-light)', 
                    borderRadius: '12px', 
                    border: '1.5px solid rgba(37, 99, 235, 0.15)' 
                  }}>
                    <p style={{ fontSize: '13px', color: 'var(--leh-text-dark)', fontWeight: '600', margin: 0 }}>
                      Resetting access credentials for:
                    </p>
                    <p style={{ fontSize: '15px', color: 'var(--leh-primary)', fontWeight: '800', margin: '4px 0 0 0' }}>
                      {editingUser?.full_name} ({editingUser?.username})
                    </p>
                  </div>
                )}

                {!isResetOnly && (
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
                          <option value="Doctor">Medical Doctor</option>
                          <option value="Pharmacist">Pharmacist</option>
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
                      {editingUser && (
                        <div className="leh-form-group">
                          <label className="leh-label">ACCOUNT STATUS</label>
                          <select
                            className="leh-select"
                            value={formData.status}
                            onChange={e => setFormData({...formData, status: e.target.value})}
                          >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="leh-form-section">
                  <h4 className="leh-form-section-title">
                    <Key size={14} /> {isResetOnly ? 'Access Code' : 'Access Credentials'}
                  </h4>
                  <div className="leh-form-grid">
                    {!isResetOnly && (
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
                    )}
                    <div className="leh-form-group full-width">
                      <label className="leh-label">
                        {isResetOnly ? 'NEW TEMPORARY PASSWORD' : editingUser ? 'RESET PASSWORD (LEAVE BLANK TO KEEP UNCHANGED)' : 'TEMPORARY PASSWORD'}
                      </label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="leh-input"
                          style={{ paddingRight: '48px' }}
                          required={!editingUser || isResetOnly}
                          placeholder={isResetOnly ? '••••••••' : editingUser ? 'Leave blank to keep current password' : '••••••••'}
                          value={formData.password}
                          onChange={e => setFormData({...formData, password: e.target.value})}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            position: 'absolute',
                            right: '16px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--leh-text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0
                          }}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--leh-text-muted)', marginTop: '4px', fontWeight: '500' }}>
                        Password must be at least 4 characters long.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="leh-modal-footer" style={{ padding: '0', marginTop: '16px' }}>
                  <button type="button" className="leh-btn-outline" style={{ flex: 1, height: '52px' }} onClick={() => setIsModalOpen(false)}>CANCEL</button>
                  <button type="submit" className="leh-btn-primary" style={{ flex: 2, height: '52px' }}>
                    <ShieldCheck size={18} />
                    <span>{isResetOnly ? 'RESET PASSWORD' : editingUser ? 'SAVE IDENTITY' : 'AUTHORIZE ACCOUNT'}</span>
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
