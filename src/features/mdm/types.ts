/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRole } from '../../types';

export type MdmEntityType = 'pharmaceutical_companies' | 'medicine_generics' | 'medicines' | 'diseases';

export interface PharmaceuticalCompanyEntity {
  companyId: string;
  companyNameEnglish: string;
  companyNameBengali: string;
  companyShortName: string;
  dgdaRegistrationNumber: string;
  headquarters: string;
  isDemo?: boolean;
  lifeCycleState?: 'active' | 'archived' | 'deleted';
}

export interface MedicineGenericEntity {
  genericId: string;
  genericNameEnglish: string;
  genericNameBengali: string;
  therapeuticClass: string;
  pregnancyCategory: 'A' | 'B' | 'C' | 'D' | 'X' | 'N/A';
  isDemo?: boolean;
  lifeCycleState?: 'active' | 'archived' | 'deleted';
}

export interface MedicineEntity {
  medicineId: string;
  brandNameEnglish: string;
  brandNameBengali: string;
  genericId: string;
  manufacturerId: string; // companyId
  strength: string;
  dosageForm: string;
  unitPrice: number;
  isDemo?: boolean;
  lifeCycleState?: 'active' | 'archived' | 'deleted';
}

export interface DiseaseEntity {
  diseaseId: string;
  diseaseNameEnglish: string;
  diseaseNameBengali: string;
  icd10: string;
  icd11: string;
  symptoms: string[];
  causes: string[];
  riskFactors: string[];
  prevention: string[];
  severityLevel: 'low' | 'moderate' | 'high' | 'critical';
  emergencyWarnings: string[];
  searchTokens?: string[];
  bengaliSearchTokens?: string[];
  isDemo?: boolean;
  lifeCycleState?: 'active' | 'archived' | 'deleted';
}

export interface ImportErrorRecord {
  rowIndex: number;
  malformedKey: string;
  rejectionReason: 'duplicate' | 'missing_field' | 'invalid_format' | 'broken_relationship';
  errorDetails: string;
}

export interface ImportPreviewReport {
  previewJobId: string;
  fileName: string;
  targetCollection: MdmEntityType;
  totalParsedRows: number;
  validRowCount: number;
  invalidRowCount: number;
  detectedDuplicates: number;
  validationErrors: ImportErrorRecord[];
  canProceed: boolean;
  parsedPayloads: any[]; // The validated JSON payloads ready for save
}

export interface ApprovalQueueItem {
  queueId: string;
  targetCollection: MdmEntityType;
  targetDocumentId: string;
  requestedChangeType: 'create' | 'update' | 'archive' | 'restore' | 'delete';
  pendingPayload: Record<string, any>;
  operatorUid: string;
  operatorName: string;
  reviewerUid: string | null;
  reviewerName: string | null;
  reviewerComments: string | null;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'published';
  createdAt: string;
  updatedAt: string;
}

export interface MdmActivityLog {
  activityId: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  actionType: 'IMPORT_QUEUE' | 'MANUAL_DRAFT' | 'REVIEW_REJECT' | 'REVIEW_APPROVE' | 'PUBLISH' | 'ARCHIVE' | 'RESTORE' | 'SOFT_DELETE';
  entityType: MdmEntityType;
  entityDocId: string;
  details: string;
  timestamp: string; // ISO 8601 String
}
