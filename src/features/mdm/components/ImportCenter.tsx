/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  AlertCircle, 
  CheckCircle2, 
  Database,
  ArrowRight,
  ClipboardPaste,
  HelpCircle
} from 'lucide-react';
import { MdmEntityType, ImportPreviewReport, ImportErrorRecord } from '../types';
import { 
  fetchReferenceCache, 
  validateCompany, 
  validateGeneric, 
  validateMedicine, 
  validateDisease,
  normalizeSymptomArray
} from '../validation';
import { submitToApprovalQueue, logMdmActivity } from '../mdmService';
import { useAuthStore } from '../../../store/authStore';

// CSV template content generators for simple download actions
const TEMPLATES: Record<MdmEntityType, { fileName: string; csv: string }> = {
  pharmaceutical_companies: {
    fileName: 'pharmaceutical_companies_template.csv',
    csv: `companyId,companyNameEnglish,companyNameBengali,companyShortName,dgdaRegistrationNumber,headquarters\nPC-SQUARE,Square Pharmaceuticals PLC,স্কয়ার ফার্মাসিউটিক্যালস পিএলসি,Square,DGDA-SQR-001,Dhaka Bangladesh\nPC-BEXIMCO,Beximco Pharmaceuticals Ltd,বেক্সিমকো ফার্মাসিউটিক্যালস লিমিটেড,Beximco,DGDA-BEX-002,Gazipur Bangladesh\nPC-INCEPTA,Incepta Pharmaceuticals Ltd,ইনসেপ্টা ফার্মাসিউটিক্যালস লিমিটেড,Incepta,DGDA-INC-003,Savar Bangladesh`
  },
  medicine_generics: {
    fileName: 'medicine_generics_template.csv',
    csv: `genericId,genericNameEnglish,genericNameBengali,therapeuticClass,pregnancyCategory\nGEN-PARACETAMOL,Paracetamol,প্যারাসিটামল,Analgesic & Antipyretic,B\nGEN-ATORVASTATIN,Atorvastatin,অ্যাটোরভাস্ট্যাটিন,Cardiovascular (Statin),X\nGEN-AMOXICILLIN,Amoxicillin,অ্যামোক্সিসিলিন,Antibiotic (Penicillin),B`
  },
  medicines: {
    fileName: 'medicines_template.csv',
    csv: `medicineId,brandNameEnglish,brandNameBengali,genericId,manufacturerId,strength,dosageForm,unitPrice\nMED-NAPA-500,Napa 500,নাপা ৫০০,GEN-PARACETAMOL,PC-SQUARE,500 mg,Tablet,1.2\nMED-SUDOCARD-10,Sudocard 10,সুডোকার্ড ১০,GEN-ATORVASTATIN,PC-BEXIMCO,10 mg,Tablet,14.5\nMED-MOXACIL-250,Moxacil 250,মক্সাসিল ২৫০,GEN-AMOXICILLIN,PC-SQUARE,250 mg,Capsule,4.5`
  },
  diseases: {
    fileName: 'diseases_template.csv',
    csv: `diseaseId,diseaseNameEnglish,diseaseNameBengali,icd10,icd11,symptoms,causes,riskFactors,prevention,severityLevel,emergencyWarnings\nDIS-DENGUE-01,Dengue Fever,ডেঙ্গু জ্বর,A90,1D20,"High Fever;Joint Pain;Rash","Aedes mosquito bite","Stagnant water near house","Use mosquito nets",high,"Bleeding;Persistent vomiting"\nDIS-CHOLERA-01,Cholera,কলেরা,A00,1A00,"Watery Diarrhea;Dehydration","Vibrio cholerae","Unsafe drinking water","Purify water",critical,"Rapid heart rate;Lethargy"\nDIS-DIABETES-T2,Type 2 Diabetes,টাইপ ২ ডায়াবেটিস,E11,5A51,"Increased thirst;Frequent urination","Insulin resistance","Obesity;Sedentary lifestyle","Healthy diet;Exercise",moderate,"Ketoacidosis;Confusion"`
  }
};

const PRESETS: Record<MdmEntityType, { label: string; text: string; description: string }[]> = {
  pharmaceutical_companies: [
    {
      label: 'Demo 1: Clean Valid Companies',
      description: 'Contains valid structural companies, correct DGDA keys, and perfect formatting.',
      text: `companyId,companyNameEnglish,companyNameBengali,companyShortName,dgdaRegistrationNumber,headquarters\nPC-RENATA,Renata Limited,রেনাটা লিমিটেড,Renata,DGDA-REN-004,Mirpur Dhaka\nPC-ACME,The ACME Laboratories Ltd,দি একমি ল্যাবরেটরিজ লিমিটেড,ACME,DGDA-ACM-005,Dhamrai Bangladesh`
    },
    {
      label: 'Demo 2: Malformed Record Examples',
      description: 'Contains invalid company ID structure (pc-123) and incorrect DGDA registration number.',
      text: `companyId,companyNameEnglish,companyNameBengali,companyShortName,dgdaRegistrationNumber,headquarters\npc_wrong_id,Wrong Corp Ltd,ভুল লিমিটেড,Wrong,INVALID_DGDA_111,Unknown headquarters\nPC-SQUARE,Square Pharmaceuticals PLC,স্কয়ার ফার্মাসিউটিক্যালস পিএলসি,Square,DGDA-SQR-001,Dhaka Bangladesh`
    }
  ],
  medicine_generics: [
    {
      label: 'Demo 1: Clean Valid Generics',
      description: 'Contains fully compliant generic molecules and valid pregnancy categories.',
      text: `genericId,genericNameEnglish,genericNameBengali,therapeuticClass,pregnancyCategory\nGEN-METFORMIN,Metformin Hydrochloride,মেটফরমিন হাইড্রোক্লোরাইড,Oral Antidiabetic,B\nGEN-OMEPRAZOLE,Omeprazole,ওমিপ্রাজল,Proton Pump Inhibitor,C`
    },
    {
      label: 'Demo 2: Malformed Category & ID',
      description: 'Includes a non-compliant ID format and a forged pregnancy category "Z".',
      text: `genericId,genericNameEnglish,genericNameBengali,therapeuticClass,pregnancyCategory\nGEN-Z,Malformed Generic,ভুল জেন,Test Category,Z\nGEN-ASPIRIN,Aspirin,অ্যাসপিরিন,Antiplatelet,D`
    }
  ],
  medicines: [
    {
      label: 'Demo 1: Clean Valid Medicine Brands',
      description: 'Compliant brands. Note: depends on PCs PC-SQUARE/BEXIMCO and generic GEN-PARACETAMOL.',
      text: `medicineId,brandNameEnglish,brandNameBengali,genericId,manufacturerId,strength,dosageForm,unitPrice\nMED-NAPA-EXT,Napa Extend,নাপা এক্সটেন্ড,GEN-PARACETAMOL,PC-SQUARE,665 mg,Tablet,2.5\nMED-FAST-500,Fast 500,ফাস্ট ৫০০,GEN-PARACETAMOL,PC-BEXIMCO,500 mg,Tablet,1.2`
    },
    {
      label: 'Demo 2: Broken Relations & Missing Fields',
      description: 'References a non-existing manufacturer and generic. Also misses unit price.',
      text: `medicineId,brandNameEnglish,brandNameBengali,genericId,manufacturerId,strength,dosageForm,unitPrice\nMED-BROKEN,Broken Brand,ভুল ব্র্যান্ড,GEN-GHOST,PC-SHADOW,10 mg,Tablet,\nMED-NAPA-X,Napa X,নাপা এক্স,GEN-PARACETAMOL,PC-SQUARE,plain-text-strength,Water,5.0`
    }
  ],
  diseases: [
    {
      label: 'Demo 1: Clean NDIS Diseases',
      description: 'Excellent ICD classifications with clinical arrays formatted correctly.',
      text: `diseaseId,diseaseNameEnglish,diseaseNameBengali,icd10,icd11,symptoms,causes,riskFactors,prevention,severityLevel,emergencyWarnings\nDIS-COVID-19,COVID-19,করোনাভাইরাস রোগ ২০১৯,U07.1,RA01,"Fever;Cough;Fatigue","SARS-CoV-2 infection","Old age;Comorbidities","Wearing masks;Vaccination",high,"Breathing difficulty;Chest pain"`
    },
    {
      label: 'Demo 2: Invalid ICD & Severity Level',
      description: 'Features a malformed ICD-10 code (100) and unapproved severity status "extreme".',
      text: `diseaseId,diseaseNameEnglish,diseaseNameBengali,icd10,icd11,symptoms,causes,riskFactors,prevention,severityLevel,emergencyWarnings\nDIS-HYPERTENSION,Hypertension,উচ্চ রক্তচাপ,100,BA00,"Headache;Dizziness","High sodium diet","Obesity;Stress","Low salt diet;Exercise",extreme,"Severe chest pain;Confusion"`
    }
  ]
};

export const ImportCenter: React.FC = () => {
  const { profile } = useAuthStore();
  const [selectedEntity, setSelectedEntity] = useState<MdmEntityType>('pharmaceutical_companies');
  const [inputText, setInputText] = useState('');
  const [isDragged, setIsDragged] = useState(false);
  const [report, setReport] = useState<ImportPreviewReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = (entity: MdmEntityType) => {
    const data = TEMPLATES[entity];
    const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', data.fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragged(true);
  };

  const handleDragLeave = () => {
    setIsDragged(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragged(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setInputText(text);
    };
    reader.readAsText(file);
  };

  // Raw Simple CSV Row Parser supporting simple double quotes fields
  const parseCSV = (csvText: string): any[] => {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const results: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      let matches = [];
      // Regex supporting fields inside double quotes containing commas, e.g. "Symptom 1;Symptom 2"
      const regex = /("([^"]*)"|([^,]+))/g;
      let match;
      let currentIndex = 0;
      
      // Simple splitting if no quotes are involved to keep it fast and resilient
      if (!line.includes('"')) {
        matches = line.split(',').map(s => s.trim());
      } else {
        const rowData: string[] = [];
        let cur = '';
        let insideQuotes = false;
        for (let charIndex = 0; charIndex < line.length; charIndex++) {
          const char = line[charIndex];
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === ',' && !insideQuotes) {
            rowData.push(cur.trim());
            cur = '';
          } else {
            cur += char;
          }
        }
        rowData.push(cur.trim());
        matches = rowData;
      }

      const rowObj: Record<string, any> = {};
      headers.forEach((header, index) => {
        rowObj[header] = matches[index] !== undefined ? matches[index] : null;
      });
      results.push(rowObj);
    }

    return results;
  };

  const handleRunValidation = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setReport(null);
    setSaveStatus(null);

    try {
      // Parse data
      let rows: any[] = [];
      if (inputText.trim().startsWith('[')) {
        try {
          rows = JSON.parse(inputText);
        } catch (e) {
          alert('Failed to parse JSON string. Please confirm syntax.');
          setLoading(false);
          return;
        }
      } else {
        rows = parseCSV(inputText);
      }

      if (rows.length === 0) {
        alert('Ingestion failure: No raw documents found inside file.');
        setLoading(false);
        return;
      }

      // Pre-fetch Firestore reference cache for relational checking
      const refCache = await fetchReferenceCache();

      const validationErrors: ImportErrorRecord[] = [];
      const seenIds = new Set<string>();
      const parsedPayloads: any[] = [];

      rows.forEach((row, index) => {
        const rowIndex = index + 1; // 1-indexed for row lines
        let rowErrors: ImportErrorRecord[] = [];

        if (selectedEntity === 'pharmaceutical_companies') {
          rowErrors = validateCompany(
            row, 
            rowIndex, 
            refCache.existingEntityIds.get('pharmaceutical_companies')!, 
            seenIds
          );
          if (rowErrors.length === 0) {
            seenIds.add(String(row.companyId).trim());
            parsedPayloads.push({
              companyId: String(row.companyId).trim(),
              companyNameEnglish: String(row.companyNameEnglish).trim(),
              companyNameBengali: String(row.companyNameBengali).trim(),
              companyShortName: String(row.companyShortName).trim(),
              dgdaRegistrationNumber: String(row.dgdaRegistrationNumber).trim(),
              headquarters: String(row.headquarters).trim()
            });
          }
        } else if (selectedEntity === 'medicine_generics') {
          rowErrors = validateGeneric(
            row, 
            rowIndex,
            refCache.existingEntityIds.get('medicine_generics')!, 
            seenIds
          );
          if (rowErrors.length === 0) {
            seenIds.add(String(row.genericId).trim());
            parsedPayloads.push({
              genericId: String(row.genericId).trim(),
              genericNameEnglish: String(row.genericNameEnglish).trim(),
              genericNameBengali: String(row.genericNameBengali).trim(),
              therapeuticClass: String(row.therapeuticClass).trim(),
              pregnancyCategory: String(row.pregnancyCategory).trim().toUpperCase()
            });
          }
        } else if (selectedEntity === 'medicines') {
          rowErrors = validateMedicine(
            row,
            rowIndex,
            refCache.existingEntityIds.get('medicines')!,
            seenIds,
            refCache.companyIds,
            refCache.genericIds
          );
          if (rowErrors.length === 0) {
            seenIds.add(String(row.medicineId).trim());
            parsedPayloads.push({
              medicineId: String(row.medicineId).trim(),
              brandNameEnglish: String(row.brandNameEnglish).trim(),
              brandNameBengali: String(row.brandNameBengali).trim(),
              genericId: String(row.genericId).trim(),
              manufacturerId: String(row.manufacturerId).trim(),
              strength: String(row.strength).trim(),
              dosageForm: String(row.dosageForm).trim(),
              unitPrice: Number(row.unitPrice)
            });
          }
        } else if (selectedEntity === 'diseases') {
          rowErrors = validateDisease(
            row,
            rowIndex,
            refCache.existingEntityIds.get('diseases')!,
            seenIds
          );
          if (rowErrors.length === 0) {
            seenIds.add(String(row.diseaseId).trim());
            parsedPayloads.push({
              diseaseId: String(row.diseaseId).trim(),
              diseaseNameEnglish: String(row.diseaseNameEnglish).trim(),
              diseaseNameBengali: String(row.diseaseNameBengali).trim(),
              icd10: String(row.icd10).trim().toUpperCase(),
              icd11: String(row.icd11 || '').trim().toUpperCase(),
              symptoms: normalizeSymptomArray(row.symptoms),
              causes: normalizeSymptomArray(row.causes),
              riskFactors: normalizeSymptomArray(row.riskFactors),
              prevention: normalizeSymptomArray(row.prevention),
              severityLevel: String(row.severityLevel).trim().toLowerCase(),
              emergencyWarnings: normalizeSymptomArray(row.emergencyWarnings)
            });
          }
        }

        validationErrors.push(...rowErrors);
      });

      const invalidRowCount = new Set(validationErrors.map(e => e.rowIndex)).size;
      const validRowCount = rows.length - invalidRowCount;

      setReport({
        previewJobId: `job_${crypto.randomUUID()}`,
        fileName: 'interactive_stream_upload',
        targetCollection: selectedEntity,
        totalParsedRows: rows.length,
        validRowCount,
        invalidRowCount,
        detectedDuplicates: validationErrors.filter(e => e.rejectionReason === 'duplicate').length,
        validationErrors,
        canProceed: invalidRowCount === 0,
        parsedPayloads
      });
    } catch (err) {
      console.error(err);
      alert('Internal processing glitch inside parser. Make sure format is correct.');
    } finally {
      setLoading(false);
    }
  };

  const handleStageToApprovalQueue = async () => {
    if (!report || report.parsedPayloads.length === 0 || !profile) return;
    setSaving(true);
    setSaveStatus('Submitting records to Firestore approval list...');

    try {
      let stagedCount = 0;
      for (const item of report.parsedPayloads) {
        // Doc ID corresponds directly to its master key
        const docId = item.companyId || item.genericId || item.medicineId || item.diseaseId;
        
        await submitToApprovalQueue({
          targetCollection: report.targetCollection,
          targetDocumentId: docId,
          requestedChangeType: 'create',
          pendingPayload: item,
          operatorUid: profile.uid,
          operatorName: profile.displayName || 'Data Entry Operator'
        });
        stagedCount++;
      }

      await logMdmActivity({
        actorId: profile.uid,
        actorName: profile.displayName || 'Data Entry Operator',
        actorRole: 'admin' as any,
        actionType: 'IMPORT_QUEUE',
        entityType: report.targetCollection,
        entityDocId: 'bulk_ingestion',
        details: `Successfully validating master imports: enqueued ${stagedCount} documents for review.`
      });

      setSaveStatus(`Success! Enqueued all ${stagedCount} items into Approval Center. Operator drafts submitted.`);
      setReport(null);
      setInputText('');
    } catch (e: any) {
      console.error(e);
      setSaveStatus(`Ingestion Failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const loadPreset = (presetText: string) => {
    setInputText(presetText);
    setReport(null);
  };

  return (
    <div className="space-y-6" id="mdm-import-center-pane">
      {/* Intro block */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            <span>Master Data Bulk Ingestor (Simulation Gate)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">Upload, run checks, and review clinical master catalogs safely before committing to live indices.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleDownloadTemplate(selectedEntity)}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 hover:border-slate-300 text-xs font-bold text-slate-700 bg-white rounded-xl hover:bg-slate-50 transition cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download CSV Template</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form: Parameters & Upload Stage */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-5">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Target Registry</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                {(['pharmaceutical_companies', 'medicine_generics', 'medicines', 'diseases'] as MdmEntityType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedEntity(type);
                      setReport(null);
                      setInputText('');
                    }}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer truncate ${
                      selectedEntity === type
                        ? 'border-emerald-600 bg-emerald-50/20 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Interactive Presets */}
            <div className="p-4 bg-amber-50/30 border border-amber-100 rounded-2xl space-y-2">
              <div className="flex items-center gap-1 text-amber-900 font-bold text-xs">
                <HelpCircle className="h-4 w-4" />
                <span>Interactive Presets (Simulation Fast-Track)</span>
              </div>
              <p className="text-[11px] text-amber-700/80">Choose clean or malformed sample dataset to test real-time validation checks instantly:</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {PRESETS[selectedEntity]?.map((preset, pIdx) => (
                  <button
                    key={pIdx}
                    onClick={() => loadPreset(preset.text)}
                    className="text-[11px] font-bold bg-white text-slate-700 px-3 py-1.5 border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition cursor-pointer"
                    title={preset.description}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ingestion Canvas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                <span>CSV Ingestor Editor</span>
                <span>Supports Excel CSV & JSON list format</span>
              </div>
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-6 transition flex flex-col items-center justify-center text-center cursor-pointer ${
                  isDragged ? 'border-emerald-500 bg-emerald-50/10' : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="bg-emerald-50 text-emerald-600 p-3 rounded-full mb-3 shadow-mono">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="text-sm font-bold text-slate-700">Drag & drop spreadsheet here, or browse local files</p>
                <p className="text-xs text-slate-400 mt-1">Accepts CSV, XLSX, or JSON datasets</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  accept=".csv,.json"
                  className="hidden" 
                />
              </div>

              {/* Text Area backup for immediate copying */}
              <div className="relative mt-3">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Or paste Excel column lines here directly (e.g. key1,key2,key3...)"
                  className="w-full h-44 p-4 border border-slate-200 bg-slate-950 text-slate-200 font-mono text-xs rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-inner"
                />
                <button
                  onClick={async () => {
                    const text = await navigator.clipboard.readText();
                    setInputText(text);
                  }}
                  className="absolute bottom-4 right-4 text-slate-400 hover:text-white bg-slate-800 p-1.5 rounded-lg text-xs"
                  title="Paste clipboard"
                >
                  <ClipboardPaste className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Run button */}
            <div className="flex justify-end pt-2 border-t border-slate-50">
              <button
                onClick={handleRunValidation}
                disabled={loading || !inputText.trim()}
                className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition shadow-md disabled:bg-slate-200 disabled:border-slate-200 disabled:text-slate-400 cursor-pointer flex items-center gap-2"
              >
                {loading ? 'Running validation rules...' : 'Validate and Preview Report'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Form: Real-time validation visual logger */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs h-full flex flex-col justify-between min-h-[400px]">
            <div>
              <div className="border-b border-slate-100 pb-3 mb-4">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest block">Audit Validation Report</span>
              </div>

              {saveStatus && (
                <div className="p-3 mb-4 text-xs font-bold bg-sky-50 text-sky-800 border-sky-100 border rounded-xl">
                  {saveStatus}
                </div>
              )}

              {report ? (
                <div className="space-y-5 animate-fade-in">
                  <div className={`p-4 rounded-2xl border flex items-start gap-3 shadow-xs ${
                    report.validationErrors.length === 0 
                      ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' 
                      : 'bg-red-50/50 border-red-100 text-red-800'
                  }`}>
                    {report.validationErrors.length === 0 ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-650 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <strong className="text-sm block font-black">
                        {report.validationErrors.length === 0 ? 'Verification PASSED (100% Secure)' : 'Verification FAILED'}
                      </strong>
                      <p className="text-xs mt-1 leading-normal opacity-90">
                        {report.validationErrors.length === 0 
                          ? 'This document batch is completely free of errors, schema violations, duplicates, or broken mappings. Staging is safe.' 
                          : `Detected ${report.validationErrors.length} errors. Review rows below before saving.`
                        }
                      </p>
                    </div>
                  </div>

                  {/* Summary grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[10px] text-slate-400 uppercase block font-sans">Parsed Rows</span>
                      <strong className="text-slate-800 text-sm block mt-0.5">{report.totalParsedRows}</strong>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[10px] text-slate-400 uppercase block font-sans">Error Count</span>
                      <strong className={`${report.validationErrors.length > 0 ? 'text-red-600' : 'text-emerald-600'} text-sm block mt-0.5`}>
                        {report.validationErrors.length}
                      </strong>
                    </div>
                  </div>

                  {/* Validation Error Logs Accordion */}
                  {report.validationErrors.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Diagnostic Details</h4>
                      <div className="max-h-52 overflow-y-auto space-y-1.5 border border-slate-100 p-2 rounded-xl bg-slate-50/50">
                        {report.validationErrors.map((err, errIdx) => (
                          <div key={errIdx} className="text-xs p-2.5 bg-white border border-slate-150 rounded-lg flex flex-col gap-1 shadow-xxs">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[10px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded uppercase font-bold">
                                Row {err.rowIndex}
                              </span>
                              <span className="font-sans font-bold text-red-600 capitalize text-[10px]">{err.rejectionReason}</span>
                            </div>
                            <p className="text-[11px] text-slate-700 font-semibold">{err.errorDetails}</p>
                            <span className="text-[10px] font-mono text-slate-400">Parameter: {err.malformedKey}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Provide CSV spreadsheet inputs above to evaluate database integrity checks.
                </div>
              )}
            </div>

            {/* Stage button */}
            {report && (
              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={handleStageToApprovalQueue}
                  disabled={!report.canProceed || saving || report.parsedPayloads.length === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-xs transition disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-700/10"
                >
                  <Database className="h-4 w-4" />
                  <span>{saving ? 'Staging payload...' : `Submit ${report.validRowCount} Items to Approval Queue`}</span>
                </button>
                {!report.canProceed && (
                  <p className="text-[10px] text-red-600 mt-2 text-center font-bold">
                    * Fix all validation errors inside editor before entering the Approval Queue. Zero-trust gate enforced.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
