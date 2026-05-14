import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, Calendar, Shield, Save, Key, RefreshCw, BadgeCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { useNotification } from '../context/NotificationContext';

export const Profile: React.FC = () => {
  const { user, updateUserLocally } = useAuth();
  const { notify } = useNotification();
  const [loading, setLoading] = useState(false);

  // Profile Edit State
  const [profileData, setProfileData] = useState({
    full_name: '',
    phone_number: ''
  });

  // Password Change State
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        full_name: user.full_name,
        phone_number: user.phone_number || ''
      });
    }
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      await api.updateProfile(user.id, profileData);
      updateUserLocally(profileData);
      notify('success', 'Profile information updated successfully');
    } catch (err: any) {
      notify('error', err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (passwordData.new_password !== passwordData.confirm_password) {
      return notify('error', 'New passwords do not match');
    }

    if (passwordData.new_password.length < 4) {
      return notify('warning', 'Password must be at least 4 characters long');
    }

    setLoading(true);

    try {
      await api.changePassword({
        user_id: user.id,
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      });
      notify('success', 'Your password has been changed successfully');
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
    } catch (err: any) {
      notify('error', err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
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
            boxShadow: '0 8px 16px -4px rgba(37, 99, 235, 0.3)'
          }}>
            <User size={28} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 className="leh-page-title">Personal Profile</h1>
            <p className="leh-page-subtitle">Operator credentials • Communication preferences • Security node</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Identity Snapshot */}
        <aside className="lg:col-span-4 flex flex-col gap-8">
          <div className="leh-table-card" style={{ padding: '48px 32px', textAlign: 'center' }}>
            <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 24px' }}>
              <div style={{ 
                width: '100%', 
                height: '100%', 
                background: 'var(--leh-primary-light)', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'var(--leh-primary)',
                border: '4px solid #fff',
                boxShadow: '0 0 0 1px #e2e8f0'
              }}>
                <User size={64} />
              </div>
              <div style={{ 
                position: 'absolute', 
                bottom: '4px', 
                right: '4px', 
                width: '32px', 
                height: '32px', 
                background: '#10b981', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#fff',
                border: '3px solid #fff'
              }}>
                <BadgeCheck size={18} />
              </div>
            </div>
            <h2 className="leh-page-title" style={{ fontSize: '24px', margin: '0 0 4px' }}>{user?.full_name}</h2>
            <p className="leh-status-dot" style={{ background: '#f5f3ff', color: '#7c3aed', fontWeight: '900', fontSize: '11px' }}>{user?.role.toUpperCase()}</p>
            <p className="leh-label" style={{ fontSize: '13px', marginTop: '12px' }}>@{user?.username}</p>
          </div>

          <div className="leh-table-card" style={{ padding: '32px' }}>
            <h3 className="leh-label" style={{ fontWeight: '900', color: '#1e293b', marginBottom: '24px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>Account Metadata</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', background: '#f8fafc', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                  <Mail size={18} />
                </div>
                <div>
                  <p className="leh-label" style={{ fontSize: '10px', fontWeight: '800', margin: 0 }}>ACCESS NODE</p>
                  <p className="leh-table-bold" style={{ fontSize: '13px', margin: 0 }}>{user?.username}</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', background: '#f8fafc', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                  <Phone size={18} />
                </div>
                <div>
                  <p className="leh-label" style={{ fontSize: '10px', fontWeight: '800', margin: 0 }}>TELEMETRY LINE</p>
                  <p className="leh-table-bold" style={{ fontSize: '13px', margin: 0 }}>{user?.phone_number || 'NOT PROVISIONED'}</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', background: '#f8fafc', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                  <Shield size={18} />
                </div>
                <div>
                  <p className="leh-label" style={{ fontSize: '10px', fontWeight: '800', margin: 0 }}>AUTHORIZATION</p>
                  <p className="leh-table-bold" style={{ fontSize: '13px', margin: 0 }}>{user?.role}</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ width: '40px', height: '40px', background: '#f8fafc', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                  <Calendar size={18} />
                </div>
                <div>
                  <p className="leh-label" style={{ fontSize: '10px', fontWeight: '800', margin: 0 }}>COMMISSION DATE</p>
                  <p className="leh-table-bold" style={{ fontSize: '13px', margin: 0 }}>{formatDate(user?.created_at)}</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Right: Operational Controls */}
        <main className="lg:col-span-8 flex flex-col gap-8">
          {/* Identity Update */}
          <div className="leh-table-card" style={{ padding: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
              <User size={20} style={{ color: 'var(--leh-primary)' }} />
              <h3 className="leh-table-title" style={{ margin: 0 }}>Operational Identity Update</h3>
            </div>
            
            <form onSubmit={handleProfileUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="leh-form-group" style={{ marginBottom: 0 }}>
                  <label className="leh-label">Full Operator Name</label>
                  <input
                    className="leh-input"
                    style={{ height: '48px' }}
                    type="text"
                    required
                    value={profileData.full_name}
                    onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                    placeholder="Enter legal full name"
                  />
                </div>
                <div className="leh-form-group" style={{ marginBottom: 0 }}>
                  <label className="leh-label">Communications Line (Tel)</label>
                  <input
                    className="leh-input"
                    style={{ height: '48px' }}
                    type="tel"
                    value={profileData.phone_number}
                    onChange={(e) => setProfileData({ ...profileData, phone_number: e.target.value })}
                    placeholder="e.g. +234..."
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '24px', borderTop: '1px solid #f1f5f9' }}>
                <button 
                  type="submit" 
                  className="leh-btn-primary" 
                  style={{ height: '56px', padding: '0 40px', fontWeight: '800' }} 
                  disabled={loading}
                >
                  {loading ? <RefreshCw className="animate-spin" size={20} style={{ marginRight: '10px' }} /> : <Save size={20} style={{ marginRight: '10px' }} />}
                  {loading ? 'COMMITING...' : 'AUTHORIZE UPDATE'}
                </button>
              </div>
            </form>
          </div>

          {/* Security Protocol */}
          <div className="leh-table-card" style={{ padding: '40px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
              <Key size={20} style={{ color: 'var(--leh-primary)' }} />
              <h3 className="leh-table-title" style={{ margin: 0 }}>Access Credential Management</h3>
            </div>
            
            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="leh-form-group" style={{ marginBottom: 0 }}>
                <label className="leh-label">Current Authentication Payload</label>
                <input
                  className="leh-input"
                  style={{ height: '48px' }}
                  type="password"
                  required
                  value={passwordData.current_password}
                  onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="leh-form-group" style={{ marginBottom: 0 }}>
                  <label className="leh-label">New Security Credential</label>
                  <input
                    className="leh-input"
                    style={{ height: '48px' }}
                    type="password"
                    required
                    value={passwordData.new_password}
                    onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
                <div className="leh-form-group" style={{ marginBottom: 0 }}>
                  <label className="leh-label">Re-verify New Credential</label>
                  <input
                    className="leh-input"
                    style={{ height: '48px' }}
                    type="password"
                    required
                    value={passwordData.confirm_password}
                    onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '24px', borderTop: '1px solid #f1f5f9' }}>
                <button 
                  type="submit" 
                  className="leh-btn-primary" 
                  style={{ height: '56px', padding: '0 40px', fontWeight: '800', background: '#1e293b' }} 
                  disabled={loading}
                >
                  {loading ? <RefreshCw className="animate-spin" size={20} style={{ marginRight: '10px' }} /> : <Key size={20} style={{ marginRight: '10px' }} />}
                  {loading ? 'RE-ENCRYPTING...' : 'ROTATE CREDENTIALS'}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
};
