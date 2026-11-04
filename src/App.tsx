import React from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SidebarProvider, useSidebar } from './context/SidebarContext';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Patients } from './pages/Patients';
import { Consultations } from './pages/Consultations';
import { Results } from './pages/Results';
import { Admissions } from './pages/Admissions';
import { Billing } from './pages/Billing';
import { Inventory } from './pages/Inventory';
import { Procurement } from './pages/Procurement';
import { Reports } from './pages/Reports';
import { UserManagement } from './pages/UserManagement';
import { AuditLogs } from './pages/AuditLogs';
import { Settings } from './pages/Settings';
import { Triage } from './pages/Triage';
import { Profile } from './pages/Profile';
import { PatientRegistration } from './pages/PatientRegistration';
import { FamilyProfile } from './pages/FamilyProfile';
import ReprintManagement from './pages/ReprintManagement';
import { InsuranceClaims } from './pages/insurance/InsuranceClaims';
import { InsuranceClaimDetail } from './pages/insurance/InsuranceClaimDetail';
import { InsuranceAuthorizations } from './pages/insurance/InsuranceAuthorizations';
import { InsuranceEnrollees } from './pages/insurance/InsuranceEnrollees';
import { PayersPlans } from './pages/insurance/PayersPlans';
import { InsuranceTariffs } from './pages/insurance/InsuranceTariffs';
import { InsuranceRemittances } from './pages/insurance/InsuranceRemittances';
import { InsuranceReports } from './pages/insurance/InsuranceReports';
import { Footer } from './components/Footer';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading system...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const normalizedRole = (user?.role || '').toLowerCase().trim();

  if (allowedRoles && user && !allowedRoles.map(r => r.toLowerCase().trim()).includes(normalizedRole)) {
    return <Navigate to="/dashboard" replace />; // or unauthorized page
  }

  return <>{children}</>;
};

import { Breadcrumbs } from './components/Breadcrumbs';
import { FloatingActionButton } from './components/FloatingActionButton';

const Layout = () => {
  const location = useLocation();
  const { collapsed } = useSidebar();

  return (
    <div className={`app-layout${collapsed ? ' layout--sidebar-collapsed' : ''}`}>
      <Sidebar />
      <div className="content-wrapper">
        <Topbar />
        <main className="main-content">
          <Breadcrumbs />
          <div key={location.pathname} className="animate-fade-in">
            <Outlet />
          </div>
          <Footer />
        </main>
        <FloatingActionButton />
      </div>
    </div>
  );
};

import { NotificationProvider } from './context/NotificationContext';
import { AlertProvider } from './context/AlertContext';
import { VoiceSessionProvider } from './components/voice';
import { useGlobalDictationHotkey } from './hooks/useGlobalDictationHotkey';

/** Mounts the global dictation hotkey listener inside the app tree */
const HotkeyActivator: React.FC = () => {
  useGlobalDictationHotkey();
  return null;
};

function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <SidebarProvider>
          <AlertProvider>
            <VoiceSessionProvider>
              <BrowserRouter>
              <HotkeyActivator />
              <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/auth/login" element={<Login />} />
              
              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<ProtectedRoute allowedRoles={['Admin', 'Optometrist', 'Consultant', 'Receptionist', 'Nurse']}><Dashboard /></ProtectedRoute>} />
                <Route path="patients">
                  <Route index element={<ProtectedRoute allowedRoles={['Admin', 'Optometrist', 'Consultant', 'Receptionist', 'Nurse']}><Patients /></ProtectedRoute>} />
                  <Route path="register" element={<ProtectedRoute allowedRoles={['Admin', 'Receptionist']}><PatientRegistration /></ProtectedRoute>} />
                  <Route path="family/:id" element={<ProtectedRoute allowedRoles={['Admin', 'Optometrist', 'Consultant', 'Receptionist', 'Nurse']}><FamilyProfile /></ProtectedRoute>} />
                  <Route path="profile/*" element={<ProtectedRoute allowedRoles={['Admin', 'Optometrist', 'Consultant', 'Receptionist', 'Nurse']}><Patients view="profile" /></ProtectedRoute>} />
                  <Route path="check-in/*" element={<ProtectedRoute allowedRoles={['Admin', 'Receptionist', 'Nurse']}><Patients view="checkin" /></ProtectedRoute>} />
                </Route>
                <Route path="consultations" element={<ProtectedRoute allowedRoles={['Admin', 'Optometrist', 'Consultant', 'Nurse']}><Consultations /></ProtectedRoute>} />
                <Route path="triage" element={<ProtectedRoute allowedRoles={['Admin', 'Nurse', 'Receptionist']}><Triage /></ProtectedRoute>} />
                <Route path="results" element={<ProtectedRoute allowedRoles={['Admin', 'Optometrist', 'Consultant', 'Nurse']}><Results /></ProtectedRoute>} />
                <Route path="admissions" element={<ProtectedRoute allowedRoles={['Admin', 'Optometrist', 'Consultant', 'Nurse']}><Admissions /></ProtectedRoute>} />
                <Route path="billing" element={<ProtectedRoute allowedRoles={['Admin', 'Receptionist']}><Billing /></ProtectedRoute>} />
                <Route path="inventory" element={<ProtectedRoute allowedRoles={['Admin']}><Inventory /></ProtectedRoute>} />
                <Route path="procurement" element={<ProtectedRoute allowedRoles={['Admin']}><Procurement /></ProtectedRoute>} />
                <Route path="reports" element={<ProtectedRoute allowedRoles={['Admin']}><Reports /></ProtectedRoute>} />
                <Route path="profit-loss" element={<ProtectedRoute allowedRoles={['Admin']}><Reports initialTab="profit_loss" /></ProtectedRoute>} />
                <Route path="expenses" element={<ProtectedRoute allowedRoles={['Admin']}><Reports initialTab="expenses" /></ProtectedRoute>} />
                <Route path="payroll" element={<ProtectedRoute allowedRoles={['Admin']}><Reports initialTab="payroll" /></ProtectedRoute>} />
                <Route path="tax" element={<ProtectedRoute allowedRoles={['Admin']}><Reports initialTab="tax" /></ProtectedRoute>} />
                <Route path="users" element={<ProtectedRoute allowedRoles={['Admin']}><UserManagement /></ProtectedRoute>} />
                <Route path="audit-logs" element={<ProtectedRoute allowedRoles={['Admin']}><AuditLogs /></ProtectedRoute>} />
                <Route path="admin/reprint-management" element={<ProtectedRoute allowedRoles={['Admin']}><ReprintManagement /></ProtectedRoute>} />
                <Route path="settings" element={<ProtectedRoute allowedRoles={['Admin']}><Settings /></ProtectedRoute>} />
                <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

                {/* Medical Insurance & Claims Module (Admin only) */}
                <Route path="insurance">
                  <Route index element={<Navigate to="/insurance/claims" replace />} />
                  <Route path="claims" element={<ProtectedRoute allowedRoles={['Admin']}><InsuranceClaims /></ProtectedRoute>} />
                  <Route path="claims/:id" element={<ProtectedRoute allowedRoles={['Admin']}><InsuranceClaimDetail /></ProtectedRoute>} />
                  <Route path="authorizations" element={<ProtectedRoute allowedRoles={['Admin']}><InsuranceAuthorizations /></ProtectedRoute>} />
                  <Route path="enrollees" element={<ProtectedRoute allowedRoles={['Admin']}><InsuranceEnrollees /></ProtectedRoute>} />
                  <Route path="payers" element={<ProtectedRoute allowedRoles={['Admin']}><PayersPlans /></ProtectedRoute>} />
                  <Route path="tariffs" element={<ProtectedRoute allowedRoles={['Admin']}><InsuranceTariffs /></ProtectedRoute>} />
                  <Route path="remittances" element={<ProtectedRoute allowedRoles={['Admin']}><InsuranceRemittances /></ProtectedRoute>} />
                  <Route path="reports" element={<ProtectedRoute allowedRoles={['Admin']}><InsuranceReports /></ProtectedRoute>} />
                </Route>

                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
              </Routes>
            </BrowserRouter>
            </VoiceSessionProvider>
          </AlertProvider>
        </SidebarProvider>
      </AuthProvider>
    </NotificationProvider>
  );
}

export default App;
