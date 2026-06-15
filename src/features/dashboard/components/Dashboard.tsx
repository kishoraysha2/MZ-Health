/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useTransition } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { translations } from '../../../lib/translations';
import { UserRole, AuditLog, UserProfile, OperationType } from '../../../types';
import { db, handleFirestoreError } from '../../../lib/firebase';
import { DoctorProfileEditor } from '../../../components/DoctorProfileEditor';
import { PatientProfileEditor } from '../../../components/PatientProfileEditor';
import { 
  getAllDoctors, 
  getAllPatients, 
  verifyDoctor, 
  setUserActiveStatus 
} from '../../../lib/services/profileService';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  doc, 
  updateDoc, 
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  ShieldAlert, 
  Settings2, 
  Lock, 
  FileText, 
  Users, 
  UserCheck, 
  LogOut, 
  Bell, 
  Database,
  RefreshCw,
  Search,
  Clock,
  Stethoscope,
  Heart,
  Calendar
} from 'lucide-react';
import { MdmWorkspace } from '../../mdm';
import SearchCenter from '../../search/components/SearchCenter';

export const Dashboard: React.FC = () => {
  const { 
    user, 
    profile, 
    settings, 
    language, 
    logout, 
    updateUserSettings,
    updateProfileDetails 
  } = useAuthStore();
  
  const t = translations[language];

  // Tab navigation states
  const [activeTab, setActiveTab] = useState<'profile' | 'settings' | 'audit' | 'admin' | 'search' | 'mdm'>('profile');
  const [adminSubTab, setAdminSubTab] = useState<'enrollment' | 'doctors' | 'patients'>('enrollment');
  const [allDoctors, setAllDoctors] = useState<any[]>([]);
  const [allPatients, setAllPatients] = useState<any[]>([]);

  // Doctor Catalog search states
  const [catalogList, setCatalogList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Input states
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [email, setEmail] = useState(profile?.email || '');
  
  // Settings values
  const [pushNotif, setPushNotif] = useState(settings?.pushNotificationsEnabled ?? true);
  const [emailNotif, setEmailNotif] = useState(settings?.emailNotificationsEnabled ?? true);
  const [smsNotif, setSmsNotif] = useState(settings?.smsNotificationsEnabled ?? true);
  const [highContrast, setHighContrast] = useState(settings?.accessibility?.highContrastMode ?? false);
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>(settings?.accessibility?.fontSizeScale ?? 'medium');

  // Admin Module states
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [logsList, setAuditLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalDoctors: 0, totalPatients: 0 });
  const [adminLoading, setAdminLoading] = useState(false);

  // General Notification Banners
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'danger' | null }>({ message: '', type: null });
  const [isPending, startTransition] = useTransition();

  // Load Settings states when hydrated
  useEffect(() => {
    if (settings) {
      setPushNotif(settings.pushNotificationsEnabled);
      setEmailNotif(settings.emailNotificationsEnabled);
      setSmsNotif(settings.smsNotificationsEnabled);
      setHighContrast(settings.accessibility.highContrastMode);
      setFontSize(settings.accessibility.fontSizeScale);
    }
  }, [settings]);

  const loadCatalogData = async () => {
    setCatalogLoading(true);
    try {
      const snap = await getDocs(collection(db, 'doctor_catalogs'));
      const list: any[] = [];
      snap.forEach((docSnap) => {
        list.push({
          doctorId: docSnap.id,
          ...docSnap.data()
        });
      });
      setCatalogList(list);
    } catch (err) {
      console.error('[MZ-HEALTH] Error loading doctor catalogs:', err);
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    loadCatalogData();
  }, []);

  // Read admin data query
  const loadAdminControlData = async () => {
    if (!profile || (profile.role !== UserRole.ADMIN && profile.role !== UserRole.SUPER_ADMIN)) return;
    
    setAdminLoading(true);
    setFeedback({ message: '', type: null });
    
    try {
      // 1. Read past 20 audit logs
      const logsQuery = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(20));
      const logsSnap = await getDocs(logsQuery);
      const fetchedLogs: AuditLog[] = [];
      logsSnap.forEach(docSnap => {
        const d = docSnap.data();
        fetchedLogs.push({
          logId: d.logId,
          actorId: d.actorId,
          actorRole: d.actorRole,
          actionType: d.actionType,
          resourceTarget: d.resourceTarget,
          resourceDocId: d.resourceDocId,
          ipAddress: d.ipAddress,
          userAgent: d.userAgent,
          timestamp: d.timestamp?.toDate ? d.timestamp.toDate().toLocaleTimeString() : String(d.timestamp)
        });
      });
      setAuditLogs(fetchedLogs);

      // 2. Read users to verify role states
      const usersSnap = await getDocs(collection(db, 'users'));
      const fetchedUsers: UserProfile[] = [];
      let docsCount = 0;
      let patientsCount = 0;
      
      usersSnap.forEach(docSnap => {
        const d = docSnap.data();
        const uProfile: UserProfile = {
          uid: d.uid,
          phoneNumber: d.phoneNumber,
          displayName: d.displayName,
          email: d.email,
          role: d.role as UserRole,
          isActive: d.isActive,
          languagePreference: d.languagePreference,
          createdAt: String(d.createdAt),
          updatedAt: String(d.updatedAt),
          lastLoginAt: String(d.lastLoginAt)
        };
        fetchedUsers.push(uProfile);
        
        if (uProfile.role === UserRole.DOCTOR) docsCount++;
        else if (uProfile.role === UserRole.PATIENT) patientsCount++;
      });
      
      setUsersList(fetchedUsers);

      // 3. Read doctor subprofiles list and patient subprofiles list for administrative evaluation
      const doctorsList = await getAllDoctors();
      const patientsList = await getAllPatients();
      setAllDoctors(doctorsList);
      setAllPatients(patientsList);

      setStats({
        totalUsers: fetchedUsers.length,
        totalDoctors: doctorsList.length,
        totalPatients: patientsList.length
      });
    } catch (err) {
      // Catch through custom clinical error logger
      try {
        handleFirestoreError(err, OperationType.LIST, 'audit_logs');
      } catch (wrappedErr: any) {
        setFeedback({ 
          message: `Access Denied: Missing read permissions from Security Rules.`, 
          type: 'danger' 
        });
      }
    } finally {
      setAdminLoading(false);
    }
  };

  // Trigger admin reload automatically when switching to the Admin View Tab
  useEffect(() => {
    if (activeTab === 'admin') {
      loadAdminControlData();
    }
  }, [activeTab]);

  // Saves settings preferences
  const handleSaveSettings = () => {
    startTransition(async () => {
      try {
        await updateUserSettings({
          pushNotificationsEnabled: pushNotif,
          emailNotificationsEnabled: emailNotif,
          smsNotificationsEnabled: smsNotif,
          accessibility: {
            highContrastMode: highContrast,
            fontSizeScale: fontSize
          }
        });

        // Track changes into the write-once audit collection
        if (profile) {
          const auditLogId = `log_${crypto.randomUUID()}`;
          const auditRef = doc(db, 'audit_logs', auditLogId);
          await setDoc(auditRef, {
            logId: auditLogId,
            actorId: profile.uid,
            actorRole: profile.role,
            actionType: 'UPDATE',
            resourceTarget: 'settings',
            resourceDocId: profile.uid,
            ipAddress: '127.0.0.1',
            userAgent: navigator.userAgent,
            timestamp: serverTimestamp()
          }).catch(e => console.log('Audit deferred:', e));
        }

        setFeedback({ message: t.settingSaved, type: 'success' });
      } catch (err) {
        setFeedback({ message: t.authError, type: 'danger' });
      }
    });
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateProfileDetails(displayName, email || undefined);
        setFeedback({ message: t.settingSaved, type: 'success' });
      } catch (err: any) {
        setFeedback({ message: err?.message || 'Update failed.', type: 'danger' });
      }
    });
  };

  // Admin soft-banning/toggling active states
  const toggleUserLockStatus = async (targetUserId: string, currentStatus: boolean) => {
    if (!profile) return;
    try {
      await setUserActiveStatus(targetUserId, !currentStatus, profile.uid, profile.role);
      
      setFeedback({ message: t.userBannedStatus, type: 'success' });
      loadAdminControlData();
    } catch (err) {
      setFeedback({ message: 'Authorization rejection: Only Super Admins can alter active accounts.', type: 'danger' });
    }
  };

  // Toggle Doctor Verification Status
  const handleToggleVerifyDoctor = async (doctorId: string, currentVerification: boolean) => {
    if (!profile) return;
    try {
      await verifyDoctor(doctorId, profile.uid, profile.role, !currentVerification);
      setFeedback({ message: 'Doctor practice verification updated successfully.', type: 'success' });
      loadAdminControlData();
    } catch (err) {
      setFeedback({ message: 'Failed to update doctor verification status.', type: 'danger' });
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 font-sans pb-16 ${highContrast ? 'contrast-125' : ''}`} id="dashboard-wrapper">
      {/* Upper Navigation Bar */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-40" id="portal-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center" id="header-inner">
          <div className="flex items-center gap-3" id="header-brand-lockup">
            <div className="bg-emerald-600 text-white p-2 rounded-lg" id="header-logo">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-slate-900 block leading-none">{t.brandName}</span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">{t.brandSubtitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-4" id="header-right-deck">
            {/* Display logged in name badge */}
            <div className="hidden md:flex flex-col text-right" id="user-details-badge">
              <span className="text-xs font-semibold text-slate-500">{t.welcomeBack},</span>
              <span className="text-sm font-bold text-slate-800">{profile?.displayName || user?.email}</span>
            </div>

            <div className="h-4 w-px bg-slate-200 hidden md:block"></div>

            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-500 bg-red-50 hover:bg-red-100/60 px-3 py-1.5 rounded-lg border border-red-200/50 transition cursor-pointer"
              id="header-logout-trigger"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{t.logoutButton}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Stage */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8" id="dashboard-main">
        
        {/* Banner Feedback system */}
        {feedback.message && (
          <div 
            className={`mb-6 p-4 rounded-xl border flex items-start gap-3 shadow-sm animate-slide-in ${
              feedback.type === 'success' 
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                : 'bg-red-50 border-red-100 text-red-800'
            }`}
            id="global-feedback-alert"
          >
            <span className="text-lg mt-0.5">{feedback.type === 'success' ? '✅' : '🔴'}</span>
            <div className="text-sm">
              <strong className="block font-bold">
                {feedback.type === 'success' ? 'Operation Success' : 'Security Warning / Operation Blocked'}
              </strong>
              <p className="mt-0.5 leading-normal opacity-90">{feedback.message}</p>
            </div>
          </div>
        )}

        {/* User Identity Blueprint Metadata Card */}
        <div className="bg-white rounded-2xl border border-slate-150 p-6 shadow-xs mb-8" id="profile-identity-card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6" id="identity-card-inner">
            <div className="flex gap-4 items-center" id="identity-details">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-2xl uppercase border border-emerald-100 shadow-sm" id="large-avatar">
                {profile?.displayName?.charAt(0) || 'U'}
              </div>
              <div id="identity-metadata">
                <div className="flex flex-wrap items-center gap-2" id="identity-roles-row">
                  <h1 className="text-xl font-extrabold text-slate-900">{profile?.displayName}</h1>
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-100/80 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {profile?.role}
                  </span>
                  {profile?.isActive ? (
                    <span className="bg-sky-50 text-sky-800 border border-sky-100/80 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {t.activeStatus}
                    </span>
                  ) : (
                    <span className="bg-red-50 text-red-800 border border-red-100 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {t.inactiveStatus}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1 font-mono" id="metadata-uid-string">
                  {t.userIdLabel}: <span className="font-semibold text-slate-600">{profile?.uid || user?.uid}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-start md:justify-end" id="tab-navigation-triggers">
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  activeTab === 'profile'
                    ? 'bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-950/10'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                id="tab-trigger-profile"
              >
                Profile Form
              </button>
              
              <button
                onClick={() => {
                  setActiveTab('search');
                  setSearchQuery('');
                  loadCatalogData();
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'search'
                    ? 'bg-sky-600 border-sky-600 text-white shadow-md shadow-sky-600/15'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                id="tab-trigger-doctor-directory"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Doctor Search Directory</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-950/10'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                id="tab-trigger-settings"
              >
                Settings Preferences
              </button>

              {(profile?.role === UserRole.ADMIN || profile?.role === UserRole.SUPER_ADMIN) && (
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1 cursor-pointer ${
                    activeTab === 'admin'
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-700/15'
                      : 'bg-white border-emerald-100 text-emerald-700 hover:bg-emerald-50/20'
                  }`}
                  id="tab-trigger-admin-console"
                >
                  <Database className="h-3.5 w-3.5" />
                  <span>Admin Console</span>
                </button>
              )}

              {(profile?.role === UserRole.ADMIN || profile?.role === UserRole.SUPER_ADMIN) && (
                <button
                  onClick={() => setActiveTab('mdm')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'mdm'
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-700/15'
                      : 'bg-white border-indigo-105 text-indigo-700 hover:bg-indigo-50/20'
                  }`}
                  id="tab-trigger-mdm-workspace"
                >
                  <Database className="h-3.5 w-3.5" />
                  <span>MDM Workspace</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Grid Layout container */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="dashboard-grid-box">
          
          {/* LEFT 3 COLUMNS: Tab Content Panel (expanded to full width) */}
          <div className="lg:col-span-3 space-y-6" id="dashboard-left-deck">
            
            {/* TAB 1: Profile Editing View */}
            {activeTab === 'profile' && (
              <div id="tab-pane-profile" className="space-y-6">
                {profile?.role === UserRole.DOCTOR ? (
                  <DoctorProfileEditor />
                ) : profile?.role === UserRole.PATIENT ? (
                  <PatientProfileEditor />
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-6" id="pane-profile-header">
                      <UserCheck className="h-5 w-5 text-emerald-600" />
                      <h2 className="text-lg font-extrabold text-slate-900">{t.userProfileTitle}</h2>
                    </div>

                    <form className="space-y-5" onSubmit={handleUpdateProfile} id="profile-edit-form">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="profile-edit-inputs">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2" htmlFor="prof-name">
                            {t.displayNameLabel}
                          </label>
                          <input
                            id="prof-name"
                            type="text"
                            required
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="block w-full px-3 py-2 border border-slate-200 bg-slate-50/20 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2" htmlFor="prof-email">
                            {t.emailLabel}
                          </label>
                          <input
                            id="prof-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="block w-full px-3 py-2 border border-slate-200 bg-slate-50/20 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                            placeholder="Not Provided"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2" htmlFor="prof-phone">
                            {t.phoneNumber}
                          </label>
                          <input
                            id="prof-phone"
                            type="text"
                            disabled
                            value={profile?.phoneNumber || ''}
                            className="block w-full px-3 py-2 border border-slate-200 bg-slate-100 rounded-xl text-slate-500 text-sm cursor-not-allowed font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2" htmlFor="prof-date">
                            {t.createdAt}
                          </label>
                          <input
                            id="prof-date"
                            type="text"
                            disabled
                            value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : ''}
                            className="block w-full px-3 py-2 border border-slate-200 bg-slate-100 rounded-xl text-slate-500 text-sm cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-4 border-t border-slate-100" id="profile-edit-actions">
                        <button
                          type="submit"
                          disabled={isPending}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition shadow-md shadow-emerald-600/10 cursor-pointer"
                          id="save-profile-trigger"
                        >
                          {isPending ? t.verifying : t.saveSettings}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Settings Configuration View */}
            {activeTab === 'settings' && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6" id="tab-pane-settings">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-6" id="pane-settings-header">
                  <Settings2 className="h-5 w-5 text-emerald-600" />
                  <h2 className="text-lg font-extrabold text-slate-900">{t.settingsTitle}</h2>
                </div>

                <div className="space-y-6" id="settings-switches">
                  {/* SMS notifications switch */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 border border-slate-100 hover:bg-slate-50 transition" id="switch-sms">
                    <div>
                      <strong className="text-sm font-bold text-slate-900 block">{t.notifSms}</strong>
                      <span className="text-xs text-slate-400">Dispatch clinical alerts via local BD SMS hubs</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={smsNotif} 
                        onChange={(e) => setSmsNotif(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {/* Email Notifications switch */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 border border-slate-100 hover:bg-slate-50 transition" id="switch-email">
                    <div>
                      <strong className="text-sm font-bold text-slate-900 block">{t.notifEmail}</strong>
                      <span className="text-xs text-slate-400">Receive weekly diagnostic and laboratory updates</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={emailNotif} 
                        onChange={(e) => setEmailNotif(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {/* Push Notifications Switch */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 border border-slate-100 hover:bg-slate-50 transition" id="switch-push">
                    <div>
                      <strong className="text-sm font-bold text-slate-900 block">{t.notifPush}</strong>
                      <span className="text-xs text-slate-400">Instant browser and push message reminders</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={pushNotif} 
                        onChange={(e) => setPushNotif(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {/* High Contrast accessibility switch */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 border border-slate-100 hover:bg-slate-50 transition" id="switch-contrast">
                    <div>
                      <strong className="text-sm font-bold text-slate-900 block">{t.highContrast}</strong>
                      <span className="text-xs text-slate-400">Increase color intensity for visibility assistance</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={highContrast} 
                        onChange={(e) => setHighContrast(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {/* Font scale options */}
                  <div className="p-4 rounded-xl bg-slate-50/50 border border-slate-100" id="scale-font-deck">
                    <strong className="text-sm font-bold text-slate-900 block mb-3">{t.fontSize}</strong>
                    <div className="grid grid-cols-3 gap-2" id="font-scale-toggles">
                      {(['small', 'medium', 'large'] as const).map(scale => (
                        <button
                          key={scale}
                          onClick={() => setFontSize(scale)}
                          className={`py-2 text-xs font-bold rounded-lg border transition cursor-pointer capitalize ${
                            fontSize === scale
                              ? 'border-emerald-600 bg-emerald-50/30 text-emerald-800'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                          id={`scale-trigger-${scale}`}
                        >
                          {t[scale as 'small' | 'medium' | 'large']}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 mt-6 border-t border-slate-100" id="settings-edit-actions">
                  <div className="flex items-center gap-2" id="lang-selector-col">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Portal Language :</span>
                    {/* Expose language selector */}
                    <button
                      onClick={() => useAuthStore.getState().setLanguage(language === 'en' ? 'bn' : 'en')}
                      className="px-3 py-1.5 text-xs font-bold bg-slate-100 border border-slate-200 text-slate-800 hover:bg-slate-200 rounded-lg transition"
                      id="settings-lang-swapper"
                    >
                      {language === 'en' ? 'বাংলা' : 'English'}
                    </button>
                  </div>
                  <button
                    onClick={handleSaveSettings}
                    disabled={isPending}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition shadow-md cursor-pointer"
                    id="save-settings-trigger"
                  >
                    {isPending ? t.verifying : t.saveSettings}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'search' && (
              <div className="bg-white rounded-2xl border border-slate-150 shadow-xs p-6 animate-fade-in" id="tab-pane-search">
                <SearchCenter onBack={() => setActiveTab('profile')} />
              </div>
            )}

            {/* TAB 3: Admin Console & Database Visual Query (Conditional for Admin user roles) */}
            {activeTab === 'admin' && (profile?.role === UserRole.ADMIN || profile?.role === UserRole.SUPER_ADMIN) && (
              <div className="space-y-6" id="tab-pane-admin-console">
                
                {/* Statistics banner row */}
                <div className="grid grid-cols-3 gap-4" id="stats-banner-row">
                  <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-xs" id="stat-card-total-users">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t.totalUsersCount}</span>
                    <strong className="text-2xl font-black text-slate-900">{stats.totalUsers}</strong>
                  </div>

                  <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-xs" id="stat-card-total-doctors">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t.totalDoctorsCount}</span>
                    <strong className="text-2xl font-black text-emerald-600">{stats.totalDoctors}</strong>
                  </div>

                  <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-xs" id="stat-card-total-patients">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t.totalPatientsCount}</span>
                    <strong className="text-2xl font-black text-blue-600">{stats.totalPatients}</strong>
                  </div>
                </div>

                {/* Aesthetic subtab bar selector */}
                <div className="flex border-b border-slate-200 gap-2 bg-white rounded-xl p-1 border overflow-hidden" id="admin-subtabs-row">
                  <button
                    onClick={() => setAdminSubTab('enrollment')}
                    className={`flex-1 py-2 text-center text-xs font-bold transition-all rounded-lg cursor-pointer ${
                      adminSubTab === 'enrollment'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    Enrollment Registry & Audits
                  </button>
                  <button
                    onClick={() => setAdminSubTab('doctors')}
                    className={`flex-1 py-2 text-center text-xs font-bold transition-all rounded-lg cursor-pointer ${
                      adminSubTab === 'doctors'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    Verify Doctor Credentials ({allDoctors.filter(d => !d.bmdcVerified).length} Pending)
                  </button>
                  <button
                    onClick={() => setAdminSubTab('patients')}
                    className={`flex-1 py-2 text-center text-xs font-bold transition-all rounded-lg cursor-pointer ${
                      adminSubTab === 'patients'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    Patient Profiles Directory
                  </button>
                </div>

                {/* Sub Tab Panel 1: Original Registries & Audits */}
                {adminSubTab === 'enrollment' && (
                  <>
                    {/* Profile registries & soft bannings panel */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6" id="admin-doc-registries-deck">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4" id="registries-header-block">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-emerald-600" />
                          <h3 className="text-base font-extrabold text-slate-900">User Enrollment Registry</h3>
                        </div>
                        <button
                          onClick={loadAdminControlData}
                          disabled={adminLoading}
                          className="text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1.5 p-1 border border-slate-200 rounded-lg hover:bg-slate-50"
                          id="reload-registries-button"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${adminLoading ? 'animate-spin' : ''}`} />
                        </button>
                      </div>

                      {adminLoading ? (
                        <div className="py-12 flex justify-center text-slate-400 text-sm animate-pulse" id="registries-loader">Syncing directories...</div>
                      ) : (
                        <div className="overflow-x-auto" id="registries-table-box">
                          <table className="w-full text-left border-collapse text-sm" id="registries-table">
                            <thead id="registries-thead">
                              <tr className="border-b border-slate-100 text-slate-400 font-semibold" id="registries-thead-row">
                                <th className="pb-3 text-xs uppercase tracking-wider">DisplayName</th>
                                <th className="pb-3 text-xs uppercase tracking-wider">Role</th>
                                <th className="pb-3 text-xs uppercase tracking-wider">Verified Contact</th>
                                <th className="pb-3 text-xs uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody id="registries-tbody">
                              {usersList.map(u => (
                                <tr key={u.uid} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors" id={`row-user-${u.uid}`}>
                                  <td className="py-3 font-semibold text-slate-800">{u.displayName}</td>
                                  <td className="py-3">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                      u.role === UserRole.DOCTOR ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                                    }`}>
                                      {u.role}
                                    </span>
                                  </td>
                                  <td className="py-3 font-mono text-xs text-slate-500">{u.phoneNumber}</td>
                                  <td className="py-3">
                                    <button
                                      onClick={() => toggleUserLockStatus(u.uid, u.isActive)}
                                      className={`text-xs font-bold px-3 py-1 rounded-lg transition border cursor-pointer ${
                                        u.isActive 
                                          ? 'border-orange-100/60 bg-orange-50 text-orange-700 hover:bg-orange-100/50' 
                                          : 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/50'
                                      }`}
                                    >
                                      {u.isActive ? 'Block Access' : 'Reactivate'}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Audit collection audit ledger view */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6" id="admin-audit-logs-deck">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4" id="ledger-header-block">
                        <FileText className="h-5 w-5 text-emerald-600" />
                        <h3 className="text-base font-extrabold text-slate-900">{t.auditLogsTitle}</h3>
                      </div>

                      {adminLoading ? (
                        <div className="py-12 flex justify-center text-slate-400 text-sm animate-pulse" id="ledger-loader">Syncing directories...</div>
                      ) : (
                        <div className="overflow-x-auto font-mono text-xs" id="ledger-table-box">
                          <table className="w-full text-left border-collapse" id="ledger-table">
                            <thead id="ledger-thead">
                              <tr className="border-b border-slate-150 text-slate-400 font-bold" id="ledger-thead-row">
                                <th className="pb-3 uppercase tracking-wider">Timestamp</th>
                                <th className="pb-3 uppercase tracking-wider">{t.auditActor}</th>
                                <th className="pb-3 uppercase tracking-wider">{t.auditAction}</th>
                                <th className="pb-3 uppercase tracking-wider">{t.auditTarget}</th>
                                <th className="pb-3 uppercase tracking-wider">IP / Client Agent</th>
                              </tr>
                            </thead>
                            <tbody id="ledger-tbody">
                              {logsList.map((log, index) => (
                                <tr key={log.logId || index} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors" id={`row-log-${index}`}>
                                  <td className="py-2.5 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                                  <td className="py-2.5 font-bold text-slate-700">
                                    {log.actorId.slice(0, 6)}...
                                    <span className="ml-1 px-1 bg-slate-100 text-[10px] text-slate-500 rounded uppercase font-semibold">
                                      {log.actorRole}
                                    </span>
                                  </td>
                                  <td className="py-2.5">
                                    <span className={`font-black uppercase tracking-wider text-[10px] ${
                                      log.actionType === 'CREATE' ? 'text-blue-600' : log.actionType === 'UPDATE' ? 'text-amber-600' : 'text-slate-600'
                                    }`}>
                                      {log.actionType}
                                    </span>
                                  </td>
                                  <td className="py-2.5 font-bold text-slate-800">
                                    {log.resourceTarget}/{log.resourceDocId.slice(0, 5)}...
                                  </td>
                                  <td className="py-2.5 text-slate-400 truncate max-w-xs" title={log.userAgent}>
                                    {log.ipAddress} | {log.userAgent.slice(0, 30)}...
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Sub Tab Panel 2: Verify Doctor Credentials */}
                {adminSubTab === 'doctors' && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6" id="admin-doctors-eval-deck">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Stethoscope className="h-5 w-5 text-emerald-600" />
                        <h3 className="text-base font-extrabold text-slate-900">Clinician Regulatory Verification Drawer</h3>
                      </div>
                      <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-full uppercase">
                        {allDoctors.length} Registered
                      </span>
                    </div>

                    {allDoctors.length === 0 ? (
                      <p className="p-8 text-center text-slate-400 text-xs">No doctor profiles found inside the active directories.</p>
                    ) : (
                      <div className="overflow-x-auto text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
                              <th className="pb-3 text-left">Doctor UID / Hospital</th>
                              <th className="pb-3 text-left">BMDC Reg Code</th>
                              <th className="pb-3 text-left">NID Number</th>
                              <th className="pb-3 text-left">Qualifications</th>
                              <th className="pb-3 text-left">Chambers</th>
                              <th className="pb-3 text-left">Status</th>
                              <th className="pb-3 text-left">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allDoctors.map(doc => {
                              const matchingUser = usersList.find(u => u.uid === doc.doctorId);
                              return (
                                <tr key={doc.doctorId} className="border-b last:border-0 hover:bg-slate-50/50">
                                  <td className="py-3">
                                    <strong className="block text-slate-800 text-sm">{matchingUser?.displayName || 'Unknown Doctor'}</strong>
                                    <span className="text-[10px] text-slate-400 font-mono italic">{doc.currentWorkplace || 'No Hospital Affiliated'}</span>
                                  </td>
                                  <td className="py-3 font-mono font-bold text-slate-700">{doc.bmdcRegNumber || 'Awaiting'}</td>
                                  <td className="py-3 font-mono text-slate-500">{doc.nationalId || 'N/A'}</td>
                                  <td className="py-3 max-w-xs truncate" title={doc.qualifications?.join(', ')}>
                                    {doc.qualifications?.join(', ') || 'N/A'}
                                  </td>
                                  <td className="py-3">
                                    <span className="font-bold bg-slate-100 text-slate-705 px-2 py-0.5 rounded-full">
                                      {doc.chambers?.length || 0} chambers
                                    </span>
                                  </td>
                                  <td className="py-3">
                                    {doc.bmdcVerified ? (
                                      <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">LIVE APPROVED</span>
                                    ) : (
                                      <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full animate-pulse">PENDING AUDIT</span>
                                    )}
                                  </td>
                                  <td className="py-3">
                                    <button
                                      onClick={() => handleToggleVerifyDoctor(doc.doctorId, doc.bmdcVerified)}
                                      className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg border transition cursor-pointer ${
                                        doc.bmdcVerified
                                          ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100/50'
                                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/50'
                                      }`}
                                    >
                                      {doc.bmdcVerified ? 'Revoke License' : 'Verify Practice'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub Tab Panel 3: Patient Directory */}
                {adminSubTab === 'patients' && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6" id="admin-patients-eval-deck">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Heart className="h-5 w-5 text-emerald-600" />
                        <h3 className="text-base font-extrabold text-slate-900">Patient Profiles Medical Records Directory</h3>
                      </div>
                      <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-full uppercase">
                        {allPatients.length} Active Files
                      </span>
                    </div>

                    {allPatients.length === 0 ? (
                      <p className="p-8 text-center text-slate-400 text-xs">No patient health profiles initialized yet.</p>
                    ) : (
                      <div className="overflow-x-auto text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
                              <th className="pb-3 text-left">Patient Demographics</th>
                              <th className="pb-3 text-left">Blood / DOB</th>
                              <th className="pb-3 text-left">Emergency Contact</th>
                              <th className="pb-3 text-left">Physiology (Height / Weight)</th>
                              <th className="pb-3 text-left">Allergies / Meds</th>
                              <th className="pb-3 text-left">System Account Status</th>
                              <th className="pb-3 text-left">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allPatients.map(pat => {
                              const matchingUser = usersList.find(u => u.uid === pat.patientId);
                              const calculatedAge = () => {
                                if (!pat.dateOfBirth) return 0;
                                const birthDate = new Date(pat.dateOfBirth);
                                if (isNaN(birthDate.getTime())) return 0;
                                const difference = Date.now() - birthDate.getTime();
                                const ageDate = new Date(difference);
                                return Math.abs(ageDate.getUTCFullYear() - 1970);
                              };
                              return (
                                <tr key={pat.patientId} className="border-b last:border-0 hover:bg-slate-50/50">
                                  <td className="py-3">
                                    <strong className="block text-slate-800 text-sm">{matchingUser?.displayName || 'Unknown Patient'}</strong>
                                    <span className="text-[10px] text-slate-400 font-mono">{pat.patientId.slice(0, 8)}...</span>
                                  </td>
                                  <td className="py-3">
                                    <strong className="block text-red-600 text-xs">{pat.bloodGroup || 'N/A'}</strong>
                                    <span className="text-[10px] text-slate-400">{pat.dateOfBirth || 'N/A'} ({calculatedAge()} yrs)</span>
                                  </td>
                                  <td className="py-3">
                                    {pat.emergencyContact ? (
                                      <div className="space-y-0.5">
                                        <span className="block font-semibold text-slate-700">{pat.emergencyContact.name} ({pat.emergencyContact.relationship})</span>
                                        <span className="block font-mono text-[10px] text-slate-400">{pat.emergencyContact.phoneNumber}</span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 italic">No Emergency Contact</span>
                                    )}
                                  </td>
                                  <td className="py-3">
                                    <span className="block text-slate-700">{pat.heightCm} cm / {pat.weightKg} kg</span>
                                    {pat.heightCm > 0 && (
                                      <span className="block text-[10px] text-slate-400">Calculated BMI: {(pat.weightKg / ((pat.heightCm / 100) * (pat.heightCm / 100))).toFixed(1)}</span>
                                    )}
                                  </td>
                                  <td className="py-3">
                                    <div className="space-y-1 max-w-xs">
                                      {pat.allergies?.length > 0 && (
                                        <div className="flex flex-wrap gap-0.5">
                                          <span className="text-[9px] font-bold text-slate-400 uppercase mr-1">Allergies:</span>
                                          {pat.allergies.map(a => <span key={a} className="bg-amber-50 text-amber-800 px-1 rounded text-[8px] border border-amber-100">{a}</span>)}
                                        </div>
                                      )}
                                      {pat.currentMedications?.length > 0 && (
                                        <div className="flex flex-wrap gap-0.5">
                                          <span className="text-[9px] font-bold text-slate-400 uppercase mr-1">Meds:</span>
                                          {pat.currentMedications.map(m => <span key={m} className="bg-purple-50 text-purple-800 px-1 rounded text-[8px] border border-purple-100">{m}</span>)}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3">
                                    {matchingUser?.isActive ? (
                                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 font-bold px-2 py-0.5 rounded-full uppercase text-[10px]">ACTIVE FILE</span>
                                    ) : (
                                      <span className="bg-red-50 text-red-800 border border-red-100 font-bold px-2 py-0.5 rounded-full uppercase text-[10px]">SUSPENDED</span>
                                    )}
                                  </td>
                                  <td className="py-3">
                                    <button
                                      onClick={() => toggleUserLockStatus(pat.patientId, matchingUser ? matchingUser.isActive : true)}
                                      className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg border transition cursor-pointer ${
                                        matchingUser?.isActive
                                          ? 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100/50'
                                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/50'
                                      }`}
                                    >
                                      {matchingUser?.isActive ? 'Block access' : 'Reactivate'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

            {activeTab === 'mdm' && (profile?.role === UserRole.ADMIN || profile?.role === UserRole.SUPER_ADMIN) && (
              <div id="tab-pane-mdm-portal">
                <MdmWorkspace />
              </div>
            )}

          </div>



        </div>

      </main>

    </div>
  );
};
