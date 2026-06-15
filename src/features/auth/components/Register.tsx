/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useTransition } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { translations } from '../../../lib/translations';
import { UserRole } from '../../../types';
import { LanguageSelector } from '../../../components/LanguageSelector';
import { Shield, Mail, Lock, Phone, User, CheckCircle2, Copy, Check, ExternalLink, AlertCircle } from 'lucide-react';

export const Register: React.FC = () => {
  const { register, language, user, onboardProfile, loginWithGoogle } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.PATIENT);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const t = translations[language];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGoogleRegister = () => {
    setError(null);
    startTransition(async () => {
      try {
        await loginWithGoogle();
      } catch (err: any) {
        setError(err?.message || 'Google Auth connection failed.');
      }
    });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || !phone) {
      setError('Please fill in your name and phone number.');
      return;
    }

    // Bangladesh mobile regex +8801... or 01...
    const bdPhoneRegex = /^(?:\+8801|01)[3-9]\d{8}$/;
    if (!bdPhoneRegex.test(phone)) {
      setError('Please enter a valid Bangladeshi mobile number (e.g., +88017XXXXXXXX or 017XXXXXXXX).');
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        if (user) {
          // If already authenticated via Google but missing a profile document
          await onboardProfile(displayName, phone, role);
        } else {
          if (!email || !password) {
            setError('Please supply an email and password for registration.');
            return;
          }
          if (password.length < 6) {
            setError('Password must contain at least 6 characters.');
            return;
          }
          await register(email, password, displayName, phone, role);
        }
        setSuccess(true);
      } catch (err: any) {
        if (err?.code === 'auth/email-already-in-use') {
          setError('This email address is already registered. Please go to Login.');
        } else if (err?.message) {
          setError(err.message);
        } else {
          setError('Form verification failed. Please try again.');
        }
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans" id="register-container">
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-50 rounded-full blur-3xl opacity-60 -mr-20 -mt-20 pointer-events-none" id="bg-glow-1"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-50 rounded-full blur-3xl opacity-60 -ml-20 -mb-20 pointer-events-none" id="bg-glow-2"></div>

      <div className="absolute top-6 right-6 z-10 flex items-center gap-4" id="top-bar-controls">
        <LanguageSelector />
        {!user && (
          <a
            href="/login"
            className="text-xs font-bold text-emerald-600 hover:text-emerald-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer"
            id="register-login-link"
          >
            Sign In Portal
          </a>
        )}
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10" id="register-header-group">
        <div className="flex justify-center items-center gap-2 mb-4" id="register-logo-lockup">
          <div className="bg-emerald-600 text-white p-2.5 rounded-xl shadow-lg shadow-emerald-600/25" id="brand-logo">
            <Shield className="h-6 w-6" />
          </div>
          <span className="text-2xl font-black tracking-tight text-slate-900" id="brand-label">
            {t.brandName}
          </span>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-slate-900 tracking-tight" id="register-title">
          {user ? 'Configure Security Credentials' : t.registerTitle}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 max-w-sm mx-auto" id="register-subtitle">
          {t.registerSubtitle}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10" id="register-form-card-wrapper">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-100 rounded-2xl border border-slate-100 sm:px-10" id="register-form-card">
          
          {success ? (
            <div className="text-center py-6 animate-fade-in" id="register-success-pane">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4" id="success-icon-wrapper">
                <CheckCircle2 className="h-10 w-10 animate-bounce" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1" id="success-title">{t.profileCreatedSuccess}</h3>
              <p className="text-sm text-slate-500 mb-6" id="success-desc">Synchronizing secure keys with healthcare portal...</p>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition duration-150 shadow-md shadow-slate-950/20"
                id="success-reload-btn"
              >
                Enter Health Portal
              </button>
            </div>
          ) : (
            <>
               {error && (
                (() => {
                  if (error.startsWith('unauthorized-domain|')) {
                    const targetDomain = error.split('|')[1] || window.location.hostname;
                    return (
                      <div className="mb-6 p-5 rounded-2xl bg-amber-50 border border-amber-200 text-slate-800 text-xs shadow-xs animate-fade-in" id="domain-authorization-alert-register">
                        <div className="flex gap-2.5 items-start">
                          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                          <div>
                            <strong className="block font-extrabold text-amber-900 text-sm">Firebase Domain Whitelist Required</strong>
                            <p className="mt-1.5 text-slate-600 leading-relaxed">
                              Your current development workspace domain needs to be whitelisted under the Authorized Domains section of your Firebase Authentication settings first.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 bg-white/80 p-3 rounded-xl border border-amber-200 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[10px] text-slate-500 uppercase tracking-wider">Active Domain ID</span>
                            <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider">Cloud Run URI</span>
                          </div>
                          <div className="flex items-center justify-between bg-slate-950 text-slate-200 font-mono text-[11px] p-2 rounded-lg gap-2">
                            <span className="truncate select-all text-xs font-semibold">{targetDomain}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(targetDomain)}
                              className="text-amber-400 hover:text-amber-300 font-bold px-2 py-0.5 rounded cursor-pointer transition flex items-center gap-1 shrink-0 bg-transparent border-0"
                              title="Copy domain to clipboard"
                            >
                              {copied ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2 text-slate-600">
                          <div className="flex gap-2 items-start font-medium text-[11px]">
                            <span className="bg-amber-600/10 text-amber-800 text-[10px] font-extrabold rounded-full px-1.5 py-0.5 leading-none shrink-0 border border-amber-300/30">1</span>
                            <span>Navigate to the <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-amber-800 font-extrabold hover:underline inline-flex items-center gap-0.5" id="fbase-console-link-reg">Firebase Console <ExternalLink className="h-3 w-3 inline" /></a></span>
                          </div>
                          <div className="flex gap-2 items-start font-medium text-[11px]">
                            <span className="bg-amber-600/10 text-amber-800 text-[10px] font-extrabold rounded-full px-1.5 py-0.5 leading-none shrink-0 border border-amber-300/30">2</span>
                            <span>Select Authentication &gt; Settings &gt; Authorized domains.</span>
                          </div>
                          <div className="flex gap-2 items-start font-medium text-[11px]">
                            <span className="bg-amber-600/10 text-amber-800 text-[10px] font-extrabold rounded-full px-1.5 py-0.5 leading-none shrink-0 border border-amber-300/30">3</span>
                            <span>Click "Add domain", paste the copied domain identity, and save.</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-3.5 border-t border-amber-200 text-center text-[10px] text-amber-800 font-bold uppercase tracking-wider">
                          ⚡ Action: Fill in the standard registration form above instead!
                        </div>
                      </div>
                    );
                  }

                  if (error.startsWith('popup-closed|')) {
                    const message = error.split('|')[1];
                    return (
                      <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-slate-800 text-xs shadow-xs animate-fade-in" id="popup-closed-alert-register">
                        <div className="flex gap-2.5 items-start">
                          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <strong className="block font-bold text-amber-900 text-sm">Sign-In Cancelled</strong>
                            <p className="mt-1 text-slate-600 leading-relaxed font-medium">
                              {message}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex gap-2.5 items-start animate-fade-in" id="register-error-alert">
                      <span className="h-5 w-5 shrink-0 mt-0.5 text-red-600 block" id="error-symbol">⚠️</span>
                      <div>
                        <strong className="block font-semibold">Validation Rejected</strong>
                        <p className="text-xs mt-0.5 opacity-90">{error}</p>
                      </div>
                    </div>
                  );
                })()
              )}

              <form className="space-y-5" onSubmit={handleRegister} id="register-form">
                <div>
                  <label htmlFor="displayName" className="block text-sm font-semibold text-slate-700 mb-1.5" id="label-name">
                    {t.displayNameLabel}
                  </label>
                  <div className="relative rounded-lg shadow-xs" id="name-input-wrapper">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="h-5 w-5" />
                    </div>
                    <input
                      id="displayName"
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition duration-150 text-sm"
                      placeholder={t.displayNamePlaceholder}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 mb-1.5" id="label-phone">
                    {t.phoneLabel}
                  </label>
                  <div className="relative rounded-lg shadow-xs" id="phone-input-wrapper">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone className="h-5 w-5" />
                    </div>
                    <input
                      id="phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition duration-150 text-sm"
                      placeholder={t.phonePlaceholder}
                    />
                  </div>
                </div>

                {!user && (
                  <>
                    <div>
                      <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5" id="label-email">
                        {t.emailLabel}
                      </label>
                      <div className="relative rounded-lg shadow-xs" id="email-input-wrapper">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Mail className="h-5 w-5" />
                        </div>
                        <input
                          id="email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="block w-full pl-10 pr-3 py-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition duration-150 text-sm"
                          placeholder={t.emailPlaceholder}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1.5" id="label-password">
                        {t.passwordLabel}
                      </label>
                      <div className="relative rounded-lg shadow-xs" id="password-input-wrapper">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Lock className="h-5 w-5" />
                        </div>
                        <input
                          id="password"
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="block w-full pl-10 pr-3 py-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition duration-150 text-sm"
                          placeholder={t.passwordPlaceholder}
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2" id="label-role">
                    {t.roleLabel}
                  </label>
                  <div className="grid grid-cols-2 gap-3" id="role-switches">
                    <button
                      type="button"
                      onClick={() => setRole(UserRole.PATIENT)}
                      className={`p-3 border rounded-xl text-center transition flex flex-col items-center justify-center cursor-pointer ${
                        role === UserRole.PATIENT
                          ? 'border-emerald-500 bg-emerald-50/30 text-emerald-800 ring-2 ring-emerald-500/10 font-bold'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-600 font-semibold'
                      }`}
                      id="choose-role-patient"
                    >
                      <span className="text-xl mb-1 block" id="patient-icon">🩺</span>
                      <span className="text-xs">{t.rolePatient}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole(UserRole.DOCTOR)}
                      className={`p-3 border rounded-xl text-center transition flex flex-col items-center justify-center cursor-pointer ${
                        role === UserRole.DOCTOR
                          ? 'border-emerald-500 bg-emerald-50/30 text-emerald-800 ring-2 ring-emerald-500/10 font-bold'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-600 font-semibold'
                      }`}
                      id="choose-role-doctor"
                    >
                      <span className="text-xl mb-1 block" id="doctor-icon">🥼</span>
                      <span className="text-xs">{t.roleDoctor}</span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition duration-150 shadow-md disabled:opacity-50 mt-4 cursor-pointer"
                  id="register-submit-button"
                >
                  {isPending ? t.verifying : t.registerSubmit}
                </button>
              </form>

              {!user && (
                <div className="mt-6" id="divider-zone-register">
                  <div className="relative" id="divider-underlay-register">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase" id="divider-text-wrapper-register">
                      <span className="bg-white px-3 text-slate-400 font-semibold tracking-wider">Alternative Registration</span>
                    </div>
                  </div>

                  <div className="mt-4" id="google-register-action">
                    <button
                      type="button"
                      onClick={handleGoogleRegister}
                      disabled={isPending}
                      className="w-full flex items-center justify-center gap-2.5 py-3 px-4 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-slate-300 transition duration-150 cursor-pointer shadow-xs"
                      id="google-register-button"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" id="google-icon-svg-register">
                        <path
                          fill="#EA4335"
                          d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.516 5.516 0 0 1 8.5 13a5.516 5.516 0 0 1 5.491-5.514c1.4 0 2.425.4 3.148.914l3.11-3.11C18.3 3.514 15.4 2.5 13.991 2.5c-5.8 0-10.5 4.7-10.5 10.5s4.7 10.5 10.5 10.5c5.5 0 10.5-4 10.5-10.5 0-.743-.07-1.486-.192-2.215H12.24Z"
                        />
                      </svg>
                      <span>Register with Google</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 text-center" id="login-navigation-prompt">
                <span className="text-xs text-slate-500">
                  {language === 'bn' ? 'ইতিমধ্যে অ্যাকাউন্ট আছে? ' : 'Already have an account? '}
                </span>
                <a
                  href="/login"
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-500 cursor-pointer transition"
                  id="goto-login-link"
                >
                  {language === 'bn' ? 'লগইন করুন' : 'Sign In'}
                </a>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};
