import React from 'react';
import { useAuth } from '../context/AuthContext';
import { AdminDashboard } from './AdminDashboard';
import { ConsultantDashboard } from './ConsultantDashboard';
import { NurseDashboard } from './NurseDashboard';
import { ReceptionistDashboard } from './ReceptionistDashboard';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();

  const role = (user?.role || '').toLowerCase().trim();

  // Route to the specific dashboard based on the user's role
  if (role === 'consultant' || role === 'optometrist') {
    return <ConsultantDashboard />;
  }
  
  if (role === 'nurse') {
    return <NurseDashboard />;
  }

  if (role === 'receptionist') {
    return <ReceptionistDashboard />;
  }

  if (role === 'admin') {
    return <AdminDashboard />;
  }

  // Final fallback to a generic state or login if role is unknown
  return <div className="p-8 text-center">Accessing system...</div>;
};
