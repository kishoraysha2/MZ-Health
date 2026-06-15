/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  ImportErrorRecord, 
  MdmEntityType, 
  PharmaceuticalCompanyEntity, 
  MedicineGenericEntity, 
  MedicineEntity, 
  DiseaseEntity 
} from './types';

// Regex constants
const REGEX_COMPANY_ID = /^PC-[A-Z0-9_\-]+$/;
const REGEX_GENERIC_ID = /^GEN-[A-Z0-9_\-]+$/;
const REGEX_MEDICINE_ID = /^MED-[A-Z0-9_\-]+$/;
const REGEX_DISEASE_ID = /^DIS-[A-Z0-9_\-]+$/;

const REGEX_DGDA = /^DGDA-[0-9A-Z\-]+$/i;
const REGEX_ICD10 = /^[A-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$/i;

// Strengths metric suffix checks
// Must contain numbers followed by standard medical units: mg, mcg, g, ml, %, iu, etc.
const REGEX_STRENGTH = /\d+(\.\d+)?\s*(mg|mcg|g|ml|%|iu|w\/v|v\/v)/i;

// Standard Allowed Dosage Forms
const ALLOWED_DOSAGE_FORMS = [
  'Tablet', 'Syrup', 'Capsule', 'Injection', 'Ointment', 
  'Drop', 'Gel', 'Inhaler', 'Suspension', 'Cream', 
  'Suppository', 'Powder', 'Solution', 'Aerosol', 'Lotion', 'Patch'
];

interface ReferenceCache {
  companyIds: Set<string>;
  genericIds: Set<string>;
  existingEntityIds: Map<MdmEntityType, Set<string>>;
}

/**
 * Pre-fetches references from Firestore for high-speed relational analysis
 */
export async function fetchReferenceCache(): Promise<ReferenceCache> {
  const cache: ReferenceCache = {
    companyIds: new Set<string>(),
    genericIds: new Set<string>(),
    existingEntityIds: new Map<MdmEntityType, Set<string>>([
      ['pharmaceutical_companies', new Set()],
      ['medicine_generics', new Set()],
      ['medicines', new Set()],
      ['diseases', new Set()],
    ])
  };

  try {
    // 1. Fetch Companies
    const companiesSnap = await getDocs(collection(db, 'pharmaceutical_companies'));
    companiesSnap.forEach(d => {
      cache.companyIds.add(d.id);
      cache.existingEntityIds.get('pharmaceutical_companies')?.add(d.id);
    });

    // 2. Fetch Generics
    const genericsSnap = await getDocs(collection(db, 'medicine_generics'));
    genericsSnap.forEach(d => {
      cache.genericIds.add(d.id);
      cache.existingEntityIds.get('medicine_generics')?.add(d.id);
    });

    // 3. Fetch Medicines for duplicate checker
    const medicinesSnap = await getDocs(collection(db, 'medicines'));
    medicinesSnap.forEach(d => {
      cache.existingEntityIds.get('medicines')?.add(d.id);
    });

    // 4. Fetch Diseases for duplicate checker
    const diseasesSnap = await getDocs(collection(db, 'diseases'));
    diseasesSnap.forEach(d => {
      cache.existingEntityIds.get('diseases')?.add(d.id);
    });
  } catch (err) {
    console.error('[MDM-VALIDATOR] Error fetching reference validation datasets:', err);
  }

  return cache;
}

/**
 * Validates a single pharmaceutical company record
 */
export function validateCompany(
  row: any,
  rowIndex: number,
  existingIds: Set<string>,
  seenIds: Set<string>
): ImportErrorRecord[] {
  const errors: ImportErrorRecord[] = [];

  // Required Field Checks
  const requiredFields = [
    'companyId', 'companyNameEnglish', 'companyNameBengali', 
    'companyShortName', 'dgdaRegistrationNumber', 'headquarters'
  ];

  for (const field of requiredFields) {
    if (row[field] === undefined || row[field] === null || String(row[field]).trim() === '') {
      errors.push({
        rowIndex,
        malformedKey: field,
        rejectionReason: 'missing_field',
        errorDetails: `Field '${field}' is mandatory for pharmaceutical companies.`
      });
    }
  }

  if (errors.length > 0) return errors; // Stop if core fields are missing

  const companyId = String(row.companyId).trim();
  const dgda = String(row.dgdaRegistrationNumber).trim();

  // Validate ID RegExp structure
  if (!REGEX_COMPANY_ID.test(companyId)) {
    errors.push({
      rowIndex,
      malformedKey: 'companyId',
      rejectionReason: 'invalid_format',
      errorDetails: `Company ID '${companyId}' must match the naming standard '^PC-[A-Z0-9_\\-]+$' (e.g., PC-SQUARE).`
    });
  }

  // Validate DGDA RegExp structure
  if (!REGEX_DGDA.test(dgda)) {
    errors.push({
      rowIndex,
      malformedKey: 'dgdaRegistrationNumber',
      rejectionReason: 'invalid_format',
      errorDetails: `DGDA Number '${dgda}' must conform to the format '^DGDA-[0-9A-Z\\-]+$' (e.g., DGDA-PC-091).`
    });
  }

  // Duplicate Check
  if (existingIds.has(companyId) || seenIds.has(companyId)) {
    errors.push({
      rowIndex,
      malformedKey: 'companyId',
      rejectionReason: 'duplicate',
      errorDetails: `Company ID '${companyId}' already exists in active production records or is duplicated in this batch.`
    });
  }

  return errors;
}

/**
 * Validates a single medicine generic record
 */
export function validateGeneric(
  row: any,
  rowIndex: number,
  existingIds: Set<string>,
  seenIds: Set<string>
): ImportErrorRecord[] {
  const errors: ImportErrorRecord[] = [];

  const requiredFields = [
    'genericId', 'genericNameEnglish', 'genericNameBengali', 
    'therapeuticClass', 'pregnancyCategory'
  ];

  for (const field of requiredFields) {
    if (row[field] === undefined || row[field] === null || String(row[field]).trim() === '') {
      errors.push({
        rowIndex,
        malformedKey: field,
        rejectionReason: 'missing_field',
        errorDetails: `Field '${field}' is mandatory for medicine generics.`
      });
    }
  }

  if (errors.length > 0) return errors;

  const genericId = String(row.genericId).trim();
  const pregCat = String(row.pregnancyCategory).trim().toUpperCase();

  // Validate ID RegExp structure
  if (!REGEX_GENERIC_ID.test(genericId)) {
    errors.push({
      rowIndex,
      malformedKey: 'genericId',
      rejectionReason: 'invalid_format',
      errorDetails: `Generic ID '${genericId}' must match the naming standard '^GEN-[A-Z0-9_\\-]+$' (e.g., GEN-PARACETAMOL).`
    });
  }

  // Validate Pregnancy Category Enum
  const allowedPregCategories = ['A', 'B', 'C', 'D', 'X', 'N/A'];
  if (!allowedPregCategories.includes(pregCat)) {
    errors.push({
      rowIndex,
      malformedKey: 'pregnancyCategory',
      rejectionReason: 'invalid_format',
      errorDetails: `Pregnancy category '${pregCat}' is invalid. Allowed: ${allowedPregCategories.join(', ')}.`
    });
  }

  // Duplicate Check
  if (existingIds.has(genericId) || seenIds.has(genericId)) {
    errors.push({
      rowIndex,
      malformedKey: 'genericId',
      rejectionReason: 'duplicate',
      errorDetails: `Generic ID '${genericId}' already exists in production database or is duplicated in this file.`
    });
  }

  return errors;
}

/**
 * Validates a single medicine catalog record
 */
export function validateMedicine(
  row: any,
  rowIndex: number,
  existingIds: Set<string>,
  seenIds: Set<string>,
  validCompanyIds: Set<string>,
  validGenericIds: Set<string>
): ImportErrorRecord[] {
  const errors: ImportErrorRecord[] = [];

  const requiredFields = [
    'medicineId', 'brandNameEnglish', 'brandNameBengali', 
    'genericId', 'manufacturerId', 'strength', 'dosageForm', 'unitPrice'
  ];

  for (const field of requiredFields) {
    if (row[field] === undefined || row[field] === null || String(row[field]).trim() === '') {
      errors.push({
        rowIndex,
        malformedKey: field,
        rejectionReason: 'missing_field',
        errorDetails: `Field '${field}' is mandatory for medicines.`
      });
    }
  }

  if (errors.length > 0) return errors;

  const medicineId = String(row.medicineId).trim();
  const brandNameEn = String(row.brandNameEnglish).trim();
  const brandNameBn = String(row.brandNameBengali).trim();
  const genericId = String(row.genericId).trim();
  const manufacturerId = String(row.manufacturerId).trim();
  const strength = String(row.strength).trim();
  const dosageForm = String(row.dosageForm).trim();
  const unitPrice = Number(row.unitPrice);

  // Validate ID RegExp structure
  if (!REGEX_MEDICINE_ID.test(medicineId)) {
    errors.push({
      rowIndex,
      malformedKey: 'medicineId',
      rejectionReason: 'invalid_format',
      errorDetails: `Medicine ID '${medicineId}' must match structure '^MED-[A-Z0-9_\\-]+$' (e.g., MED-NAPA-500).`
    });
  }

  // Validate Strength (must fit scientific formats)
  if (!REGEX_STRENGTH.test(strength)) {
    errors.push({
      rowIndex,
      malformedKey: 'strength',
      rejectionReason: 'invalid_format',
      errorDetails: `Strength '${strength}' must contain weights/volumes (e.g. 500 mg, 10 ml, 2%, 50 mcg).`
    });
  }

  // Validate Dosage Form
  const matchedForm = ALLOWED_DOSAGE_FORMS.find(f => f.toLowerCase() === dosageForm.toLowerCase());
  if (!matchedForm) {
    errors.push({
      rowIndex,
      malformedKey: 'dosageForm',
      rejectionReason: 'invalid_format',
      errorDetails: `Dosage form '${dosageForm}' is invalid. Standard clinical types: ${ALLOWED_DOSAGE_FORMS.slice(0, 8).join(', ')}...`
    });
  }

  // Validate Unit Price
  if (isNaN(unitPrice) || unitPrice <= 0) {
    errors.push({
      rowIndex,
      malformedKey: 'unitPrice',
      rejectionReason: 'invalid_format',
      errorDetails: `Unit price '${row.unitPrice}' must be a decimal number greater than 0.`
    });
  }

  // Validations: Referential Integrity checks
  if (!validGenericIds.has(genericId)) {
    errors.push({
      rowIndex,
      malformedKey: 'genericId',
      rejectionReason: 'broken_relationship',
      errorDetails: `Molecule ID '${genericId}' does not exist in any registered 'medicine_generics' database.`
    });
  }

  if (!validCompanyIds.has(manufacturerId)) {
    errors.push({
      rowIndex,
      malformedKey: 'manufacturerId',
      rejectionReason: 'broken_relationship',
      errorDetails: `Manufacturer ID '${manufacturerId}' does not match any official pharmaceutical company.`
    });
  }

  // Duplicate Check
  if (existingIds.has(medicineId) || seenIds.has(medicineId)) {
    errors.push({
      rowIndex,
      malformedKey: 'medicineId',
      rejectionReason: 'duplicate',
      errorDetails: `Medicine brand ID '${medicineId}' is already registered in the system or duplicated in current queue.`
    });
  }

  return errors;
}

/**
 * Validates a single disease intelligence record
 */
export function validateDisease(
  row: any,
  rowIndex: number,
  existingIds: Set<string>,
  seenIds: Set<string>
): ImportErrorRecord[] {
  const errors: ImportErrorRecord[] = [];

  const requiredFields = [
    'diseaseId', 'diseaseNameEnglish', 'diseaseNameBengali', 
    'icd10', 'icd11', 'symptoms', 'causes', 'riskFactors', 'prevention', 
    'severityLevel', 'emergencyWarnings'
  ];

  for (const field of requiredFields) {
    if (row[field] === undefined || row[field] === null || String(row[field]).trim() === '') {
      errors.push({
        rowIndex,
        malformedKey: field,
        rejectionReason: 'missing_field',
        errorDetails: `Field '${field}' is mandatory for national disease logs.`
      });
    }
  }

  if (errors.length > 0) return errors;

  const diseaseId = String(row.diseaseId).trim();
  const icd10 = String(row.icd10).trim();
  const severity = String(row.severityLevel).trim().toLowerCase();

  // Validate ID RegExp structure
  if (!REGEX_DISEASE_ID.test(diseaseId)) {
    errors.push({
      rowIndex,
      malformedKey: 'diseaseId',
      rejectionReason: 'invalid_format',
      errorDetails: `Disease ID '${diseaseId}' must match structure '^DIS-[A-Z0-9_\\-]+$' (e.g., DIS-CHOLERA-01).`
    });
  }

  // Validate ICD-10 Code
  if (!REGEX_ICD10.test(icd10)) {
    errors.push({
      rowIndex,
      malformedKey: 'icd10',
      rejectionReason: 'invalid_format',
      errorDetails: `ICD-10 Code '${icd10}' must conform to global alphanumeric classification standards (e.g., A00, I10.9).`
    });
  }

  // Validate Severity Level Enum
  const allowedSeverities = ['low', 'moderate', 'high', 'critical'];
  if (!allowedSeverities.includes(severity)) {
    errors.push({
      rowIndex,
      malformedKey: 'severityLevel',
      rejectionReason: 'invalid_format',
      errorDetails: `Severity level '${row.severityLevel}' is invalid. Allowed: ${allowedSeverities.join(', ')}.`
    });
  }

  // Duplicate Check
  if (existingIds.has(diseaseId) || seenIds.has(diseaseId)) {
    errors.push({
      rowIndex,
      malformedKey: 'diseaseId',
      rejectionReason: 'duplicate',
      errorDetails: `Disease entry ID '${diseaseId}' is already mapped in the NDIS master catalog or duplicated in this upload.`
    });
  }

  return errors;
}

/**
 * Normalizes multi-valued inputs that can be provided as raw string arrays, JSON strings, or comma-delimited strings
 */
export function normalizeSymptomArray(val: any): string[] {
  if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(v => String(v).trim()).filter(Boolean);
      } catch (e) {
        // Fall back to split
      }
    }
    return trimmed.split(/[;,]/).map(v => v.trim()).filter(Boolean);
  }
  return [];
}
