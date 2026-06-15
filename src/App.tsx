/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, startTransition } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { Login } from './features/auth/components/Login';
import { Register } from './features/auth/components/Register';
import { Dashboard } from './features/dashboard/components/Dashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { translations } from './lib/translations';

// Initialize core React Query state engine
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

export default function App() {
  const { initialize, initialized, user, loading, language } = useAuthStore();
  const t = translations[language];

  // Subscribe to Firebase Authentication state listener on mounting
  useEffect(() => {
    const unsubscribe = initialize();
    return () => {
      unsubscribe();
    };
  }, [initialize]);

  if (!initialized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800" id="boot-gate">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" id="boot-spinner"></div>
        <p className="text-sm font-medium text-slate-500 animate-pulse" id="boot-text">Loading MZ Health System...</p>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Portals */}
          <Route 
            path="/login" 
            element={user ? <Navigate to="/" replace /> : <Login />} 
          />
          <Route 
            path="/register" 
            element={<Register />} 
          />

          {/* Secure Protected Workspace Paths */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
