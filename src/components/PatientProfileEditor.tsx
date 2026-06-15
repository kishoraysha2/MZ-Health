/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useTransition } from 'react';
import { useAuthStore } from '../store/authStore';
import { PatientProfile, UserRole } from '../types';
import { getPatientProfile, savePatientProfile } from '../lib/services/profileService';
import { 
  User, 
  Heart, 
  Activity, 
  ShieldAlert, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle,
  Calendar,
  Contact,
  Scale,
  Smile,
  Frown
} from 'lucide-react';

export const PatientProfileEditor: React.FC = () => {
  const { profile, updateProfileDetails } = useAuthStore();
  const [isPending, startTransition] = useTransition();

  // Core Auth user profile state
  const [fullName, setFullName] = useState(profile?.displayName || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber || '');
  const [emailAddress, setEmailAddress] = useState(profile?.email || '');

  // Patient Sub-profile details
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('other');
  const [bloodGroup, setBloodGroup] = useState<PatientProfile['bloodGroup']>('O+');
  
  // Emergency Contact structure
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Physiological vitals
  const [heightCm, setHeightCm] = useState<number>(170);
  const [weightKg, setWeightKg] = useState<number>(70);

  // Lists arrays
  const [allergyInput, setAllergyInput] = useState('');
  const [allergies, setAllergies] = useState<string[]>([]);
  
  const [diseaseInput, setDiseaseInput] = useState('');
  const [chronicDiseases, setChronicDiseases] = useState<string[]>([]);

  const [medsInput, setMedsInput] = useState('');
  const [currentMedications, setCurrentMedications] = useState<string[]>([]);

  const [medicalNotes, setMedicalNotes] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');

  // Status indicators
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'danger' | null }>({ message: '', type: null });

  // Load Patient profile
  useEffect(() => {
    if (!profile) return;
    
    const loadData = async () => {
      setLoading(true);
      try {
        const patProfile = await getPatientProfile(profile.uid);
        if (patProfile) {
          setDateOfBirth(patProfile.dateOfBirth || '');
          setGender(patProfile.gender || 'other');
          setBloodGroup(patProfile.bloodGroup || 'O+');
          
          if (patProfile.emergencyContact) {
            setEmergencyName(patProfile.emergencyContact.name || '');
            setEmergencyRelation(patProfile.emergencyContact.relationship || '');
            setEmergencyPhone(patProfile.emergencyContact.phoneNumber || '');
          }
          
          setHeightCm(patProfile.heightCm || 170);
          setWeightKg(patProfile.weightKg || 70);
          setAllergies(patProfile.allergies || []);
          setChronicDiseases(patProfile.chronicDiseases || []);
          setCurrentMedications(patProfile.currentMedications || []);
          setMedicalNotes(patProfile.medicalNotes || '');
          setProfilePhotoUrl(patProfile.profilePhotoUrl || '');
        } else {
          // Auto create blank patient profile record if none exists
          await savePatientProfile(profile.uid, {
            patientId: profile.uid,
            dateOfBirth: '',
            gender: 'other',
            bloodGroup: 'O+',
            status: 'active'
          }, profile.uid, profile.role, true);
        }
      } catch (err: any) {
        setFeedback({ message: 'Error retrieving your clinical history.', type: 'danger' });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [profile]);

  // Dynamic calculations representing true visual craft
  const calculatedAge = () => {
    if (!dateOfBirth) return 0;
    const birthDate = new Date(dateOfBirth);
    const difference = Date.now() - birthDate.getTime();
    const ageDate = new Date(difference);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const calculateBMI = () => {
    if (!heightCm || !weightKg) return 0;
    const heightM = heightCm / 100;
    return Number((weightKg / (heightM * heightM)).toFixed(1));
  };

  const getBMICategory = (bmiValue: number) => {
    if (bmiValue <= 0) return { label: 'Awaiting Metrics', color: 'text-slate-400 bg-slate-50 border-slate-100' };
    if (bmiValue < 18.5) return { label: 'Underweight', color: 'text-sky-700 bg-sky-50 border-sky-100/80' };
    if (bmiValue < 25) return { label: 'Healthy Baseline', color: 'text-emerald-700 bg-emerald-50 border-emerald-100/80' };
    if (bmiValue < 30) return { label: 'Overweight Indicator', color: 'text-amber-700 bg-amber-50 border-amber-100/80' };
    return { label: 'Clinical Obesity Warning', color: 'text-red-700 bg-red-50 border-red-100/80' };
  };

  const bmi = calculateBMI();
  const bmiCat = getBMICategory(bmi);

  // Tag array appenders
  const handleAddAllergy = () => {
    if (allergyInput.trim() && !allergies.includes(allergyInput.trim())) {
      setAllergies([...allergies, allergyInput.trim()]);
      setAllergyInput('');
    }
  };
  const handleRemoveAllergy = (t: string) => setAllergies(allergies.filter(item => item !== t));

  const handleAddDisease = () => {
    if (diseaseInput.trim() && !chronicDiseases.includes(diseaseInput.trim())) {
      setChronicDiseases([...chronicDiseases, diseaseInput.trim()]);
      setDiseaseInput('');
    }
  };
  const handleRemoveDisease = (t: string) => setChronicDiseases(chronicDiseases.filter(item => item !== t));

  const handleAddMed = () => {
    if (medsInput.trim() && !currentMedications.includes(medsInput.trim())) {
      setCurrentMedications([...currentMedications, medsInput.trim()]);
      setMedsInput('');
    }
  };
  const handleRemoveMed = (t: string) => setCurrentMedications(currentMedications.filter(item => item !== t));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setFeedback({ message: '', type: null });

    // Client side verification
    if (!fullName.trim()) {
      setFeedback({ message: 'DisplayName cannot be left blank.', type: 'danger' });
      setSaving(false);
      return;
    }

    // Emergency phoneNumber checking
    const bdPhoneRegex = /^(?:\+8801|01)[3-9]\d{8}$/;
    if (emergencyPhone && !bdPhoneRegex.test(emergencyPhone)) {
      setFeedback({ message: 'Please enter a valid Bangladeshi contact connection for the emergency registry.', type: 'danger' });
      setSaving(false);
      return;
    }

    startTransition(async () => {
      try {
        // 1. Sync general credentials
        await updateProfileDetails(fullName, emailAddress || undefined);

        // 2. Draft patient state properties
        const payload: Partial<PatientProfile> = {
          dateOfBirth,
          gender,
          bloodGroup,
          emergencyContact: {
            name: emergencyName.trim(),
            relationship: emergencyRelation.trim(),
            phoneNumber: emergencyPhone.trim()
          },
          heightCm: Number(heightCm) || 0,
          weightKg: Number(weightKg) || 0,
          allergies,
          chronicDiseases,
          currentMedications,
          medicalNotes: medicalNotes.trim(),
          profilePhotoUrl: profilePhotoUrl.trim() || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(fullName)}`
        };

        // 3. Save Patient Database Doc
        await savePatientProfile(profile.uid, payload, profile.uid, profile.role);
        
        setFeedback({ message: 'Your Demographics and Clinical Baselines profiles have been updated.', type: 'success' });
      } catch (err: any) {
        setFeedback({ message: err?.message || 'Database transaction error writing patient record.', type: 'danger' });
      } finally {
        setSaving(false);
      }
    });
  };

  if (loading) {
    return (
      <div className="py-12 text-center" id="patient-editor-loading">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" id="pat-loading-spinner"></div>
        <p className="text-sm font-medium text-slate-500">Retrieving Clinical Record...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" id="patient-profile-editor">
      
      {/* Feedback Banner */}
      {feedback.message && (
        <div 
          className={`p-4 rounded-xl border flex gap-3 items-start animate-fade-in ${
            feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}
          id="pat-edit-alert"
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="h-5 w-5 mt-0.5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-red-600 animate-bounce" />
          )}
          <div>
            <strong className="block font-bold text-sm">
              {feedback.type === 'success' ? 'Synchronization Successful' : 'Validation Unresolved'}
            </strong>
            <p className="text-xs mt-0.5">{feedback.message}</p>
          </div>
        </div>
      )}

      {/* Aesthetic Craft: Clinical Vitals Highlight Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="vitals-highlight-panels">
        
        <div className="bg-white border border-slate-100 rounded-xl p-5 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Chronological Age</span>
            <p className="text-3xl font-black text-slate-800" id="calc-age-v">{calculatedAge()} <span className="text-sm font-medium text-slate-500">Years</span></p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <Calendar className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-5 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Blood Class</span>
            <p className="text-3xl font-black text-red-600" id="blood-v">{bloodGroup}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-xl text-red-500">
            <Heart className="h-6 w-6 animate-pulse" />
          </div>
        </div>

        <div className={`border rounded-xl p-5 flex items-center justify-between shadow-sm relative overflow-hidden bg-white`}>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Body Mass Index (BMI)</span>
            <p className="text-2xl font-black text-slate-800" id="bmi-v">{bmi}</p>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border inline-block mt-1 ${bmiCat.color}`}>
              {bmiCat.label}
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl text-slate-500">
            <Scale className="h-6 w-6" />
          </div>
        </div>

      </div>

      <form onSubmit={handleSave} className="space-y-6" id="patient-profile-form">
        
        {/* SECTION 1: Personal Profile Demographics */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6" id="pat-personal">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
            <User className="h-5 w-5 text-emerald-600" />
            <h4 className="font-bold text-slate-900 text-sm tracking-tight uppercase">1. Demographics & Coordinates</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Full Legal Name *</label>
              <input 
                type="text" 
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-sm text-slate-800"
                required
                id="pat-in-name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Email Address *</label>
              <input 
                type="email" 
                value={emailAddress}
                onChange={e => setEmailAddress(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-sm text-slate-800"
                required
                id="pat-in-email"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Mobile Connection (Bangladesh)</label>
              <input 
                type="text" 
                value={phoneNumber}
                disabled
                className="w-full px-3 py-2 border border-slate-100 bg-slate-50 text-slate-500 rounded-lg text-sm cursor-not-allowed"
                id="pat-in-phone"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Phone credentials locked for secure authentication holds.</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Date of Birth *</label>
              <input 
                type="date" 
                value={dateOfBirth}
                onChange={e => setDateOfBirth(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-sm text-slate-800"
                required
                id="pat-in-dob"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Biological Gender *</label>
              <select 
                value={gender}
                onChange={e => setGender(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-sm text-slate-800"
                id="pat-in-gender"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Blood Classification *</label>
              <select 
                value={bloodGroup}
                onChange={e => setBloodGroup(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-sm text-slate-800 bg-white font-extrabold"
                id="pat-in-blood"
              >
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Profile Photo Image URL</label>
              <input 
                type="text" 
                value={profilePhotoUrl}
                onChange={e => setProfilePhotoUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-sm text-slate-800"
                id="pat-in-photo"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Physiological Physiological metrics */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6" id="pat-physiological">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-600" />
            <h4 className="font-bold text-slate-900 text-sm tracking-tight uppercase">2. Physiological Vitals & Measurements</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Height Metric (Centimeters)*</label>
              <input 
                type="number" 
                value={heightCm}
                onChange={e => setHeightCm(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-sm text-slate-800"
                min="30"
                max="250"
                required
                id="pat-in-height"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Weight Metric (Kilograms)*</label>
              <input 
                type="number" 
                value={weightKg}
                onChange={e => setWeightKg(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-sm text-slate-800"
                min="2"
                max="350"
                required
                id="pat-in-weight"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: Emergency Registry */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6" id="pat-emergency">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
            <Contact className="h-5 w-5 text-emerald-600" />
            <h4 className="font-bold text-slate-900 text-sm tracking-tight uppercase">3. Primary Emergency Contacts Registry</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contact Legal Name *</label>
              <input 
                type="text" 
                value={emergencyName}
                onChange={e => setEmergencyName(e.target.value)}
                placeholder="Spouse, Caregiver name"
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-xs text-slate-800"
                required
                id="pat-in-ename"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Relationship Index *</label>
              <input 
                type="text" 
                value={emergencyRelation}
                onChange={e => setEmergencyRelation(e.target.value)}
                placeholder="E.g., Spouse, Mother, Father"
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-xs text-slate-800"
                required
                id="pat-in-erel"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone Number Index (Bangladesh)*</label>
              <input 
                type="text" 
                value={emergencyPhone}
                onChange={e => setEmergencyPhone(e.target.value)}
                placeholder="e.g., 01712345678"
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-xs text-slate-800"
                required
                id="pat-in-ephone"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: Clinical History & Active Allergens */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6" id="pat-clinical">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-emerald-600" />
            <h4 className="font-bold text-slate-900 text-sm tracking-tight uppercase">4. Clinical History & Sensitivity Markers</h4>
          </div>

          <div className="space-y-4">
            
            {/* Allergies tag builder */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Allergies Registry</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={allergyInput}
                  onChange={e => setAllergyInput(e.target.value)}
                  placeholder="E.g., Penicillin, Peanuts"
                  className="px-3 py-1.5 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-xs text-slate-800 shrink-0"
                  id="allergy-in"
                />
                <button
                  type="button"
                  onClick={handleAddAllergy}
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer"
                  id="btn-add-allergy"
                >
                  Append
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2" id="allergies-tags-list">
                {allergies.length === 0 ? (
                  <span className="text-[10px] text-slate-400 italic">No allergies recorded down.</span>
                ) : (
                  allergies.map(tg => (
                    <span key={tg} className="text-[10px] uppercase font-bold bg-amber-50 text-amber-800 border border-amber-200/50 rounded-lg px-2 py-0.5 flex items-center gap-1">
                      {tg}
                      <button type="button" onClick={() => handleRemoveAllergy(tg)} className="font-bold text-[10px] text-amber-500 hover:text-amber-800 cursor-pointer">×</button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Chronic Diseases tag builder */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Chronic Background Background conditions</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={diseaseInput}
                  onChange={e => setDiseaseInput(e.target.value)}
                  placeholder="E.g., Diabetes, Hypertension"
                  className="px-3 py-1.5 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-xs text-slate-800 shrink-0"
                  id="disease-in"
                />
                <button
                  type="button"
                  onClick={handleAddDisease}
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer"
                  id="btn-add-disease"
                >
                  Append
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2" id="diseases-tags-list">
                {chronicDiseases.length === 0 ? (
                  <span className="text-[10px] text-slate-400 italic">No chronic ailments recorded.</span>
                ) : (
                  chronicDiseases.map(tg => (
                    <span key={tg} className="text-[10px] uppercase font-bold bg-blue-50 text-blue-800 border border-blue-200/50 rounded-lg px-2 py-0.5 flex items-center gap-1">
                      {tg}
                      <button type="button" onClick={() => handleRemoveDisease(tg)} className="font-bold text-[10px] text-blue-500 hover:text-blue-800 cursor-pointer">×</button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Current Medications tag builder */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Current Medications Registry</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={medsInput}
                  onChange={e => setMedsInput(e.target.value)}
                  placeholder="E.g., Insulin, Losartan"
                  className="px-3 py-1.5 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-xs text-slate-800 shrink-0"
                  id="meds-in"
                />
                <button
                  type="button"
                  onClick={handleAddMed}
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer"
                  id="btn-add-med"
                >
                  Append
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2" id="meds-tags-list">
                {currentMedications.length === 0 ? (
                  <span className="text-[10px] text-slate-400 italic">No medications documented.</span>
                ) : (
                  currentMedications.map(tg => (
                    <span key={tg} className="text-[10px] uppercase font-bold bg-purple-50 text-purple-800 border border-purple-200/50 rounded-lg px-2 py-0.5 flex items-center gap-1">
                      {tg}
                      <button type="button" onClick={() => handleRemoveMed(tg)} className="font-bold text-[10px] text-purple-500 hover:text-purple-800 cursor-pointer">×</button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Medical notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">General Medical Notes</label>
              <textarea 
                value={medicalNotes}
                onChange={e => setMedicalNotes(e.target.value)}
                rows={3}
                placeholder="Document any additional background info, historical surgeries, or warnings..."
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-sm text-slate-800 resize-none"
                id="pat-in-notes"
              />
            </div>

          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3" id="pat-btn-panel">
          <button 
            type="submit" 
            disabled={saving || isPending}
            className={`px-6 py-3 font-bold text-sm text-white rounded-xl bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-600/15 duration-150 flex items-center gap-2 cursor-pointer ${
              (saving || isPending) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            id="pat-profile-submit-btn"
          >
            {(saving || isPending) ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving medical profile...
              </>
            ) : (
              'Save Profile'
            )}
          </button>
        </div>

      </form>
    </div>
  );
};
