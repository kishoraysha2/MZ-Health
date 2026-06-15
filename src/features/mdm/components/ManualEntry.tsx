/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  FileEdit, 
  PlusCircle, 
  Archive, 
  RotateCcw,
  CheckCircle, 
  AlertCircle,
  Database,
  Search,
  UserCheck
} from 'lucide-react';
import { MdmEntityType } from '../types';
import { submitToApprovalQueue, logMdmActivity } from '../mdmService';
import { 
  validateCompany, 
  validateGeneric, 
  validateMedicine, 
  validateDisease,
  normalizeSymptomArray,
  fetchReferenceCache
} from '../validation';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuthStore } from '../../../store/authStore';

export const ManualEntry: React.FC = () => {
  const { profile } = useAuthStore();
  const [entityType, setEntityType] = useState<MdmEntityType>('pharmaceutical_companies');
  const [operation, setOperation] = useState<'create' | 'update' | 'archive' | 'restore'>('create');
  
  // Universal Form Payload States
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Live Records search for editing/archiving
  const [liveDocs, setLiveDocs] = useState<{ id: string; data: any }[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Fetch production list of documents for update/archive operations
  useEffect(() => {
    if (operation === 'create') {
      setSelectedDocId('');
      setFormData({});
      setErrors([]);
      return;
    }
    
    const fetchDocs = async () => {
      setLoadingDocs(true);
      try {
        const snap = await getDocs(collection(db, entityType));
        const list = snap.docs.map(d => ({ id: d.id, data: d.data() }));
        setLiveDocs(list);
      } catch (err) {
        console.error('Error fetching production logs:', err);
      } finally {
        setLoadingDocs(false);
      }
    };
    fetchDocs();
  }, [entityType, operation]);

  // Set form values when an existing record is chosen to be edited/archived
  const handleSelectExisting = (docId: string) => {
    setSelectedDocId(docId);
    const item = liveDocs.find(d => d.id === docId);
    if (item) {
      const data: Record<string, string> = {};
      Object.keys(item.data).forEach(key => {
        const val = item.data[key];
        if (Array.isArray(val)) {
          data[key] = val.join('; ');
        } else {
          data[key] = String(val);
        }
      });
      setFormData(data);
    }
  };

  const handleInputChange = (field: string, val: string) => {
    setFormData(prev => ({ ...prev, [field]: val }));
    setErrors([]);
    setSuccessMsg(null);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSubmitting(true);
    setErrors([]);
    setSuccessMsg(null);

    try {
      const activeId = operation === 'create' 
        ? (formData.companyId || formData.genericId || formData.medicineId || formData.diseaseId || '').trim()
        : selectedDocId;

      if (!activeId) {
        setErrors(['Entity ID is required. Please populate the primary identification field.']);
        setSubmitting(false);
        return;
      }

      // 1. Compile formatted payload representing the clinical details
      let formattedPayload: Record<string, any> = {};

      if (entityType === 'pharmaceutical_companies') {
        formattedPayload = {
          companyId: activeId,
          companyNameEnglish: (formData.companyNameEnglish || '').trim(),
          companyNameBengali: (formData.companyNameBengali || '').trim(),
          companyShortName: (formData.companyShortName || '').trim(),
          dgdaRegistrationNumber: (formData.dgdaRegistrationNumber || '').trim(),
          headquarters: (formData.headquarters || '').trim()
        };
      } else if (entityType === 'medicine_generics') {
        formattedPayload = {
          genericId: activeId,
          genericNameEnglish: (formData.genericNameEnglish || '').trim(),
          genericNameBengali: (formData.genericNameBengali || '').trim(),
          therapeuticClass: (formData.therapeuticClass || '').trim(),
          pregnancyCategory: (formData.pregnancyCategory || 'B').trim().toUpperCase()
        };
      } else if (entityType === 'medicines') {
        formattedPayload = {
          medicineId: activeId,
          brandNameEnglish: (formData.brandNameEnglish || '').trim(),
          brandNameBengali: (formData.brandNameBengali || '').trim(),
          genericId: (formData.genericId || '').trim(),
          manufacturerId: (formData.manufacturerId || '').trim(),
          strength: (formData.strength || '').trim(),
          dosageForm: (formData.dosageForm || '').trim(),
          unitPrice: Number(formData.unitPrice || 0)
        };
      } else if (entityType === 'diseases') {
        formattedPayload = {
          diseaseId: activeId,
          diseaseNameEnglish: (formData.diseaseNameEnglish || '').trim(),
          diseaseNameBengali: (formData.diseaseNameBengali || '').trim(),
          icd10: (formData.icd10 || '').trim().toUpperCase(),
          icd11: (formData.icd11 || '').trim().toUpperCase(),
          symptoms: normalizeSymptomArray(formData.symptoms || ''),
          causes: normalizeSymptomArray(formData.causes || ''),
          riskFactors: normalizeSymptomArray(formData.riskFactors || ''),
          prevention: normalizeSymptomArray(formData.prevention || ''),
          severityLevel: (formData.severityLevel || 'moderate').trim().toLowerCase(),
          emergencyWarnings: normalizeSymptomArray(formData.emergencyWarnings || '')
        };
      }

      // Archive/Restore operation modifications
      if (operation === 'archive') {
        formattedPayload.lifeCycleState = 'archived';
      } else if (operation === 'restore') {
        formattedPayload.lifeCycleState = 'active';
      }

      // 2. Perform stringent dry-run validations
      const validationCache = await fetchReferenceCache();
      const emptySet = new Set<string>(); // Ignore pre-existing key for update/archive
      const targetExistingSet = operation === 'create' 
        ? validationCache.existingEntityIds.get(entityType)! 
        : emptySet;

      let valErrors: any[] = [];

      if (entityType === 'pharmaceutical_companies') {
        valErrors = validateCompany(formattedPayload, 1, targetExistingSet, emptySet);
      } else if (entityType === 'medicine_generics') {
        valErrors = validateGeneric(formattedPayload, 1, targetExistingSet, emptySet);
      } else if (entityType === 'medicines') {
        valErrors = validateMedicine(
          formattedPayload, 1, targetExistingSet, emptySet, 
          validationCache.companyIds, validationCache.genericIds
        );
      } else if (entityType === 'diseases') {
        valErrors = validateDisease(formattedPayload, 1, targetExistingSet, emptySet);
      }

      if (valErrors.length > 0) {
        setErrors(valErrors.map(e => `${e.malformedKey.toUpperCase()}: ${e.errorDetails}`));
        setSubmitting(false);
        return;
      }

      // 3. Stage changes inside approval_queues
      const queueId = await submitToApprovalQueue({
        targetCollection: entityType,
        targetDocumentId: activeId,
        requestedChangeType: operation,
        pendingPayload: formattedPayload,
        operatorUid: profile.uid,
        operatorName: profile.displayName || 'Data Entry Operator'
      });

      setSuccessMsg(`Staged manual submission successfully into Approval Center! Draft key generated: [${queueId}]. Status: Pending Admin Review.`);
      setFormData({});
      setSelectedDocId('');
    } catch (err: any) {
      console.error(err);
      setErrors([`Processing Failure: ${err.message}`]);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDocs = liveDocs.filter(d => 
    d.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    JSON.stringify(d.data).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" id="mdm-manual-entry-pane">
      {/* Visual Hub Header */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-indigo-650" />
            <span>Healthcare Manual Composition Terminal</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">Stagger single record creation, updates, and soft archivals with real-time referential validation checks.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Hand: Controls & Document Selection */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-6">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">1. Choose Registry</span>
              <select
                value={entityType}
                onChange={(e) => {
                  setEntityType(e.target.value as MdmEntityType);
                  setOperation('create');
                  setFormData({});
                  setErrors([]);
                  setSuccessMsg(null);
                }}
                className="w-full text-xs font-bold border border-slate-200 rounded-xl p-3 bg-white text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="pharmaceutical_companies">Pharmaceutical Companies</option>
                <option value="medicine_generics">Medicine Generics</option>
                <option value="medicines">Medicines & Brands</option>
                <option value="diseases">Disease Classification (NDIS)</option>
              </select>
            </div>

            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">2. Clinical Operation</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'create', label: 'Add New Record', icon: PlusCircle },
                  { id: 'update', label: 'Modify Record', icon: FileEdit },
                  { id: 'archive', label: 'Archive Record', icon: Archive },
                  { id: 'restore', label: 'Restore Record', icon: RotateCcw }
                ].map((op) => (
                  <button
                    key={op.id}
                    onClick={() => {
                      setOperation(op.id as any);
                      setFormData({});
                      setErrors([]);
                      setSuccessMsg(null);
                    }}
                    className={`p-3 text-xs font-bold rounded-xl border flex flex-col items-center justify-center gap-2 transition cursor-pointer ${
                      operation === op.id
                        ? 'border-indigo-600 bg-indigo-50/20 text-indigo-800'
                        : 'border-slate-150 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <op.icon className="h-4 w-4" />
                    <span>{op.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* List selector if editing, archiving or restoring */}
            {operation !== 'create' && (
              <div className="space-y-3 pt-4 border-t border-slate-50">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">3. Select Active Record</span>
                
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search production data..."
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 pl-8 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-3" />
                </div>

                {loadingDocs ? (
                  <div className="text-center text-xs text-slate-400 py-6">Connecting indices...</div>
                ) : filteredDocs.length === 0 ? (
                  <div className="text-center text-[11px] text-slate-400 py-6">No matching production records found.</div>
                ) : (
                  <div className="max-h-52 overflow-y-auto space-y-1 pr-1 border border-slate-100 p-2 rounded-xl bg-slate-50/50">
                    {filteredDocs.map((docItem) => (
                      <button
                        key={docItem.id}
                        type="button"
                        onClick={() => handleSelectExisting(docItem.id)}
                        className={`w-full text-left text-xs p-2.5 rounded-lg border transition cursor-pointer font-mono flex items-center justify-between ${
                          selectedDocId === docItem.id
                            ? 'bg-indigo-650 text-white border-indigo-650'
                            : 'bg-white text-slate-700 border-slate-150 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">{docItem.id}</span>
                        <span className="text-[10px] uppercase font-sans font-bold opacity-75">
                          {docItem.data.companyShortName || docItem.data.genericNameEnglish || docItem.data.brandNameEnglish || docItem.data.diseaseNameEnglish || ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Hand: Composition Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleManualSubmit} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs h-full flex flex-col justify-between" id="manual-entry-composition-form">
            <div className="space-y-5">
              <div className="border-b border-slate-105 pb-3 flex justify-between items-center bg-slate-50/50 -m-6 mb-4 p-6 rounded-t-2xl">
                <div>
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest block">Active Composition Blueprint</h3>
                  <span className="text-[10px] text-slate-400 capitalize font-mono block mt-1">{operation} on {entityType.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold font-mono text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-full uppercase">
                  <Database className="h-3 w-3" />
                  <span>Interactive Editor</span>
                </div>
              </div>

              {/* Status Display */}
              {errors.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-800 rounded-2xl space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Clinical Registry Violations Check ({errors.length})</span>
                  </div>
                  <ul className="text-[11px] list-disc list-inside mt-2 space-y-1 pl-1">
                    {errors.map((error, idx) => (
                      <li key={idx} className="font-semibold leading-normal">{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {successMsg && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl flex items-start gap-2 animate-fade-in shadow-xs">
                  <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <strong className="text-xs font-black block">Composition Completed</strong>
                    <p className="text-[11px] mt-1 pr-4 font-semibold leading-normal">{successMsg}</p>
                  </div>
                </div>
              )}

              {/* Dynamic input blocks based on chosen entity */}
              {operation !== 'create' && !selectedDocId ? (
                <div className="py-20 text-center text-xs text-slate-400">
                  Select an active production document from the left list block to begin auditing.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {entityType === 'pharmaceutical_companies' && (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Company Key ID</label>
                        <input
                          type="text"
                          disabled={operation !== 'create'}
                          value={formData.companyId || ''}
                          onChange={(e) => handleInputChange('companyId', e.target.value)}
                          placeholder="e.g. PC-SQUARE"
                          className="w-full text-xs font-mono border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 disabled:bg-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Company Name (English)</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.companyNameEnglish || ''}
                          onChange={(e) => handleInputChange('companyNameEnglish', e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Company Name (Bengali)</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.companyNameBengali || ''}
                          onChange={(e) => handleInputChange('companyNameBengali', e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Company Short Code</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.companyShortName || ''}
                          onChange={(e) => handleInputChange('companyShortName', e.target.value)}
                          placeholder="e.g. Square"
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">DGDA License Number</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.dgdaRegistrationNumber || ''}
                          onChange={(e) => handleInputChange('dgdaRegistrationNumber', e.target.value)}
                          placeholder="e.g. DGDA-SQR-001"
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Headquarters Location</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.headquarters || ''}
                          onChange={(e) => handleInputChange('headquarters', e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                    </>
                  )}

                  {entityType === 'medicine_generics' && (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Molecule generic Key ID</label>
                        <input
                          type="text"
                          disabled={operation !== 'create'}
                          value={formData.genericId || ''}
                          onChange={(e) => handleInputChange('genericId', e.target.value)}
                          placeholder="e.g. GEN-PARACETAMOL"
                          className="w-full text-xs font-mono border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 disabled:bg-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Generic Name (English)</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.genericNameEnglish || ''}
                          onChange={(e) => handleInputChange('genericNameEnglish', e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Generic Name (Bengali)</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.genericNameBengali || ''}
                          onChange={(e) => handleInputChange('genericNameBengali', e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Therapeutic Classification</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.therapeuticClass || ''}
                          onChange={(e) => handleInputChange('therapeuticClass', e.target.value)}
                          placeholder="e.g. Analgesic & Antipyretic"
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Pregnancy Safety Category</label>
                        <select
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.pregnancyCategory || 'B'}
                          onChange={(e) => handleInputChange('pregnancyCategory', e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-white cursor-pointer font-bold text-slate-700"
                        >
                          <option value="A">Safety Class A (Perfect)</option>
                          <option value="B">Class B (Generally Safe)</option>
                          <option value="C">Class C (Caution Required)</option>
                          <option value="D">Class D (High Risk)</option>
                          <option value="X">Class X (Contraindicated)</option>
                          <option value="N/A">Not Evaluated (N/A)</option>
                        </select>
                      </div>
                    </>
                  )}

                  {entityType === 'medicines' && (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Medicine Brand Key ID</label>
                        <input
                          type="text"
                          disabled={operation !== 'create'}
                          value={formData.medicineId || ''}
                          onChange={(e) => handleInputChange('medicineId', e.target.value)}
                          placeholder="e.g. MED-NAPA-500"
                          className="w-full text-xs font-mono border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 disabled:bg-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Brand Name (English)</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.brandNameEnglish || ''}
                          onChange={(e) => handleInputChange('brandNameEnglish', e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Brand Name (Bengali)</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.brandNameBengali || ''}
                          onChange={(e) => handleInputChange('brandNameBengali', e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Generic Molecule Relation Key</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.genericId || ''}
                          onChange={(e) => handleInputChange('genericId', e.target.value)}
                          placeholder="e.g. GEN-PARACETAMOL"
                          className="w-full text-xs font-mono border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Manufacturer corporate Key</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.manufacturerId || ''}
                          onChange={(e) => handleInputChange('manufacturerId', e.target.value)}
                          placeholder="e.g. PC-SQUARE"
                          className="w-full text-xs font-mono border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Strength (Weights & Measures)</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.strength || ''}
                          onChange={(e) => handleInputChange('strength', e.target.value)}
                          placeholder="e.g. 500 mg, 10 ml, 2%"
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Dosage Form</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.dosageForm || ''}
                          onChange={(e) => handleInputChange('dosageForm', e.target.value)}
                          placeholder="e.g. Tablet, Syrup, Capsule"
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Unit Selling Price (BDT Decimals)</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.unitPrice || ''}
                          onChange={(e) => handleInputChange('unitPrice', e.target.value)}
                          placeholder="e.g. 1.25"
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5 font-mono"
                        />
                      </div>
                    </>
                  )}

                  {entityType === 'diseases' && (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Disease Mapping Key ID</label>
                        <input
                          type="text"
                          disabled={operation !== 'create'}
                          value={formData.diseaseId || ''}
                          onChange={(e) => handleInputChange('diseaseId', e.target.value)}
                          placeholder="e.g. DIS-DIABETES"
                          className="w-full text-xs font-mono border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 disabled:bg-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Disease Name (English)</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.diseaseNameEnglish || ''}
                          onChange={(e) => handleInputChange('diseaseNameEnglish', e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Disease Name (Bengali)</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.diseaseNameBengali || ''}
                          onChange={(e) => handleInputChange('diseaseNameBengali', e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">ICD-10 Global Code</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.icd10 || ''}
                          onChange={(e) => handleInputChange('icd10', e.target.value)}
                          placeholder="e.g. I10, A00"
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5 font-mono uppercase"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">ICD-11 Code Option</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.icd11 || ''}
                          onChange={(e) => handleInputChange('icd11', e.target.value)}
                          placeholder="e.g. BA00"
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5 font-mono uppercase"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Clinical Symptoms (Semicolon Split)</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.symptoms || ''}
                          onChange={(e) => handleInputChange('symptoms', e.target.value)}
                          placeholder="e.g. Headache; Joint Pain; Rash"
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Aggravators & Causes (Semicolon Split)</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.causes || ''}
                          onChange={(e) => handleInputChange('causes', e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Vulnerabilities & Risk Factors</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.riskFactors || ''}
                          onChange={(e) => handleInputChange('riskFactors', e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Preventative Measures</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.prevention || ''}
                          onChange={(e) => handleInputChange('prevention', e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">National Severity Level</label>
                        <select
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.severityLevel || 'moderate'}
                          onChange={(e) => handleInputChange('severityLevel', e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-white cursor-pointer font-bold text-slate-700"
                        >
                          <option value="low">Severity level: LOW</option>
                          <option value="moderate">Severity level: MODERATE</option>
                          <option value="high">Severity level: HIGH</option>
                          <option value="critical">Severity level: CRITICAL</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Emergency Red Warnings</label>
                        <input
                          type="text"
                          disabled={operation === 'archive' || operation === 'restore'}
                          value={formData.emergencyWarnings || ''}
                          onChange={(e) => handleInputChange('emergencyWarnings', e.target.value)}
                          placeholder="e.g. Chest Pain; Seizures; Confusion"
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Complete submit triggers */}
            {(operation === 'create' || selectedDocId) && (
              <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-4 mt-6">
                <span className="text-[10px] text-slate-400 italic font-mono font-bold">
                  * Multi-sign verification required before database ingestion
                </span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-650 hover:bg-indigo-500 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition disabled:bg-slate-200 disabled:text-slate-400 flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-700/10"
                >
                  <UserCheck className="h-4 w-4" />
                  <span>{submitting ? 'Authenticating composition draft...' : 'Submit Draft for Review'}</span>
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
