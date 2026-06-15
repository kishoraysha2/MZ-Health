/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  DOCTOR = 'doctor',
  PATIENT = 'patient',
}

export interface UserProfile {
  uid: string;
  phoneNumber: string;
  email?: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  languagePreference: 'bn' | 'en';
  createdAt: string; // ISO String or serialized format
  updatedAt: string;
  lastLoginAt: string;
}

export interface ChamberInfo {
  chamberId?: string;
  name: string;
  address: string;
  city: string;
  consultationFee: number;
  activeDays: string[];
  timeSlots: string[];
}

export interface DoctorPrivateMetadata {
  nationalId: string;
  dateOfBirth: string;
  bmdcVerifiedBy: string | null;
  bmdcVerificationDate: string | null;
}

export interface DoctorCatalog {
  doctorId: string; // matches doctor ID / document ID
  name: string;
  specialization: string;
  city: string;
  consultationFee: number;
  verificationStatus: 'verified' | 'pending';
}

export interface DoctorProfile {
  doctorId: string; // matches userId
  bmdcRegNumber: string;
  bmdcVerified: boolean;
  gender: 'male' | 'female' | 'other';
  profilePhotoUrl: string;
  specialities: string[];
  qualifications: string[];
  experienceYears: number;
  currentWorkplace: string;
  consultationFee: number;
  languagesSpoken: string[];
  bio?: string;
  createdAt: string;
  updatedAt: string;
  totalAppointmentsCount: number;
}

export interface PatientProfile {
  patientId: string; // matches userId
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  bloodGroup: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  emergencyContact: {
    name: string;
    relationship: string;
    phoneNumber: string;
  };
  heightCm: number;
  weightKg: number;
  allergies: string[];
  chronicDiseases: string[];
  currentMedications: string[];
  medicalNotes: string;
  profilePhotoUrl: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  userId: string;
  pushNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  accessibility: {
    highContrastMode: boolean;
    fontSizeScale: 'small' | 'medium' | 'large';
  };
  updatedAt: string;
}

export interface AuditLog {
  logId: string;
  actorId: string;
  actorRole: UserRole | 'system';
  actionType: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EMERGENCY_OVERRIDE';
  resourceTarget: 'users' | 'settings' | 'audit_logs';
  resourceDocId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string; // serialized Timestamp
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}
