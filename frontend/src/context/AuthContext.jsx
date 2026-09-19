import { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user')) ?? null;
    } catch {
      return null;
    }
  });

  const setSession = useCallback((token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const login = useCallback(
    async (email, password) => {
      const res = await api.post('/auth/login', { email, password });
      setSession(res.data.token, res.data.user);
      return res.data.user;
    },
    [setSession]
  );

  const register = useCallback(
    async (name, email, password) => {
      const res = await api.post('/auth/register', { name, email, password });
      setSession(res.data.token, res.data.user);
      return res.data.user;
    },
    [setSession]
  );

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('report_id');
    localStorage.removeItem('analysis_submission_id');
    localStorage.removeItem('analysis_report_id');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
