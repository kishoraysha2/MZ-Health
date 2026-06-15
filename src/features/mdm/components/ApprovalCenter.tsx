/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText, 
  CheckCheck,
  ChevronRight,
  MessageSquare,
  AlertTriangle,
  Layers,
  UserCheck
} from 'lucide-react';
import { collection, getDocs, orderBy, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { ApprovalQueueItem } from '../types';
import { updateApprovalItemStatus, publishApprovedItem } from '../mdmService';
import { useAuthStore } from '../../../store/authStore';

export const ApprovalCenter: React.FC = () => {
  const { profile } = useAuthStore();
  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ApprovalQueueItem | null>(null);
  const [reviewerComment, setReviewerComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Live Subscription of the approval queue so clicks are responsive
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'approval_queues'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => d.data() as ApprovalQueueItem);
      setItems(list);
      
      // Update currently viewed item with updated database state if selected
      if (selectedItem) {
        const fresh = list.find(x => x.queueId === selectedItem.queueId);
        if (fresh) setSelectedItem(fresh);
      }
      setLoading(false);
    }, (err) => {
      console.error('Error fetching approval queue subscription:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleReviewAction = async (status: 'approved' | 'rejected') => {
    if (!selectedItem || !profile) return;
    setProcessingId(selectedItem.queueId);

    try {
      await updateApprovalItemStatus({
        queueId: selectedItem.queueId,
        status,
        reviewerUid: profile.uid,
        reviewerName: profile.displayName || 'Clinical Reviewer',
        reviewerComments: reviewerComment.trim() || 'No reviews comments logged.'
      });
      setReviewerComment('');
    } catch (e: any) {
      alert(`Approval Update Failed: ${e.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handlePublishCommit = async () => {
    if (!selectedItem || !profile) return;
    setProcessingId(selectedItem.queueId);

    try {
      await publishApprovedItem({
        queueId: selectedItem.queueId,
        publisherUid: profile.uid,
        publisherName: profile.displayName || 'Chief Admin'
      });
      
      alert('Document successfully committed and published to active databases! Version logs written to compliance ledger.');
    } catch (e: any) {
      alert(`Production Publish Failed: ${e.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // Helper colors
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'approved': return 'bg-emerald-50 text-emerald-800 border-emerald-250';
      case 'rejected': return 'bg-red-50 text-red-800 border-red-200';
      case 'published': return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-3 w-3 text-amber-600" />;
      case 'approved': return <CheckCircle className="h-3 w-3 text-emerald-600" />;
      case 'rejected': return <XCircle className="h-3 w-3 text-red-650" />;
      case 'published': return <CheckCheck className="h-3 w-3 text-indigo-650" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6" id="mdm-approval-center-pane">
      {/* Visual Header */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-indigo-600" />
            <span>Master Data Governance Hub & Approval Center</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Zero-trust peer-review loop. Review submitted drafts, write comments, and grant authorization to push master records to production.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Hand: List staged drafts */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-4">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest block border-b border-slate-50 pb-2">Staged Queue drafts ({items.length})</span>

            {loading ? (
              <div className="text-center text-xs text-slate-400 py-12">Connecting block subscription...</div>
            ) : items.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-12 leading-relaxed">
                No clinical items are currently waiting in the approval queue.
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {items.map((item) => (
                  <button
                    key={item.queueId}
                    onClick={() => setSelectedItem(item)}
                    className={`w-full text-left p-3.5 rounded-xl border transition flex items-center justify-between gap-3 cursor-pointer select-none ${
                      selectedItem?.queueId === item.queueId
                        ? 'border-indigo-600 bg-indigo-50/15'
                        : 'border-slate-150 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="space-y-1 truncate">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {item.targetCollection.replace('_', ' ').replace('s', '')}
                        </span>
                        <span className={`text-[9px] font-mono border px-1.5 py-0.5 rounded-md flex items-center gap-1 ${getStatusBadgeClass(item.status)}`}>
                          {getStatusIcon(item.status)}
                          <span className="capitalize">{item.status}</span>
                        </span>
                      </div>
                      <div className="font-mono text-xs font-bold text-slate-800 truncate">{item.targetDocumentId}</div>
                      <div className="text-[10px] text-slate-400 truncate">Op: {item.requestedChangeType.toUpperCase()} | Operator: {item.operatorName}</div>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-slate-400 shrink-0 transition ${selectedItem?.queueId === item.queueId ? 'translate-x-1 text-indigo-650' : ''}`} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Hand: Comparative Audit & Action block */}
        <div className="lg:col-span-2">
          {selectedItem ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs min-h-[500px] flex flex-col justify-between" id="approval-item-viewer">
              <div className="space-y-6">
                {/* Header detail */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-4">
                  <div>
                    <h3 className="font-black text-slate-900 text-md flex items-center gap-2">
                      <Layers className="h-4.5 w-4.5 text-indigo-600" />
                      <span>Reviewing Draft: {selectedItem.targetDocumentId}</span>
                    </h3>
                    <p className="text-xs font-mono text-slate-400 mt-1">Staging Code: {selectedItem.queueId}</p>
                  </div>
                  <span className={`text-xs font-bold border rounded-xl py-1 px-3 flex items-center gap-1.5 self-start md:self-auto ${getStatusBadgeClass(selectedItem.status)}`}>
                    {getStatusIcon(selectedItem.status)}
                    <span className="capitalize font-semibold">{selectedItem.status} Workflow State</span>
                  </span>
                </div>

                {/* Operator submit info */}
                <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 border border-slate-150 rounded-2xl font-mono">
                  <div>
                    <span className="text-[9px] text-slate-450 block font-sans font-bold">STAGED BY</span>
                    <strong className="text-slate-800 font-bold block mt-0.5">{selectedItem.operatorName}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-450 block font-sans font-bold">SUBMITTIMESTAMP</span>
                    <strong className="text-slate-800 block mt-0.5">{new Date(selectedItem.createdAt).toLocaleDateString()}</strong>
                  </div>
                </div>

                {/* Parameter Comparison Sheet */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Clinical properties comparative checklist</h4>
                  <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-xxs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-450 border-b border-slate-150">
                        <tr>
                          <th className="py-2.5 px-4 font-black">Registry Key</th>
                          <th className="py-2.5 px-4 font-black">Staged Proposed Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150">
                        {Object.keys(selectedItem.pendingPayload).map((key) => {
                          const val = selectedItem.pendingPayload[key];
                          return (
                            <tr key={key} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-4 font-mono font-semibold text-slate-500">{key}</td>
                              <td className="py-2.5 px-4 font-semibold text-slate-800">
                                {Array.isArray(val) ? (
                                  <div className="flex flex-wrap gap-1">
                                    {val.map((itemVal, vIdx) => (
                                      <span key={vIdx} className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-sans">
                                        {itemVal}
                                      </span>
                                    ))}
                                  </div>
                                ) : typeof val === 'object' && val !== null ? (
                                  <pre className="text-[10px] bg-slate-900 text-slate-100 p-2 rounded-lg font-mono">{JSON.stringify(val, null, 2)}</pre>
                                ) : (
                                  String(val) || <span className="text-slate-350 italic">None</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Review logs and comment log */}
                {selectedItem.reviewerName && (
                  <div className="p-4 bg-sky-50/30 border border-sky-100 rounded-2xl space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-sky-900 font-bold">
                      <MessageSquare className="h-4 w-4 text-sky-700" />
                      <span>Reviewer Feedback Logged: {selectedItem.reviewerName}</span>
                    </div>
                    <p className="text-xs text-sky-850 font-sans italic">
                      "{selectedItem.reviewerComments}"
                    </p>
                  </div>
                )}
              </div>

              {/* Action Board (Role play simulation based) */}
              <div className="border-t border-slate-150 pt-5 mt-6 space-y-4">
                {selectedItem.status === 'pending' && (
                  <div className="space-y-4 font-sans animate-fade-in">
                    <div>
                      <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block mb-2">Reviewer Commentary & Auditing Notes</label>
                      <textarea
                        value={reviewerComment}
                        onChange={(e) => setReviewerComment(e.target.value)}
                        placeholder="Provide details about DGDA regulatory adherence, correct generic classifications, or reason for edits..."
                        className="w-full text-xs p-3.5 border border-slate-205 rounded-xl bg-slate-50 hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 h-20"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleReviewAction('rejected')}
                        disabled={processingId !== null}
                        className="bg-red-50 text-red-700 border border-red-150 hover:bg-red-100 font-bold px-4 py-2 text-xs rounded-xl transition cursor-pointer flex items-center gap-1"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Reject Draft</span>
                      </button>
                      <button
                        onClick={() => handleReviewAction('approved')}
                        disabled={processingId !== null}
                        className="bg-emerald-600 border border-emerald-600 text-white hover:bg-emerald-500 font-bold px-5 py-2 text-xs rounded-xl transition cursor-pointer flex items-center gap-1 shadow-sm"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>Approve Draft</span>
                      </button>
                    </div>
                  </div>
                )}

                {selectedItem.status === 'approved' && (
                  <div className="bg-emerald-50/50 border border-emerald-150 p-4 rounded-xl flex items-center justify-between gap-4 animate-fade-in">
                    <div className="space-y-1">
                      <span className="text-xs font-black text-emerald-800 flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        <span>Revision Fully Approved by Reviewer</span>
                      </span>
                      <p className="text-[11px] text-emerald-700 leading-normal">
                        Ready to be written to active production registries. Version ledgers and traces will be written.
                      </p>
                    </div>
                    <button
                      onClick={handlePublishCommit}
                      disabled={processingId !== null}
                      className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shrink-0 shadow-md"
                    >
                      <CheckCheck className="h-4 w-4 text-emerald-650" />
                      <span>{processingId ? 'Publishing...' : 'Commit to Prod Registry'}</span>
                    </button>
                  </div>
                )}

                {selectedItem.status === 'published' && (
                  <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl flex items-center gap-3 text-indigo-850 text-xs font-semibold">
                    <CheckCheck className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span>This item was committed to the production master database. Fully synchronized and locked.</span>
                  </div>
                )}

                {selectedItem.status === 'rejected' && (
                  <div className="bg-red-50/40 border border-red-100 p-4 rounded-xl flex items-center gap-3 text-red-800 text-xs font-semibold">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                    <span>This proposed draft was rejected. The Operator can edit details and submit a new revision draft.</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs min-h-[500px] flex items-center justify-center text-center text-slate-400 text-xs">
              Select a clinical queue item from the left panel list to view properties comparative values.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
