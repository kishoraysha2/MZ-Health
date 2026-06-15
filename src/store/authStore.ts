/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { UserProfile, UserSettings, UserRole, OperationType } from '../types';
import { auth, db, handleFirestoreError } from '../lib/firebase';
import { saveDoctorProfile, savePatientProfile } from '../lib/services/profileService';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  onSnapshot 
} from 'firebase/firestore';

let profileUnsubscribe: (() => void) | null = null;
let settingsUnsubscribe: (() => void) | null = null;
let activeAuthUnsubscribe: (() => void) | null = null;

const cleanupListeners = () => {
  if (profileUnsubscribe) {
    profileUnsubscribe();
    profileUnsubscribe = null;
  }
  if (settingsUnsubscribe) {
    settingsUnsubscribe();
    settingsUnsubscribe = null;
  }
};

interface AuthState {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  settings: UserSettings | null;
  language: 'bn' | 'en';
  loading: boolean;
  initialized: boolean;
  
  // Translation Helper
  setLanguage: (lang: 'bn' | 'en') => void;
  
  // Authentication Actions
  onboardProfile: (displayName: string, phone: string, role: UserRole) => Promise<UserProfile>;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, displayName: string, phone: string, role: UserRole) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  
  // Profile & Settings Mutations
  updateUserSettings: (settings: Partial<UserSettings>) => Promise<void>;
  updateProfileDetails: (displayName: string, email?: string) => Promise<void>;
  
  // Initialization hook
  initialize: () => () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  settings: null,
  language: (localStorage.getItem('mz_lang') as 'bn' | 'en') || 'bn',
  loading: true,
  initialized: false,

  setLanguage: (lang) => {
    localStorage.setItem('mz_lang', lang);
    set({ language: lang });
    
    // Attempt to persist local settings language dynamically if profile exists
    const currentProfile = get().profile;
    if (currentProfile) {
      const userRef = doc(db, 'users', currentProfile.uid);
      updateDoc(userRef, { 
        languagePreference: lang,
        updatedAt: new Date().toISOString()
      }).catch(err => {
        console.warn('[MZ-HEALTH] Optional language persistence deferred:', err);
      });
    }
  },

  onboardProfile: async (displayName, phone, role) => {
    const activeUser = auth.currentUser;
    if (!activeUser) throw new Error('No active authentication session found.');

    const userProfile: UserProfile = {
      uid: activeUser.uid,
      phoneNumber: phone,
      email: activeUser.email || undefined,
      displayName,
      role,
      isActive: true,
      languagePreference: get().language,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    const userRef = doc(db, 'users', activeUser.uid);
    try {
      await setDoc(userRef, {
        ...userProfile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${activeUser.uid}`);
    }

    // Initialize corresponding blank Settings profile
    const settingsDoc: UserSettings = {
      userId: activeUser.uid,
      pushNotificationsEnabled: true,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: true,
      accessibility: {
        highContrastMode: false,
        fontSizeScale: 'medium'
      },
      updatedAt: new Date().toISOString()
    };

    const settingsRef = doc(db, 'settings', activeUser.uid);
    try {
      await setDoc(settingsRef, settingsDoc);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `settings/${activeUser.uid}`);
    }

    // Initialize blank Doctor or Patient Subprofile
    try {
      if (role === UserRole.DOCTOR) {
        await saveDoctorProfile(activeUser.uid, { doctorId: activeUser.uid }, activeUser.uid, role, true);
      } else if (role === UserRole.PATIENT) {
        await savePatientProfile(activeUser.uid, { patientId: activeUser.uid }, activeUser.uid, role, true);
      }
    } catch (err) {
      console.error('[MZ-HEALTH] Onboard sub-profile registration failed:', err);
    }

    // Append security record dynamically to audit log
    const auditLogId = `log_${crypto.randomUUID()}`;
    const auditRef = doc(db, 'audit_logs', auditLogId);
    try {
      await setDoc(auditRef, {
        logId: auditLogId,
        actorId: activeUser.uid,
        actorRole: role,
        actionType: 'CREATE',
        resourceTarget: 'users',
        resourceDocId: activeUser.uid,
        ipAddress: '127.0.0.1', // mock client ip wrapper
        userAgent: navigator.userAgent,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error('[MZ-HEALTH] Audit log logging skipped on signup:', err);
    }

    set({ profile: userProfile, settings: settingsDoc });
    return userProfile;
  },

  login: async (email, pass) => {
    set({ loading: true });
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } finally {
      set({ loading: false });
    }
  },

  register: async (email, pass, displayName, phone, role) => {
    set({ loading: true });
    try {
      const credentials = await createUserWithEmailAndPassword(auth, email, pass);
      
      // Build profile
      const userProfile: UserProfile = {
        uid: credentials.user.uid,
        phoneNumber: phone,
        email,
        displayName,
        role,
        isActive: true,
        languagePreference: get().language,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };

      const userRef = doc(db, 'users', credentials.user.uid);
      await setDoc(userRef, {
        ...userProfile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      });

      // Settings setup
      const settingsDoc: UserSettings = {
        userId: credentials.user.uid,
        pushNotificationsEnabled: true,
        emailNotificationsEnabled: true,
        smsNotificationsEnabled: true,
        accessibility: {
          highContrastMode: false,
          fontSizeScale: 'medium'
        },
        updatedAt: new Date().toISOString()
      };
      const settingsRef = doc(db, 'settings', credentials.user.uid);
      await setDoc(settingsRef, settingsDoc);

      // Initialize blank Doctor or Patient Subprofile
      try {
        if (role === UserRole.DOCTOR) {
          await saveDoctorProfile(credentials.user.uid, { doctorId: credentials.user.uid }, credentials.user.uid, role, true);
        } else if (role === UserRole.PATIENT) {
          await savePatientProfile(credentials.user.uid, { patientId: credentials.user.uid }, credentials.user.uid, role, true);
        }
      } catch (err) {
        console.error('[MZ-HEALTH] Sub-profile initialization failed:', err);
      }

      // Audit profile
      const auditLogId = `log_${crypto.randomUUID()}`;
      const auditRef = doc(db, 'audit_logs', auditLogId);
      await setDoc(auditRef, {
        logId: auditLogId,
        actorId: credentials.user.uid,
        actorRole: role,
        actionType: 'CREATE',
        resourceTarget: 'users',
        resourceDocId: credentials.user.uid,
        ipAddress: '127.0.0.1',
        userAgent: navigator.userAgent,
        timestamp: serverTimestamp()
      });

      set({ user: credentials.user, profile: userProfile, settings: settingsDoc });
    } catch (err) {
      console.error('[MZ-HEALTH][REGISTRATION-ERROR]', err);
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  loginWithGoogle: async () => {
    set({ loading: true });
    try {
       const provider = new GoogleAuthProvider();
       // Google Auth login
       const result = await signInWithPopup(auth, provider);
       set({ user: result.user });
    } catch (err: any) {
       // Check for Firebase unauthorized-domain error first
       if (err?.code === 'auth/unauthorized-domain' || (err?.message && err.message.includes('unauthorized-domain'))) {
         console.warn('[MZ-HEALTH][GOOGLE-AUTH-DOMAIN-UNAUTHORIZED] Domain requires whitelisting:', err);
         const hostname = typeof window !== 'undefined' ? window.location.hostname : 'your-domain';
         const customErr = new Error(`unauthorized-domain|${hostname}`);
         throw customErr;
       }
       // Check for User Closed Popup or Cancelled Popup Request
       if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request' || (err?.message && (err.message.includes('popup-closed-by-user') || err.message.includes('cancelled-popup-request')))) {
         console.warn('[MZ-HEALTH][GOOGLE-AUTH-POPUP-CLOSED] User closed the auth popup box helper gracefully.');
         const customErr = new Error('popup-closed|The sign-in window was closed or cancelled before completion. Please try clicking the button again.');
         throw customErr;
       }
       
       // Log genuinely unexpected errors as critical
       console.error('[MZ-HEALTH][GOOGLE-AUTH-ERROR]', err);
       throw err;
    } finally {
       set({ loading: false });
    }
  },

  logout: async () => {
    set({ loading: true });

    // 5. Timeout safeguard (5 seconds)
    const timeoutId = setTimeout(() => {
      console.warn('[MZ-HEALTH-RBAC] Logout sequence timed out. Forcing clean local state & redirection.');
      cleanupListeners();
      set({ 
        user: null, 
        profile: null, 
        settings: null, 
        loading: false, 
        initialized: true 
      });
      window.location.href = '/login';
    }, 5000);

    try {
      // Prior to sign out, log access release
      const activeUser = auth.currentUser;
      const activeProfile = get().profile;
      if (activeUser && activeProfile) {
        const auditLogId = `log_${crypto.randomUUID()}`;
        const auditRef = doc(db, 'audit_logs', auditLogId);
        await setDoc(auditRef, {
          logId: auditLogId,
          actorId: activeUser.uid,
          actorRole: activeProfile.role,
          actionType: 'LOGOUT',
          resourceTarget: 'users',
          resourceDocId: activeUser.uid,
          ipAddress: '127.0.0.1',
          userAgent: navigator.userAgent,
          timestamp: serverTimestamp()
        }).catch((err) => {
          console.warn('[MZ-HEALTH] Optional audit logging for LOGOUT failed, proceeding anyway:', err);
        });
      }
      
      cleanupListeners();
      
      // Execute standard Firebase native registration release
      await firebaseSignOut(auth);
      
      // Clear Zustand state completely during logout to ensure no cached profile/role remains
      set({ 
        user: null, 
        profile: null, 
        settings: null, 
        loading: false, 
        initialized: true 
      });
      console.log('[MZ-HEALTH] Auth Zustand state cleared completely during logout.');
      
      // Clear any remaining timeout safeguard
      clearTimeout(timeoutId);

      // Programmatic route redirection mechanism
      window.location.href = '/login';
    } catch (err) {
      console.error('[MZ-HEALTH-RBAC] Unexpected failure in secure logout sequence:', err);
      // Ensure local state is completely reset and redirected regardless of Firebase network state
      cleanupListeners();
      set({ 
        user: null, 
        profile: null, 
        settings: null, 
        loading: false, 
        initialized: true 
      });
      clearTimeout(timeoutId);
      window.location.href = '/login';
    } finally {
      set({ loading: false });
    }
  },

  updateUserSettings: async (updatedFields) => {
    const activeProfile = get().profile;
    if (!activeProfile) throw new Error('Unauthenticated modification attempt.');

    const currentSettings = get().settings;
    if (!currentSettings) throw new Error('UserSettings document not synchronized.');

    const settingsRef = doc(db, 'settings', activeProfile.uid);
    try {
      await updateDoc(settingsRef, {
        ...updatedFields,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `settings/${activeProfile.uid}`);
    }
  },

  updateProfileDetails: async (displayName, email) => {
    const activeProfile = get().profile;
    if (!activeProfile) throw new Error('Unauthenticated profile update.');

    const userRef = doc(db, 'users', activeProfile.uid);
    try {
      await updateDoc(userRef, {
        displayName,
        ...(email !== undefined ? { email } : {}),
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${activeProfile.uid}`);
    }
  },

  initialize: () => {
    if (activeAuthUnsubscribe) {
      console.log('[MZ-HEALTH-RBAC] Auth listener already active. Reusing subscriber reference.');
      return activeAuthUnsubscribe;
    }

    const currentUnsubscribe = onAuthStateChanged(auth, async (authUser) => {
      cleanupListeners();

      if (authUser) {
        // Clear old profile / settings data from Zustand store to avoid loading cached values
        set({ user: authUser, profile: null, settings: null, loading: true, initialized: false });

        console.log(`[MZ-HEALTH-RBAC] Auth Session Triggered. Auth UID: ${authUser.uid}`);

        // Force reload of authentication profile details
        try {
          await authUser.reload();
          console.log(`[MZ-HEALTH-RBAC] Auth profile reload forced successfully.`);
        } catch (reloadErr) {
          console.warn('[MZ-HEALTH-RBAC] Auth profile reload failed (offline or transient):', reloadErr);
        }

        // Authentication profile MUST load strictly by current authentication UID
        const currentUid = auth.currentUser?.uid || authUser.uid;
        console.log(`[MZ-HEALTH-RBAC] Fetching Firestore profile for UID: ${currentUid}`);

        const profileRef = doc(db, 'users', currentUid);
        profileUnsubscribe = onSnapshot(profileRef, async (profileSnap) => {
          if (profileSnap.exists()) {
            const data = profileSnap.data();
            const profile: UserProfile = {
              uid: data.uid,
              phoneNumber: data.phoneNumber,
              email: data.email,
              displayName: data.displayName,
              role: data.role as UserRole,
              isActive: data.isActive,
              languagePreference: data.languagePreference || 'bn',
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
              lastLoginAt: data.lastLoginAt?.toDate ? data.lastLoginAt.toDate().toISOString() : data.lastLoginAt,
            };

            // STRICT RBAC VERIFICATION DEBUGGING LOGS MANDATED BY SENIOR FIREBASE AUTHENTICATION SPEC:
            console.log('[MZ-HEALTH-RBAC] --- PROFILE RELOAD COMPLETED ---');
            console.log(` * Auth UID: ${auth.currentUser?.uid}`);
            console.log(` * Firestore UID: ${profileSnap.id}`);
            console.log(` * Loaded role: ${profile.role}`);
            console.log('------------------------------------------------');

            set({ profile, language: profile.languagePreference });
            localStorage.setItem('mz_lang', profile.languagePreference);

            // Fetch Settings in real-time
            if (!settingsUnsubscribe) {
              const settingsRef = doc(db, 'settings', currentUid);
              settingsUnsubscribe = onSnapshot(settingsRef, (settingsSnap) => {
                if (settingsSnap.exists()) {
                   set({ settings: settingsSnap.data() as UserSettings });
                }
                set({ loading: false, initialized: true });
              }, (err) => {
                handleFirestoreError(err, OperationType.GET, `settings/${currentUid}`);
                set({ loading: false, initialized: true });
              });
            } else {
              set({ loading: false, initialized: true });
            }
          } else {
            console.warn(`[MZ-HEALTH-RBAC] No Firestore profile matches UID: ${currentUid}. Onboarding page routing will display.`);
            set({ profile: null, settings: null, loading: false, initialized: true });
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, `users/${currentUid}`);
          set({ loading: false, initialized: true });
        });

      } else {
        console.log('[MZ-HEALTH-RBAC] Auth session released. Resetting auth state.');
        set({ user: null, profile: null, settings: null, loading: false, initialized: true });
      }
    });

    activeAuthUnsubscribe = () => {
      cleanupListeners();
      currentUnsubscribe();
      activeAuthUnsubscribe = null;
    };

    return activeAuthUnsubscribe;
  }
}));
