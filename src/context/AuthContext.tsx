import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

interface User {
  id: number;
  username: string;
  role: string;
  full_name: string;
  phone_number?: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null; // Kept for type compatibility (always null)
  login: (credentials: any) => Promise<void>;
  logout: () => Promise<void>;
  updateUserLocally: (updatedFields: Partial<User>) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load user metadata from localStorage on init and verify session on server
    const storedUser = localStorage.getItem('user');
    
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      api.getProfile(parsedUser.id)
        .then((profile) => {
          setUser(profile);
        })
        .catch((err) => {
          console.warn('[AUTH] Session verification failed on startup:', err.message);
          setUser(null);
          localStorage.removeItem('user');
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (credentials: any) => {
    const data = await api.login(credentials);
    setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (err: any) {
      console.error('[AUTH] Server logout call failed:', err.message);
    } finally {
      setUser(null);
      localStorage.removeItem('user');
    }
  };

  const updateUserLocally = (updatedFields: Partial<User>) => {
    if (user) {
      const newUser = { ...user, ...updatedFields };
      setUser(newUser);
      localStorage.setItem('user', JSON.stringify(newUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, token: null, login, logout, updateUserLocally, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
