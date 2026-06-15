/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useTransition } from 'react';
import { useAuthStore } from '../store/authStore';
import { DoctorProfile, ChamberInfo, UserRole } from '../types';
import { getDoctorProfile, saveDoctorProfile, checkBMDCUnique } from '../lib/services/profileService';
import { 
  User, 
  Stethoscope, 
  FileCheck, 
  Plus, 
  Trash2, 
  Building, 
  MapPin, 
  CreditCard,
  Languages, 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  HelpCircle,
  UserCheck
} from 'lucide-react';

export const DoctorProfileEditor: React.FC = () => {
  const { profile, updateProfileDetails, language } = useAuthStore();
  const [isPending, startTransition] = useTransition();

  // Core User profile state
  const [fullName, setFullName] = useState(profile?.displayName || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber || '');
  const [emailAddress, setEmailAddress] = useState(profile?.email || '');

  // Doctor Specific Profile state
  const [bmdcRegNumber, setBmdcRegNumber] = useState('');
  const [bmdcVerified, setBmdcVerified] = useState(false);
  const [nationalId, setNationalId] = useState('');
  const [gender, setGender] = useState('male');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [specialitiesInput, setSpecialitiesInput] = useState('');
  const [qualificationsInput, setQualificationsInput] = useState('');
  const [experienceYears, setExperienceYears] = useState<number>(0);
  const [currentWorkplace, setCurrentWorkplace] = useState('');
  const [consultationFee, setConsultationFee] = useState<number>(0);
  const [languagesInput, setLanguagesInput] = useState('');
  const [bio, setBio] = useState('');
  const [chambers, setChambers] = useState<ChamberInfo[]>([]);

  // Chamber Form Temp States
  const [chamberName, setChamberName] = useState('');
  const [chamberAddress, setChamberAddress] = useState('');
  const [chamberCity, setChamberCity] = useState('');
  const [chamberFee, setChamberFee] = useState<number>(0);
  const [chamberDays, setChamberDays] = useState<string[]>([]);
  const [chamberTime, setChamberTime] = useState('');

  // Status and Validation Feedbacks
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'danger' | null }>({ message: '', type: null });
  const [bmdcUniqueError, setBmdcUniqueError] = useState<string | null>(null);

  const citiesBD = ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', 'Barisal', 'Rangpur', 'Mymensingh', 'Cox\'s Bazar', 'Comilla'];
  const weekDays = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  useEffect(() => {
    if (!profile) return;
    
    const loadData = async () => {
      setLoading(true);
      try {
        const docProfile = await getDoctorProfile(profile.uid);
        if (docProfile) {
          setBmdcRegNumber(docProfile.bmdcRegNumber);
          setBmdcVerified(docProfile.bmdcVerified);
          setNationalId(docProfile.nationalId);
          setGender(docProfile.gender || 'male');
          setDateOfBirth(docProfile.dateOfBirth);
          setProfilePhotoUrl(docProfile.profilePhotoUrl || '');
          setSpecialitiesInput(docProfile.specialities.join(', '));
          setQualificationsInput(docProfile.qualifications.join(', '));
          setExperienceYears(docProfile.experienceYears);
          setCurrentWorkplace(docProfile.currentWorkplace);
          setConsultationFee(docProfile.consultationFee);
          setLanguagesInput(docProfile.languagesSpoken.join(', '));
          setBio(docProfile.bio || '');
          setChambers(docProfile.chambers || []);
        } else {
          // If no doctor doc exists yet, initialize it
          await saveDoctorProfile(profile.uid, {
            doctorId: profile.uid,
            bmdcRegNumber: '',
            specialities: [],
            qualifications: [],
            experienceYears: 0,
            currentWorkplace: '',
            chambers: []
          }, profile.uid, profile.role, true);
        }
      } catch (err: any) {
        setFeedback({ message: 'Error loading medical profile credentials.', type: 'danger' });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [profile]);

  const handleAddChamber = () => {
    if (!chamberName || !chamberAddress || !chamberCity) {
      alert('Please fill in Chamber Name, Address, and City.');
      return;
    }
    if (chamberDays.length === 0) {
      alert('Please select at least one active day.');
      return;
    }
    if (!chamberTime) {
      alert('Please define the operating time slots (e.g., "17:00-20:00").');
      return;
    }

    const newChamber: ChamberInfo = {
      name: chamberName.trim(),
      address: chamberAddress.trim(),
      city: chamberCity,
      consultationFee: Number(chamberFee) || 0,
      activeDays: [...chamberDays],
      timeSlots: [chamberTime.trim()]
    };

    setChambers([...chambers, newChamber]);

    // reset temp form states
    setChamberName('');
    setChamberAddress('');
    setChamberCity('');
    setChamberFee(0);
    setChamberDays([]);
    setChamberTime('');
  };

  const handleRemoveChamber = (index: number) => {
    setChambers(chambers.filter((_, i) => i !== index));
  };

  const handleDayToggle = (day: string) => {
    if (chamberDays.includes(day)) {
      setChamberDays(chamberDays.filter(d => d !== day));
    } else {
      setChamberDays([...chamberDays, day]);
    }
  };

  const checkBMDCUniqueState = async (val: string) => {
    if (!val.trim() || !profile) {
      setBmdcUniqueError(null);
      return;
    }
    const targetVal = val.trim().toUpperCase();
    const bmdcRegex = /^(A|D)-\d{3,6}$/i;
    if (!bmdcRegex.test(targetVal)) {
      setBmdcUniqueError('Invalid Format (Use: "A-XXXXX" or "D-XXXXX" with 3-6 digits)');
      return;
    }
    try {
      const isUnique = await checkBMDCUnique(targetVal, profile.uid);
      if (!isUnique) {
        setBmdcUniqueError('This BMDC Registration code is already registered by another clinical user.');
      } else {
        setBmdcUniqueError(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setFeedback({ message: '', type: null });

    // Client-side validations
    if (!fullName.trim()) {
      setFeedback({ message: 'DisplayName cannot be left empty.', type: 'danger' });
      setSaving(false);
      return;
    }

    const bmdcRegex = /^(A|D)-\d{3,6}$/i;
    if (bmdcRegNumber && !bmdcRegex.test(bmdcRegNumber.trim())) {
      setFeedback({ message: 'Strict BMDC Validation Failure: Registration must adhere to standard format "A-XXXXX" or "D-XXXXX" (A for Medical, D for Dental, with 3 to 6 digits).', type: 'danger' });
      setSaving(false);
      return;
    }

    // Check uniqueness constraint
    if (bmdcRegNumber.trim()) {
      const bmdcUpper = bmdcRegNumber.trim().toUpperCase();
      const isUnique = await checkBMDCUnique(bmdcUpper, profile.uid);
      if (!isUnique) {
        setFeedback({ message: 'BMDC Registration conflict detected. This number is already registered.', type: 'danger' });
        setBmdcUniqueError('This BMDC Registration code is already registered by another clinical user.');
        setSaving(false);
        return;
      }
    }

    // National ID format assertion
    if (nationalId && !/^\d{10,17}$/.test(nationalId.trim())) {
      setFeedback({ message: 'National ID (NID) must count between 10 to 17 numeric digits.', type: 'danger' });
      setSaving(false);
      return;
    }

    // BD mobile check
    const bdPhoneRegex = /^(?:\+8801|01)[3-9]\d{8}$/;
    if (phoneNumber && !bdPhoneRegex.test(phoneNumber)) {
      setFeedback({ message: 'Please enter a valid Bangladeshi mobile connection format.', type: 'danger' });
      setSaving(false);
      return;
    }

    startTransition(async () => {
      try {
        // 1. Save auth level updates
        await updateProfileDetails(fullName, emailAddress || undefined);

        // 2. Format inputs to clinical models
        const payload: any = {
          bmdcRegNumber: bmdcRegNumber.trim().toUpperCase(),
          nationalId: nationalId.trim(),
          gender,
          dateOfBirth,
          profilePhotoUrl: profilePhotoUrl.trim() || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(fullName)}`,
          specialities: specialitiesInput ? specialitiesInput.split(',').map(s => s.trim()).filter(Boolean) : [],
          qualifications: qualificationsInput ? qualificationsInput.split(',').map(q => q.trim()).filter(Boolean) : [],
          experienceYears: Number(experienceYears) || 0,
          currentWorkplace: currentWorkplace.trim(),
          consultationFee: Number(consultationFee) || 0,
          languagesSpoken: languagesInput ? languagesInput.split(',').map(l => l.trim()).filter(Boolean) : ['English', 'Bangla'],
          bio: bio.trim(),
          chambers: chambers
        };

        // 3. Save to doctors collection
        await saveDoctorProfile(profile.uid, payload, profile.uid, profile.role);
        
        setFeedback({ message: 'Your Doctor Practitioner Profile was synchronized successfully.', type: 'success' });
      } catch (err: any) {
        setFeedback({ message: err?.message || 'Database transaction error writing clinical records.', type: 'danger' });
      } finally {
        setSaving(false);
      }
    });
  };

  if (loading) {
    return (
      <div className="py-12 text-center" id="doc-editor-loading">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" id="doc-loading-spinner"></div>
        <p className="text-sm font-medium text-slate-500">Retrieving Clinical Credentials...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" id="doctor-profile-editor">
      
      {/* Alert Banner */}
      {feedback.message && (
        <div 
          className={`p-4 rounded-xl border flex gap-3 items-start animate-fade-in ${
            feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}
          id="doc-edit-alert"
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="h-5 w-5 mt-0.5 shrink-0 text-emerald-600 animate-pulse" />
          ) : (
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-red-600 animate-bounce" />
          )}
          <div>
            <strong className="block font-bold text-sm">
              {feedback.type === 'success' ? 'Transaction Authorized' : 'Security Validation Refused'}
            </strong>
            <p className="text-xs mt-0.5">{feedback.message}</p>
          </div>
        </div>
      )}

      {/* Main Verification status badge */}
      <div 
        className={`p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm relative overflow-hidden ${
          bmdcVerified 
            ? 'bg-emerald-50/40 border-emerald-100/80 text-slate-800' 
            : 'bg-amber-50/40 border-amber-100/80 text-slate-800'
        }`}
        id="verification-banner-card"
      >
        <div className="flex gap-4 items-start" id="v-banner-left">
          <div className={`p-3 rounded-xl shrink-0 ${bmdcVerified ? 'bg-emerald-100/50 text-emerald-600' : 'bg-amber-100/50 text-amber-600'}`}>
            {bmdcVerified ? <UserCheck className="h-6 w-6" /> : <Stethoscope className="h-6 w-6" />}
          </div>
          <div>
            <h3 className="font-extrabold text-base flex items-center gap-1.5" id="v-title">
              BMDC Registration Status: 
              {bmdcVerified ? (
                <span className="text-xs px-2.5 py-1 bg-emerald-600 text-white rounded-full font-bold">VERIFIED PRACTICE</span>
              ) : (
                <span className="text-xs px-2.5 py-1 bg-amber-600 text-white rounded-full font-bold">VERIFICATION PENDING</span>
              )}
            </h3>
            <p className="text-xs mt-1 text-slate-500 leading-relaxed" id="v-desc">
              {bmdcVerified 
                ? 'Your Medical and Dental Council licensing has been validated by senior system administrators. Your credentials are live.'
                : 'Your profile remains under administrative audit. Fill in your BMDC registration details below for board evaluation.'
              }
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6" id="doctor-profile-form">
        
        {/* SECTION 1: Personal Coordinates */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6" id="doc-personal-grid">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
            <User className="h-5 w-5 text-emerald-600" />
            <h4 className="font-bold text-slate-900 text-sm tracking-tight uppercase">1. Personal Identity Coordinates</h4>
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
                id="doc-in-name"
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
                id="doc-in-email"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Mobile Connection (Bangladesh) *</label>
              <input 
                type="text" 
                value={phoneNumber}
                disabled
                className="w-full px-3 py-2 border border-slate-100 bg-slate-50 text-slate-500 rounded-lg text-sm cursor-not-allowed"
                id="doc-in-phone"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Phone credentials locked for sign-up security.</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">National ID (Bangladeshi NID)</label>
              <input 
                type="text" 
                value={nationalId}
                onChange={e => setNationalId(e.target.value)}
                placeholder="012345678901..."
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-sm text-slate-800"
                id="doc-in-nid"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Gender *</label>
              <select 
                value={gender}
                onChange={e => setGender(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-sm text-slate-800"
                id="doc-in-gender"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Date of Birth *</label>
              <input 
                type="date" 
                value={dateOfBirth}
                onChange={e => setDateOfBirth(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-sm text-slate-800"
                required
                id="doc-in-dob"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Profile Photo Image URL</label>
              <input 
                type="text" 
                value={profilePhotoUrl}
                onChange={e => setProfilePhotoUrl(e.target.value)}
                placeholder="https://example.com/photo.jpg"
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-sm text-slate-800"
                id="doc-in-photo"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Board Registration & Vitals */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6" id="doc-board-grid">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-emerald-600" />
            <h4 className="font-bold text-slate-900 text-sm tracking-tight uppercase">2. Regulatory & Clinical Credentials</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">BMDC Registration Code *</label>
              <input 
                type="text" 
                value={bmdcRegNumber}
                onChange={e => {
                  setBmdcRegNumber(e.target.value);
                  checkBMDCUniqueState(e.target.value);
                }}
                disabled={bmdcVerified}
                placeholder="e.g., A-12345"
                className={`w-full px-3 py-2 border rounded-lg text-sm outline-none ${
                  bmdcVerified 
                    ? 'border-slate-100 bg-slate-50 text-slate-500 cursor-not-allowed' 
                    : bmdcUniqueError 
                    ? 'border-red-300 text-red-900 focus:border-red-400' 
                    : 'border-slate-200 focus:border-emerald-500 text-slate-800'
                }`}
                required
                id="doc-in-bmdc"
              />
              {bmdcUniqueError && (
                <span className="text-[10px] text-red-600 mt-1 block font-medium animate-pulse">{bmdcUniqueError}</span>
              )}
              {bmdcVerified && (
                <span className="text-[10px] text-emerald-600 mt-1 block">BMDC code locked upon active verification.</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Years of Medical Practice *</label>
              <input 
                type="number" 
                value={experienceYears}
                onChange={e => setExperienceYears(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-sm text-slate-800"
                min="0"
                required
                id="doc-in-exp"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Academic Qualifications (MBBS, FCPS, MD, etc. - Comma Separated) *</label>
              <input 
                type="text" 
                value={qualificationsInput}
                onChange={e => setQualificationsInput(e.target.value)}
                placeholder="E.g., MBBS (Dhaka), FCPS (Cardiology)"
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-sm text-slate-800"
                required
                id="doc-in-qual"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Clinical Specialties (Comma Separated) *</label>
              <input 
                type="text" 
                value={specialitiesInput}
                onChange={e => setSpecialitiesInput(e.target.value)}
                placeholder="E.g., Cardiology, General Medicine"
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-sm text-slate-800"
                required
                id="doc-in-spec"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Primary Affiliated Hospital / Workplace *</label>
              <input 
                type="text" 
                value={currentWorkplace}
                onChange={e => setCurrentWorkplace(e.target.value)}
                placeholder="E.g., Dhaka Medical College Hospital"
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-sm text-slate-800"
                required
                id="doc-in-workplace"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Standard Consult Fee (BDT) *</label>
              <input 
                type="number" 
                value={consultationFee}
                onChange={e => setConsultationFee(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-sm text-slate-800"
                min="0"
                required
                id="doc-in-fee"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Languages Spoken (Comma Separated)</label>
              <input 
                type="text" 
                value={languagesInput}
                onChange={e => setLanguagesInput(e.target.value)}
                placeholder="E.g., Bangla, English"
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-sm text-slate-800"
                id="doc-in-lang"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Professional Biography</label>
              <textarea 
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={3}
                placeholder="Write a brief clinical summary or professional overview..."
                className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-sm text-slate-800 resize-none"
                id="doc-in-bio"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: Chambers Registration Builder */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6" id="doc-chambers-grid">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5 text-emerald-600" />
              <h4 className="font-bold text-slate-900 text-sm tracking-tight uppercase">3. Chamber Details & Schedule Timetables</h4>
            </div>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
              {chambers.length} ACTIVE {chambers.length === 1 ? 'CHAMBER' : 'CHAMBERS'}
            </span>
          </div>

          {/* List of current chambers */}
          {chambers.length === 0 ? (
            <div className="p-6 border border-dashed border-slate-200 rounded-xl text-center bg-slate-50/50" id="no-chambers-msg">
              <p className="text-xs text-slate-400">No medical chambers created. Provide medical facilities where patients can book appointments with you.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="chambers-cards-list">
              {chambers.map((ch, idx) => (
                <div key={idx} className="p-4 border border-slate-100 rounded-xl bg-slate-50 relative group" id={`chamber-card-${idx}`}>
                  <button 
                    type="button"
                    onClick={() => handleRemoveChamber(idx)}
                    className="absolute top-2 right-2 text-slate-400 hover:text-red-500 p-1 bg-white rounded-lg border border-slate-100 hover:border-red-100 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                    title="Remove Chamber"
                    id={`btn-rm-chamber-${idx}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <h5 className="font-bold text-slate-800 text-xs pr-6 uppercase tracking-wider">{ch.name}</h5>
                  <p className="text-xs text-slate-500 mt-1.5 flex items-start gap-1">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />
                    <span>{ch.address}, {ch.city}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <CreditCard className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>BDT {ch.consultationFee} TK Visit Fee</span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1" id={`days-slots-${idx}`}>
                    {ch.activeDays.map(day => (
                      <span key={day} className="text-[9px] bg-emerald-50 text-emerald-700 font-extrabold uppercase px-1.5 py-0.5 rounded-md border border-emerald-100/50">
                        {day.slice(0, 3)}
                      </span>
                    ))}
                    {ch.timeSlots.map(ts => (
                      <span key={ts} className="text-[9px] bg-slate-200 text-slate-700 font-mono px-1.5 py-0.5 rounded-md">
                        {ts}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Form to add a new chamber */}
          <div className="p-5 border border-slate-100 rounded-xl space-y-4 bg-emerald-50/10" id="add-chamber-box">
            <h5 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Register New Chamber Location
            </h5>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Chamber / Facility Name *</label>
                <input 
                  type="text" 
                  value={chamberName}
                  onChange={e => setChamberName(e.target.value)}
                  placeholder="E.g., Labaid Diagnostic, Uttara"
                  className="w-full px-3 py-1.5 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-xs"
                  id="ch-name"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">City Location *</label>
                <select 
                  value={chamberCity}
                  onChange={e => setChamberCity(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-xs bg-white"
                  id="ch-city"
                >
                  <option value="">Select City</option>
                  {citiesBD.map(city => <option key={city} value={city}>{city}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Physical Street Address *</label>
                <input 
                  type="text" 
                  value={chamberAddress}
                  onChange={e => setChamberAddress(e.target.value)}
                  placeholder="E.g., House 12, Road 4, Sector 7"
                  className="w-full px-3 py-1.5 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-xs"
                  id="ch-addr"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Chamber Visit Fee (BDT) *</label>
                <input 
                  type="number" 
                  value={chamberFee || ''}
                  onChange={e => setChamberFee(Number(e.target.value) || 0)}
                  placeholder="BDT"
                  className="w-full px-3 py-1.5 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-xs"
                  id="ch-fee"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Operating Work Days *</label>
                <div className="flex flex-wrap gap-1.5 mt-1" id="ch-days-row">
                  {weekDays.map(day => {
                    const isSelected = chamberDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleDayToggle(day)}
                        className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg border transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                        id={`btn-day-${day}`}
                      >
                        {day.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Operating Hours / Slots *</label>
                <input 
                  type="text" 
                  value={chamberTime}
                  onChange={e => setChamberTime(e.target.value)}
                  placeholder="E.g., 17:00-20:00"
                  className="w-full px-3 py-1.5 border border-slate-200 focus:border-emerald-500 outline-none rounded-lg text-xs font-mono"
                  id="ch-time"
                />
              </div>

              <div className="flex items-end shadow-xs">
                <button
                  type="button"
                  onClick={handleAddChamber}
                  className="w-full py-1.5 bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
                  id="btn-add-ch"
                >
                  <Plus className="h-4 w-4" /> Save Chamber Location
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Form Submission */}
        <div className="flex justify-end gap-3" id="doc-btn-panel">
          <button 
            type="submit" 
            disabled={saving || isPending}
            className={`px-6 py-3 font-bold text-sm text-white rounded-xl bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-600/15 duration-150 flex items-center gap-2 cursor-pointer ${
              (saving || isPending) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            id="doc-profile-submit-btn"
          >
            {(saving || isPending) ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving Credentials...
              </>
            ) : (
              'Save Profile Coordinates'
            )}
          </button>
        </div>

      </form>
    </div>
  );
};
