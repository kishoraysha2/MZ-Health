/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  getDocs, 
  collection, 
  query, 
  where, 
  deleteDoc,
  runTransaction,
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { DoctorProfile, PatientProfile, UserRole, OperationType, ChamberInfo, DoctorPrivateMetadata } from '../../types';

/**
 * Audit creation helper
 */
async function appendAuditLog(
  actorId: string,
  actorRole: UserRole | 'system',
  actionType: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EMERGENCY_OVERRIDE',
  resourceTarget: 'users' | 'settings' | 'audit_logs' | 'doctors' | 'patients',
  resourceDocId: string,
  extraDetails?: string
) {
  const logId = `log_${crypto.randomUUID()}`;
  try {
    const auditRef = doc(db, 'audit_logs', logId);
    await setDoc(auditRef, {
      logId,
      actorId,
      actorRole,
      actionType,
      resourceTarget,
      resourceDocId,
      ipAddress: '127.0.0.1',
      userAgent: `${navigator.userAgent}${extraDetails ? ' | ' + extraDetails : ''}`,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error('[MZ-HEALTH] Audit logging failed:', err);
  }
}

/**
 * DOCTOR MANAGEMENT METHODS
 */

export async function getDoctorProfile(doctorId: string): Promise<(DoctorProfile & Partial<DoctorPrivateMetadata> & { chambers?: ChamberInfo[] }) | null> {
  const docRef = doc(db, 'doctors', doctorId);
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const docData = snap.data() as DoctorProfile;
    
    // Try fetching private metadata (Only doctor owner or admin has permission)
    let privateData: any = {};
    try {
      const privRef = doc(db, 'doctors', doctorId, 'private', 'metadata');
      const privSnap = await getDoc(privRef);
      if (privSnap.exists()) {
        privateData = privSnap.data();
      }
    } catch (privErr) {
      console.log('[MZ-HEALTH] Private metadata lookup omitted or unauthorized for current caller.');
    }

    // Fetch chambers from subcollection
    const chambers: ChamberInfo[] = [];
    try {
      const chambersColl = collection(db, 'doctors', doctorId, 'chambers');
      const chambersSnap = await getDocs(chambersColl);
      chambersSnap.forEach(snapDoc => {
        chambers.push({
          chamberId: snapDoc.id,
          ...snapDoc.data()
        } as ChamberInfo);
      });
    } catch (chambErr) {
      console.log('[MZ-HEALTH] Chambers subcollection fetch omitted or unauthorized.');
    }
    
    return {
      ...docData,
      nationalId: privateData.nationalId || '',
      dateOfBirth: privateData.dateOfBirth || '',
      bmdcVerifiedBy: privateData.bmdcVerifiedBy || null,
      bmdcVerificationDate: privateData.bmdcVerificationDate || null,
      chambers: chambers
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `doctors/${doctorId}`);
  }
}

export async function checkBMDCUnique(bmdcRegNumber: string, currentUid: string): Promise<boolean> {
  const bmdcNum = bmdcRegNumber.trim().toUpperCase();
  if (!bmdcNum) return true;
  try {
    const uniqueRef = doc(db, 'unique_bmdc', bmdcNum);
    const uniqueSnap = await getDoc(uniqueRef);
    if (uniqueSnap.exists() && uniqueSnap.data().ownerId !== currentUid) {
      return false;
    }
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `unique_bmdc/${bmdcNum}`);
  }
}

export async function saveDoctorProfile(
  doctorId: string, 
  data: Partial<DoctorProfile & DoctorPrivateMetadata & { chambers?: ChamberInfo[] }>,
  actorId: string,
  actorRole: UserRole,
  isInitialCreation = false
): Promise<void> {
  try {
    const docRef = doc(db, 'doctors', doctorId);
    const privRef = doc(db, 'doctors', doctorId, 'private', 'metadata');
    
    // Strict Bangladesh BMDC Format Validation
    const bmdcNum = data.bmdcRegNumber ? data.bmdcRegNumber.trim().toUpperCase() : '';
    if (bmdcNum) {
      const bmdcRegex = /^(A|D)-\d{3,6}$/;
      if (!bmdcRegex.test(bmdcNum)) {
        throw new Error('Strict BMDC Validation Failure: Registration must adhere to Bangladesh standard format "A-XXXXX" or "D-XXXXX" (A for Medical, D for Dental, with 3 to 6 digits).');
      }
    }

    // Firestore Transaction for BMDC Uniqueness
    await runTransaction(db, async (transaction) => {
      let oldBmdc = '';
      const doctorSnap = await transaction.get(docRef);
      if (doctorSnap.exists()) {
        oldBmdc = doctorSnap.data().bmdcRegNumber || '';
      }
      
      if (bmdcNum) {
        const uniqueRef = doc(db, 'unique_bmdc', bmdcNum);
        const uniqueSnap = await transaction.get(uniqueRef);
        if (uniqueSnap.exists() && uniqueSnap.data().ownerId !== doctorId) {
          throw new Error('BMDC Uniqueness Alert: This BMDC Registration number is already registered by another clinician.');
        }
        
        // Register unique mapping
        transaction.set(uniqueRef, {
          bmdcNumber: bmdcNum,
          ownerId: doctorId,
          updatedAt: new Date().toISOString()
        });
      }
      
      if (oldBmdc && oldBmdc !== bmdcNum) {
        const oldUniqueRef = doc(db, 'unique_bmdc', oldBmdc);
        transaction.delete(oldUniqueRef);
      }
    });

    // Write public and private profile data
    if (isInitialCreation) {
      const publicProfile = {
        doctorId,
        bmdcRegNumber: bmdcNum,
        bmdcVerified: false,
        profilePhotoUrl: data.profilePhotoUrl || '',
        specialities: data.specialities || [],
        qualifications: data.qualifications || [],
        experienceYears: data.experienceYears || 0,
        currentWorkplace: data.currentWorkplace || '',
        consultationFee: data.consultationFee || 0,
        languagesSpoken: data.languagesSpoken || [],
        bio: data.bio || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalAppointmentsCount: 0
      };

      const privateProfile = {
        nationalId: data.nationalId || '',
        dateOfBirth: data.dateOfBirth || '',
        bmdcVerifiedBy: null,
        bmdcVerificationDate: null
      };

      await setDoc(docRef, publicProfile);
      await setDoc(privRef, privateProfile);
      await appendAuditLog(actorId, actorRole, 'CREATE', 'doctors', doctorId);
    } else {
      const patchData = { ...data };
      delete patchData.bmdcVerified;
      delete (patchData as any).createdAt;
      
      // Separate public and private attributes from nested payload
      const publicFields: any = {};
      const privateFields: any = {};

      const publicKeys = [
        'bmdcRegNumber', 'profilePhotoUrl', 'specialities', 'qualifications',
        'experienceYears', 'currentWorkplace', 'consultationFee', 'languagesSpoken', 'bio'
      ];
      const privateKeys = ['nationalId', 'dateOfBirth'];

      publicKeys.forEach(k => {
        if ((patchData as any)[k] !== undefined) {
          publicFields[k] = (patchData as any)[k];
        }
      });
      privateKeys.forEach(k => {
         if ((patchData as any)[k] !== undefined) {
           privateFields[k] = (patchData as any)[k];
         }
      });

      if (bmdcNum) {
        publicFields.bmdcRegNumber = bmdcNum;
      }

      if (Object.keys(publicFields).length > 0) {
        await updateDoc(docRef, {
          ...publicFields,
          updatedAt: new Date().toISOString()
        });
      }
      if (Object.keys(privateFields).length > 0) {
        await setDoc(privRef, privateFields, { merge: true });
      }
      
      await appendAuditLog(actorId, actorRole, 'UPDATE', 'doctors', doctorId);
    }

    // Handle Subcollection Chambers Refactor
    if (data.chambers) {
      const chambersCollRef = collection(db, 'doctors', doctorId, 'chambers');
      const existingChambersSnap = await getDocs(chambersCollRef);
      const existingIds = existingChambersSnap.docs.map(doc => doc.id);
      
      for (const chamber of data.chambers) {
        const cId = chamber.chamberId || `chamber_${crypto.randomUUID()}`;
        const chamberRef = doc(db, 'doctors', doctorId, 'chambers', cId);
        
        await setDoc(chamberRef, {
          chamberId: cId,
          name: chamber.name,
          address: chamber.address,
          city: chamber.city,
          consultationFee: chamber.consultationFee,
          activeDays: chamber.activeDays,
          timeSlots: chamber.timeSlots
        });
      }
      
      const currentIds = data.chambers.map(c => c.chamberId).filter(Boolean);
      for (const oldId of existingIds) {
        if (!currentIds.includes(oldId)) {
          const deleteRef = doc(db, 'doctors', doctorId, 'chambers', oldId);
          await deleteDoc(deleteRef);
        }
      }
    }

    // Refresh Search Catalog Index to keep optimized searchable collection updated
    const catalogRef = doc(db, 'doctor_catalogs', doctorId);
    const userSnap = await getDoc(doc(db, 'users', doctorId));
    const doctorSnap = await getDoc(docRef);
    const docInfo = doctorSnap.data() as DoctorProfile;

    await setDoc(catalogRef, {
      doctorId,
      name: userSnap.exists() ? (userSnap.data().displayName || 'Unknown Doctor') : 'Unknown Doctor',
      specialization: (docInfo?.specialities && docInfo.specialities.length > 0) ? docInfo.specialities.join(', ') : 'General Practitioner',
      city: (data.chambers && data.chambers.length > 0) ? data.chambers[0].city : 'Dhaka',
      consultationFee: Number(docInfo?.consultationFee) || 0,
      verificationStatus: docInfo?.bmdcVerified ? 'verified' : 'pending',
      updatedAt: new Date().toISOString()
    }, { merge: true });

  } catch (err: any) {
    if (err.message && (err.message.includes('BMDC') || err.message.includes('Validation'))) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, `doctors/${doctorId}`);
  }
}

/**
 * PATIENT MANAGEMENT METHODS
 */

export async function getPatientProfile(patientId: string): Promise<PatientProfile | null> {
  const docRef = doc(db, 'patients', patientId);
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as PatientProfile;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `patients/${patientId}`);
  }
}

export async function savePatientProfile(
  patientId: string,
  data: Partial<PatientProfile>,
  actorId: string,
  actorRole: UserRole,
  isInitialCreation = false
): Promise<void> {
  const docRef = doc(db, 'patients', patientId);
  try {
    if (isInitialCreation) {
      const fullProfile: PatientProfile = {
        patientId,
        dateOfBirth: data.dateOfBirth || '',
        gender: data.gender || 'other',
        bloodGroup: data.bloodGroup || 'O+',
        emergencyContact: data.emergencyContact || { name: '', relationship: '', phoneNumber: '' },
        heightCm: data.heightCm || 0,
        weightKg: data.weightKg || 0,
        allergies: data.allergies || [],
        chronicDiseases: data.chronicDiseases || [],
        currentMedications: data.currentMedications || [],
        medicalNotes: data.medicalNotes || '',
        profilePhotoUrl: data.profilePhotoUrl || '',
        status: data.status || 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(docRef, fullProfile);
      await appendAuditLog(actorId, actorRole, 'CREATE', 'patients', patientId);
    } else {
      const patchData = { ...data };
      delete (patchData as any).createdAt;
      delete (patchData as any).age; // Ensure age isn't written
      
      await updateDoc(docRef, {
        ...patchData,
        updatedAt: new Date().toISOString()
      });
      await appendAuditLog(actorId, actorRole, 'UPDATE', 'patients', patientId);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `patients/${patientId}`);
  }
}

/**
 * ADMIN DIRECTORY AND VERIFICATION METHODS
 */

export async function getAllDoctors(): Promise<(DoctorProfile & { chambers?: ChamberInfo[] } & Partial<DoctorPrivateMetadata>)[]> {
  try {
    const snap = await getDocs(collection(db, 'doctors'));
    const doctorsList: any[] = [];
    for (const docSnap of snap.docs) {
      const docData = docSnap.data();
      const docId = docSnap.id;
      
      // Try to load chambers subcollection for admin dashboard
      const chambers: ChamberInfo[] = [];
      try {
        const chambersColl = collection(db, 'doctors', docId, 'chambers');
        const chambersSnap = await getDocs(chambersColl);
        chambersSnap.forEach(snapC => {
          chambers.push({
            chamberId: snapC.id,
            ...snapC.data()
          } as ChamberInfo);
        });
      } catch (cErr) {}

      // Try to load private metadata for admin review
      let privateData: any = {};
      try {
        const privRef = doc(db, 'doctors', docId, 'private', 'metadata');
        const privSnap = await getDoc(privRef);
        if (privSnap.exists()) {
          privateData = privSnap.data();
        }
      } catch (pErr) {}

      doctorsList.push({
        ...docData,
        chambers,
        nationalId: privateData.nationalId || '',
        dateOfBirth: privateData.dateOfBirth || '',
        bmdcVerifiedBy: privateData.bmdcVerifiedBy || null,
        bmdcVerificationDate: privateData.bmdcVerificationDate || null,
      });
    }
    return doctorsList;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'doctors');
  }
}

export async function getAllPatients(): Promise<PatientProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'patients'));
    const list: PatientProfile[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as PatientProfile);
    });
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'patients');
  }
}

export async function verifyDoctor(
  doctorId: string,
  adminId: string,
  adminRole: UserRole,
  isVerified: boolean
): Promise<void> {
  const docRef = doc(db, 'doctors', doctorId);
  const privRef = doc(db, 'doctors', doctorId, 'private', 'metadata');
  const catalogRef = doc(db, 'doctor_catalogs', doctorId);
  try {
    await updateDoc(docRef, {
      bmdcVerified: isVerified,
      updatedAt: new Date().toISOString()
    });
    
    // Set private metadata details
    await setDoc(privRef, {
      bmdcVerifiedBy: isVerified ? adminId : null,
      bmdcVerificationDate: isVerified ? new Date().toISOString() : null,
    }, { merge: true });

    // Set catalog verification status
    await setDoc(catalogRef, {
      verificationStatus: isVerified ? 'verified' : 'pending'
    }, { merge: true });

    await appendAuditLog(
      adminId,
      adminRole,
      'UPDATE',
      'doctors',
      doctorId,
      `DOCTOR VERIFICATION STATE TOGGLED TO ${isVerified}`
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `doctors/${doctorId}`);
  }
}

export async function setUserActiveStatus(
  targetUserId: string,
  isActive: boolean,
  adminId: string,
  adminRole: UserRole
): Promise<void> {
  const userRef = doc(db, 'users', targetUserId);
  try {
    await updateDoc(userRef, {
      isActive,
      updatedAt: serverTimestamp()
    });
    
    // Also update corresponding active status fields in connected doctor or patient profile
    const docRef = doc(db, 'doctors', targetUserId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      // Just track or log
    } else {
      const patientRef = doc(db, 'patients', targetUserId);
      const patientSnap = await getDoc(patientRef);
      if (patientSnap.exists()) {
        await updateDoc(patientRef, {
          status: isActive ? 'active' : 'inactive',
          updatedAt: new Date().toISOString()
        });
      }
    }
    
    await appendAuditLog(
      adminId,
      adminRole,
      'UPDATE',
      'users',
      targetUserId,
      `USER ACCOUNT ACTIVE STATUS TOGGLED TO ${isActive}`
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${targetUserId}`);
  }
}
