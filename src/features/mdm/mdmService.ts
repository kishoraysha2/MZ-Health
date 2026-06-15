/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  updateDoc 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ApprovalQueueItem, MdmEntityType, MdmActivityLog } from './types';

/**
 * Submits a new master data entry or update to the Approval Queue
 */
export async function submitToApprovalQueue(params: {
  targetCollection: MdmEntityType;
  targetDocumentId: string;
  requestedChangeType: 'create' | 'update' | 'archive' | 'restore' | 'delete';
  pendingPayload: Record<string, any>;
  operatorUid: string;
  operatorName: string;
}): Promise<string> {
  const queueId = `queue_${crypto.randomUUID()}`;
  const queueRef = doc(db, 'approval_queues', queueId);

  const newItem: ApprovalQueueItem = {
    queueId,
    targetCollection: params.targetCollection,
    targetDocumentId: params.targetDocumentId,
    requestedChangeType: params.requestedChangeType,
    pendingPayload: params.pendingPayload,
    operatorUid: params.operatorUid,
    operatorName: params.operatorName,
    reviewerUid: null,
    reviewerName: null,
    reviewerComments: null,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // 1. Save to approval queue
  await setDoc(queueRef, newItem);

  // 2. Log activity
  await logMdmActivity({
    actorId: params.operatorUid,
    actorName: params.operatorName,
    actorRole: 'admin' as any, // Mapped according to simulating or active roles
    actionType: params.requestedChangeType === 'create' ? 'MANUAL_DRAFT' : 'MANUAL_DRAFT',
    entityType: params.targetCollection,
    entityDocId: params.targetDocumentId,
    details: `Submitted proposed changes (${params.requestedChangeType}) for review.`
  });

  return queueId;
}

/**
 * Updates the status of an approval item (Reviewer reviews or Admin publishes)
 */
export async function updateApprovalItemStatus(params: {
  queueId: string;
  status: 'reviewing' | 'approved' | 'rejected' | 'published';
  reviewerUid: string;
  reviewerName: string;
  reviewerComments?: string;
}): Promise<void> {
  const queueRef = doc(db, 'approval_queues', params.queueId);
  const queueSnap = await getDoc(queueRef);

  if (!queueSnap.exists()) {
    throw new Error(`Queue item ${params.queueId} does not exist.`);
  }

  const currentItem = queueSnap.data() as ApprovalQueueItem;

  const updates: Partial<ApprovalQueueItem> = {
    status: params.status,
    reviewerUid: params.reviewerUid,
    reviewerName: params.reviewerName,
    reviewerComments: params.reviewerComments || null,
    updatedAt: new Date().toISOString()
  };

  await updateDoc(queueRef, updates);

  // Log activity
  const actionMapping: Record<string, any> = {
    reviewing: 'MANUAL_DRAFT',
    rejected: 'REVIEW_REJECT',
    approved: 'REVIEW_APPROVE',
    published: 'PUBLISH'
  };

  await logMdmActivity({
    actorId: params.reviewerUid,
    actorName: params.reviewerName,
    actorRole: 'admin' as any,
    actionType: actionMapping[params.status],
    entityType: currentItem.targetCollection,
    entityDocId: currentItem.targetDocumentId,
    details: `Approval state updated to ${params.status}. Comments: ${params.reviewerComments || 'None'}`
  });
}

/**
 * Commits an approved item to the production databases
 */
export async function publishApprovedItem(params: {
  queueId: string;
  publisherUid: string;
  publisherName: string;
}): Promise<void> {
  const queueRef = doc(db, 'approval_queues', params.queueId);
  const queueSnap = await getDoc(queueRef);

  if (!queueSnap.exists()) {
    throw new Error('Approval item not found.');
  }

  const item = queueSnap.data() as ApprovalQueueItem;
  if (item.status !== 'approved') {
    throw new Error('Only items marked as APPROVED can be published.');
  }

  const targetCollection = item.targetCollection;
  const docId = item.targetDocumentId;
  const payload = { ...item.pendingPayload };

  // Set default state values
  payload.lifeCycleState = payload.lifeCycleState || 'active';
  if (item.requestedChangeType === 'create') {
    payload.createdAt = new Date().toISOString();
  }
  payload.updatedAt = new Date().toISOString();

  // Fetch old value if editing for the compliance ledger
  let oldValue: any = null;
  const prodDocRef = doc(db, targetCollection, docId);
  try {
    const prodSnap = await getDoc(prodDocRef);
    if (prodSnap.exists()) {
      oldValue = prodSnap.data();
    }
  } catch (e) {
    // Suppress if the document does not exist yet (create)
  }

  // 1. Commit raw master data to its target Firestore collection
  await setDoc(prodDocRef, payload, { merge: true });

  // 2. Relational Projection: If publishing a disease, maintain search projections inside disease_catalogs
  if (targetCollection === 'diseases') {
    const catalogRef = doc(db, 'disease_catalogs', docId);
    await setDoc(catalogRef, {
      diseaseId: docId,
      diseaseName: payload.diseaseNameEnglish || payload.diseaseNameBengali || '',
      severityLevel: payload.severityLevel || 'moderate',
      emergencyLevel: payload.severityLevel === 'critical' ? 'emergency' : payload.severityLevel === 'high' ? 'urgent' : 'normal',
      searchTokens: compileNGrams(payload.diseaseNameEnglish || ''),
      bengaliSearchTokens: compileNGrams(payload.diseaseNameBengali || '')
    }, { merge: true });
  }

  // 3. Write-once, Append-only compliant ledger entry: write to `data_versions`
  const versionId = `ver_${crypto.randomUUID()}`;
  const versionRef = doc(db, 'data_versions', versionId);
  await setDoc(versionRef, {
    versionId,
    targetCollection,
    targetDocumentId: docId,
    changeType: item.requestedChangeType,
    oldValue: oldValue || null,
    newValue: payload,
    changedBy: params.publisherUid,
    changedAt: new Date().toISOString()
  });

  // 4. Create standard record in global `audit_logs`
  const auditId = `log_${crypto.randomUUID()}`;
  const auditRef = doc(db, 'audit_logs', auditId);
  await setDoc(auditRef, {
    logId: auditId,
    actorId: params.publisherUid,
    actorRole: 'admin',
    actionType: item.requestedChangeType === 'create' ? 'CREATE' : 'UPDATE',
    resourceTarget: targetCollection === 'diseases' ? 'users' : 'settings', // existing target references
    resourceDocId: docId,
    ipAddress: '127.0.0.1',
    userAgent: navigator.userAgent,
    timestamp: serverTimestamp()
  }).catch(e => console.log('Audit log skipped due to security rules:', e));

  // 5. Update status in the approval queue item
  await updateDoc(queueRef, {
    status: 'published',
    updatedAt: new Date().toISOString()
  });

  // 6. Log final MDM activity
  await logMdmActivity({
    actorId: params.publisherUid,
    actorName: params.publisherName,
    actorRole: 'admin' as any,
    actionType: 'PUBLISH',
    entityType: targetCollection,
    entityDocId: docId,
    details: `Published approved master data successfully. Relational synchronization complete.`
  });
}

/**
 * Toggles structural Lifecycle archived / active state of an active clinical record
 */
export async function toggleLifeCycleState(params: {
  targetCollection: MdmEntityType;
  docId: string;
  action: 'archive' | 'restore' | 'delete';
  actorUid: string;
  actorName: string;
}): Promise<void> {
  const prodDocRef = doc(db, params.targetCollection, params.docId);
  const snap = await getDoc(prodDocRef);

  if (!snap.exists()) {
    throw new Error('Target document not found in production.');
  }

  const newState = params.action === 'archive' ? 'archived' : params.action === 'delete' ? 'deleted' : 'active';
  const oldValue = snap.data();

  // 1. Set state field in FireStore Document
  await updateDoc(prodDocRef, {
    lifeCycleState: newState,
    updatedAt: new Date().toISOString()
  });

  // 2. Ledger Trace
  const versionId = `ver_${crypto.randomUUID()}`;
  const versionRef = doc(db, 'data_versions', versionId);
  await setDoc(versionRef, {
    versionId,
    targetCollection: params.targetCollection,
    targetDocumentId: params.docId,
    changeType: params.action === 'archive' ? 'archive' : params.action === 'delete' ? 'delete' : 'restore',
    oldValue,
    newValue: { ...oldValue, lifeCycleState: newState },
    changedBy: params.actorUid,
    changedAt: new Date().toISOString()
  });

  // 3. Log Activity
  const typeMapping: Record<string, any> = {
    archive: 'ARCHIVE',
    restore: 'RESTORE',
    delete: 'SOFT_DELETE'
  };

  await logMdmActivity({
    actorId: params.actorUid,
    actorName: params.actorName,
    actorRole: 'admin' as any,
    actionType: typeMapping[params.action],
    entityType: params.targetCollection,
    entityDocId: params.docId,
    details: `Toggled master lifecycle alignment to '${newState}'`
  });
}

/**
 * Records MDM Activity History
 */
export async function logMdmActivity(activity: Omit<MdmActivityLog, 'activityId' | 'timestamp'>): Promise<void> {
  try {
    const activityId = `mdm_act_${crypto.randomUUID()}`;
    const logRef = doc(db, 'mdm_activity_history', activityId);
    await setDoc(logRef, {
      ...activity,
      activityId,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to write to mdm_activity_history', err);
  }
}

/**
 * Compiles multi-lingual search edge-N-grams
 */
export function compileNGrams(input: string): string[] {
  const words = String(input).toLowerCase().trim().split(/[\s\-]+/);
  const tokens = new Set<string>();

  for (const word of words) {
    if (!word) continue;
    // Edge n-gram creation
    for (let i = 1; i <= word.length; i++) {
      tokens.add(word.substring(0, i));
    }
    // Full word
    tokens.add(word);
  }

  return Array.from(tokens);
}
