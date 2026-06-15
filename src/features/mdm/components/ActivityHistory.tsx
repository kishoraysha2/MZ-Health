/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  History, 
  User, 
  Layers, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ShieldAlert,
  ArrowRightLeft
} from 'lucide-react';
import { collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { MdmActivityLog } from '../types';

export const ActivityHistory: React.FC = () => {
  const [logs, setLogs] = useState<MdmActivityLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'mdm_activity_history'), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => doc.data() as MdmActivityLog);
      setLogs(list);
      setLoading(false);
    }, (err) => {
      console.error('Error listening to mdm activities:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getActionTheme = (actionType: string) => {
    switch (actionType) {
      case 'PUBLISH':
        return { bg: 'bg-emerald-50 border-emerald-100 text-emerald-800', icon: CheckCircle, label: 'Published Commit' };
      case 'REVIEW_APPROVE':
        return { bg: 'bg-indigo-50 border-indigo-100 text-indigo-800', icon: CheckCircle, label: 'Draft Approved' };
      case 'REVIEW_REJECT':
        return { bg: 'bg-red-50 border-red-100 text-red-800', icon: XCircle, label: 'Draft Rejected' };
      case 'IMPORT_QUEUE':
        return { bg: 'bg-amber-50 border-amber-100 text-amber-800', icon: ArrowRightLeft, label: 'Bulk Enqueued' };
      case 'MANUAL_DRAFT':
        return { bg: 'bg-slate-50 border-slate-100 text-slate-700', icon: History, label: 'Manual Draft Submitted' };
      case 'ARCHIVE':
      case 'SOFT_DELETE':
        return { bg: 'bg-violet-50 border-violet-100 text-violet-800', icon: ShieldAlert, label: 'Soft Archived' };
      case 'RESTORE':
        return { bg: 'bg-sky-50 border-sky-100 text-sky-800', icon: History, label: 'Record Restored' };
      default:
        return { bg: 'bg-slate-50 border-slate-100 text-slate-700', icon: History, label: 'Governance Event' };
    }
  };

  return (
    <div className="space-y-6" id="mdm-activity-history-pane">
      {/* Visual Header */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-650" />
            <span>Master Data Activity Timeline & Audit Ledger</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Unalterable chronological trace of all master registry events. Auditing who enqueued, reviewed, approved, and structured master data.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest block border-b border-slate-50 pb-2 mb-4">
          Clinical Master Ledger Log Timeline ({logs.length} events logged)
        </span>

        {loading ? (
          <div className="text-center text-xs text-slate-400 py-20">Reading secure ledger logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-center text-xs text-slate-400 py-20">
            No activities recorded in the MDM engine ledger yet. <br />
            <span className="text-[10px] text-slate-400 mt-1 block">Perform standard ingestion or validations to log governance traces.</span>
          </div>
        ) : (
          <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
            {logs.map((log) => {
              const theme = getActionTheme(log.actionType);
              const ActiveIcon = theme.icon;
              return (
                <div key={log.activityId} className="p-4 border border-slate-150 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-slate-350 transition shadow-xxs">
                  <div className="flex gap-3.5 items-start">
                    <div className={`p-2.5 rounded-xl border shrink-0 mt-0.5 ${theme.bg}`}>
                      <ActiveIcon className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-xs font-extrabold text-slate-800">{theme.label}</strong>
                        <span className="text-[9px] uppercase font-bold text-slate-400 font-mono">
                          Target Collection: {log.entityType}
                        </span>
                        <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded uppercase">
                          Document ID: {log.entityDocId}
                        </span>
                      </div>
                      <p className="text-xs text-slate-650 font-semibold leading-relaxed">
                        {log.details}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-0.5 font-bold">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>Actor: {log.actorName}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>Timestamp: {new Date(log.timestamp).toLocaleTimeString()} ({new Date(log.timestamp).toLocaleDateString()})</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="font-mono text-[10px] text-slate-400 self-end md:self-auto block select-all">
                    LOG_ID: {log.activityId.substring(8, 22).toUpperCase()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
