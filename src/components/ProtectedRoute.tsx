/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { startTransition } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { UserRole } from '../types';
import { translations } from '../lib/translations';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, profile, initialized, loading, language } = useAuthStore();
  const location = useLocation();
  const t = translations[language];

  if (!initialized || (loading && !user)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800" id="loading-spinner-parent">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" id="loading-spinner"></div>
        <p className="text-sm font-medium text-slate-500 animate-pulse" id="loading-text">{t.verifying}</p>
      </div>
    );
  }

  // No active authenticated session
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Signed in, but has not completed onboarding/profile mapping in Firestore
  if (!profile && location.pathname !== '/register' && location.pathname !== '/login') {
    return <Navigate to="/register" replace />;
  }

  // Role Based Routing validation
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12" id="unauthorized-card-holder">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center" id="unauthorized-card">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6" id="unauthorized-icon-wrapper">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" id="unauthorized-svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2" id="unauthorized-title">{t.authError}</h2>
          <p className="text-slate-500 mb-6" id="unauthorized-desc">{t.permissionsRequired}</p>
          <div className="flex flex-col gap-3" id="unauthorized-actions">
            <button
              onClick={() => {
                startTransition(() => {
                  window.location.href = '/';
                });
              }}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 px-4 rounded-xl transition duration-150"
              id="back-home-unauth"
            >
              Back to Safety
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Account blocked by administrator
  if (profile && !profile.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4" id="banned-card-holder">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center" id="banned-card">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6" id="banned-icon-wrapper">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" id="banned-svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2" id="banned-title">{t.inactiveStatus}</h2>
          <p className="text-slate-500 mb-6" id="banned-desc">Your clinical portal session has been suspended by an administrator for auditing purposes.</p>
          <button
            onClick={() => useAuthStore.getState().logout()}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 px-4 rounded-xl transition duration-150"
            id="banned-logout-btn"
          >
            {t.logoutButton}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
