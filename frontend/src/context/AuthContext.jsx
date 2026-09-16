import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

const getStoredToken = () => sessionStorage.getItem('chatz_token') || localStorage.getItem('chatz_token');
const saveToken = (token) => {
  sessionStorage.setItem('chatz_token', token);
  localStorage.setItem('chatz_token', token);
};
const clearToken = () => {
  sessionStorage.removeItem('chatz_token');
  localStorage.removeItem('chatz_token');
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(getStoredToken);
  const [isLoading, setIsLoading] = useState(true);

  // Check existing token on mount
  useEffect(() => {
    const initAuth = async () => {
      const currentToken = getStoredToken();
      if (currentToken) {
        try {
          const meRes = await api.getMe();
          if (meRes && meRes.success && meRes.user) {
            setUser(meRes.user);
          } else {
            clearToken();
            setToken(null);
            setUser(null);
          }
        } catch {
          clearToken();
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const res = await api.login({ email, password });
    if (res && res.success) {
      saveToken(res.token);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    }
    throw new Error(res?.message || 'Login failed');
  };

  const register = async (userData) => {
    const res = await api.register(userData);
    if (res && res.success) {
      saveToken(res.token);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    }
    throw new Error(res?.message || 'Registration failed');
  };

  const logout = () => {
    clearToken();
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (updatesOrUser) => {
    if (updatesOrUser && updatesOrUser.id && updatesOrUser.email) {
      setUser(prev => ({ ...prev, ...updatesOrUser }));
      return { success: true, user: updatesOrUser };
    }
    const res = await api.updateProfile(updatesOrUser);
    if (res && res.success) {
      setUser(res.user);
    }
    return res;
  };

  // Keep authenticated state synchronized when updated from Admin Console or Sockets
  useEffect(() => {
    const handleUserUpdated = (e) => {
      const updatedUser = e.detail;
      if (updatedUser && user && updatedUser.id === user.id) {
        setUser(prev => ({ ...prev, ...updatedUser }));
      }
    };
    window.addEventListener('hdtalk:user-updated', handleUserUpdated);
    return () => window.removeEventListener('hdtalk:user-updated', handleUserUpdated);
  }, [user?.id]);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      updateProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
