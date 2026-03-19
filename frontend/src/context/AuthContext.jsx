import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('halleyx_token');
    setUser(null);
    window.location.href = '/signin';
  }, []);

  // Initialize Auth
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('halleyx_token');
      if (token) {
        try {
          const { data } = await API.get('/auth/me');
          setUser(data);
        } catch (err) {
          console.error('Auth initialization failed:', err);
          localStorage.removeItem('halleyx_token');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // Axios interceptor for 401 handling
  useEffect(() => {
    const interceptor = API.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      API.interceptors.response.eject(interceptor);
    };
  }, [logout]);

  const login = (token, userData) => {
    localStorage.setItem('halleyx_token', token);
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      setUser
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
