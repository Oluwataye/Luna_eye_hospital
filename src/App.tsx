import React from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import ReprintManagement from './pages/ReprintManagement';
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

  return (
    <div className="app-layout">
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

function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/login" element={<Login />} />
            
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<ProtectedRoute allowedRoles={['Admin', 'Optometrist', 'Consultant', 'Receptionist', 'Nurse']}><Dashboard /></ProtectedRoute>} />
              <Route path="patients">
                <Route index element={<ProtectedRoute allowedRoles={['Admin', 'Optometrist', 'Consultant', 'Receptionist', 'Nurse']}><Patients /></ProtectedRoute>} />
                <Route path="register" element={<ProtectedRoute allowedRoles={['Admin', 'Receptionist']}><PatientRegistration /></ProtectedRoute>} />
                <Route path="profile/:id" element={<ProtectedRoute allowedRoles={['Admin', 'Optometrist', 'Consultant', 'Receptionist', 'Nurse']}><Patients view="profile" /></ProtectedRoute>} />
                <Route path="check-in/:id" element={<ProtectedRoute allowedRoles={['Admin', 'Receptionist', 'Nurse']}><Patients view="checkin" /></ProtectedRoute>} />
              </Route>
              <Route path="consultations" element={<ProtectedRoute allowedRoles={['Admin', 'Optometrist', 'Consultant', 'Nurse']}><Consultations /></ProtectedRoute>} />
              <Route path="triage" element={<ProtectedRoute allowedRoles={['Admin', 'Nurse', 'Receptionist']}><Triage /></ProtectedRoute>} />
              <Route path="results" element={<ProtectedRoute allowedRoles={['Admin', 'Optometrist', 'Consultant', 'Nurse']}><Results /></ProtectedRoute>} />
              <Route path="admissions" element={<ProtectedRoute allowedRoles={['Admin', 'Optometrist', 'Consultant', 'Nurse']}><Admissions /></ProtectedRoute>} />
              <Route path="billing" element={<ProtectedRoute allowedRoles={['Admin', 'Receptionist']}><Billing /></ProtectedRoute>} />
              <Route path="inventory" element={<ProtectedRoute allowedRoles={['Admin']}><Inventory /></ProtectedRoute>} />
              <Route path="procurement" element={<ProtectedRoute allowedRoles={['Admin']}><Procurement /></ProtectedRoute>} />
              <Route path="reports" element={<ProtectedRoute allowedRoles={['Admin']}><Reports /></ProtectedRoute>} />
              <Route path="users" element={<ProtectedRoute allowedRoles={['Admin']}><UserManagement /></ProtectedRoute>} />
              <Route path="audit-logs" element={<ProtectedRoute allowedRoles={['Admin']}><AuditLogs /></ProtectedRoute>} />
              <Route path="admin/reprint-management" element={<ProtectedRoute allowedRoles={['Admin']}><ReprintManagement /></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute allowedRoles={['Admin']}><Settings /></ProtectedRoute>} />
              <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </NotificationProvider>
  );
}

export default App;
