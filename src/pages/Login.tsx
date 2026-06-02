import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Eye, 
  EyeOff, 
  Lock, 
  User, 
  AlertCircle, 
  ShieldCheck, 
  Activity, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import './Login.css';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{username?: string, password?: string}>({});
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    const errors: {username?: string, password?: string} = {};
    if (!username.trim()) errors.username = 'Username is required';
    if (!password) errors.password = 'Password is required';
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    setError(null);
    setIsLoading(true);
    
    try {
      await login({ username, password });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-view">
      <div className="login-container">
        {/* Left Panel: Clinical Branding */}
        <div className="branding-panel">
          <div className="branding-content">
            <div className="brand-header animate-slide-up">
              <div className="brand-logo-container">
                <div className="brand-logo">
                  <Eye size={36} strokeWidth={2.5} />
                </div>
                <div className="brand-text">
                  <h1 className="brand-title">Luna Eye Hospital</h1>
                  <p className="brand-subtitle">CLINICAL EXCELLENCE & INNOVATION</p>
                </div>
              </div>
            </div>

            <div className="branding-main">
              <div className="pill-badge">ENTERPRISE EMR V2.4</div>
              <h2 className="hero-text animate-slide-up">
                Precision Care <br />
                <span className="text-highlight">Empowering Vision.</span>
              </h2>
              <p className="hero-description animate-slide-up">
                Welcome to VisionCare EMR. Our platform integrates advanced diagnostics and seamless clinical workflows to help you deliver world-class ophthalmology services.
              </p>

              <div className="feature-badges animate-slide-up">
                <div className="feature-badge">
                  <ShieldCheck size={18} />
                  <span>Secure & Compliant</span>
                </div>
                <div className="feature-badge">
                  <Activity size={18} />
                  <span>Real-time Triage</span>
                </div>
                <div className="feature-badge">
                  <Sparkles size={18} />
                  <span>Smart Clinical Logic</span>
                </div>
              </div>
            </div>

            <div className="branding-footer animate-fade-in">
              <p>© 2026 Luna Eye Hospital Group • Integrated Clinical Systems</p>
              <div className="footer-links">
                <a href="#">Support</a>
                <span className="dot"></span>
                <a href="#">Privacy</a>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Authentication Form */}
        <div className="form-panel">
          <div className="form-content animate-slide-up">
            <div className="form-header">
              <div className="lock-icon-container">
                <Lock size={20} strokeWidth={2} />
              </div>
              <h3 className="form-title">Staff Authentication</h3>
              <p className="form-subtitle">Access your clinical workspace safely.</p>
            </div>

            {error && (
              <div className="login-error-box">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="input-group">
                <label>CLINICAL IDENTIFIER</label>
                <div className={`input-wrapper ${fieldErrors.username ? 'error' : ''}`}>
                  <User size={18} className="input-icon" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username or Staff ID"
                    disabled={isLoading}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="input-group">
                <label>SECURITY KEY</label>
                <div className={`input-wrapper ${fieldErrors.password ? 'error' : ''}`}>
                  <Lock size={18} className="input-icon" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-options">
                <label className="remember-me">
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="checkbox-custom"></span>
                  <span>Trust this device for 30 days</span>
                </label>
                <a href="#" className="forgot-password">Recovery Access</a>
              </div>

              <button 
                type="submit" 
                className="login-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                   <LoadingSpinner size="small" mode="button" label="Authenticating..." color="white" />
                ) : (
                  <>
                    <span>Sign In to Terminal</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="form-footer">
              <p className="version-tag">VISIONCARE EMR — ENTERPRISE EDITION</p>
              <p className="certified-tag">Certified Clinical System</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
