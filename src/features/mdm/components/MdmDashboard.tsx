/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Dna, 
  Pill, 
  Activity, 
  Clock, 
  Layers, 
  CheckCircle2, 
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export const MdmDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    companiesCount: 0,
    genericsCount: 0,
    medicinesCount: 0,
    diseasesCount: 0,
    queuePending: 0,
    queueApproved: 0,
    queueRejected: 0,
    queuePublished: 0,
    versionsCount: 0
  });
  const [loading, setLoading] = useState(false);

  const calculateStats = async () => {
    setLoading(true);
    try {
      const [
        snapCompanies,
        snapGenerics,
        snapMedicines,
        snapDiseases,
        snapQueue,
        snapVersions
      ] = await Promise.all([
        getDocs(collection(db, 'pharmaceutical_companies')).catch(() => ({ size: 0 })),
        getDocs(collection(db, 'medicine_generics')).catch(() => ({ size: 0 })),
        getDocs(collection(db, 'medicines')).catch(() => ({ size: 0 })),
        getDocs(collection(db, 'diseases')).catch(() => ({ size: 0 })),
        getDocs(collection(db, 'approval_queues')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'data_versions')).catch(() => ({ size: 0 }))
      ]);

      const queueDocs = (snapQueue as any).docs || [];
      const pending = queueDocs.filter((d: any) => d.data().status === 'pending').length;
      const approved = queueDocs.filter((d: any) => d.data().status === 'approved').length;
      const rejected = queueDocs.filter((d: any) => d.data().status === 'rejected').length;
      const published = queueDocs.filter((d: any) => d.data().status === 'published').length;

      setStats({
        companiesCount: (snapCompanies as any).size || 0,
        genericsCount: (snapGenerics as any).size || 0,
        medicinesCount: (snapMedicines as any).size || 0,
        diseasesCount: (snapDiseases as any).size || 0,
        queuePending: pending,
        queueApproved: approved,
        queueRejected: rejected,
        queuePublished: published,
        versionsCount: (snapVersions as any).size || 0
      });
    } catch (e) {
      console.error('Failed to pre-cache statistics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateStats();
  }, []);

  return (
    <div className="space-y-6" id="mdm-dashboard-home">
      {/* Intro visual card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-5.5 w-5.5 text-emerald-600 animate-pulse" />
            <span>Healthcare Master Data Control Panel</span>
          </h2>
          <p className="text-xs text-slate-405 mt-1">
            Real-time visual monitoring of relational integrity, clinical classifications, approvals, and write-once compliance audits.
          </p>
        </div>
        <button
          onClick={calculateStats}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 hover:border-slate-350 text-xs font-bold border border-slate-200 bg-white rounded-xl text-slate-705 cursor-pointer hover:bg-slate-50 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Real-Time Metrics</span>
        </button>
      </div>

      {loading && (
        <div className="text-xs font-bold font-mono text-center text-indigo-700 bg-indigo-50 border border-indigo-100 py-2.5 rounded-xl animate-pulse">
          Connecting clinical databases and pulling latest registry schemas...
        </div>
      )}

      {/* Primary stats grids */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Registered Pharma Companies', value: stats.companiesCount, desc: 'DGDA Certified Manufacturer registry', icon: Building2, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
          { label: 'Active Medicine Generics', value: stats.genericsCount, desc: 'Validated molecule formula indices', icon: Dna, color: 'text-indigo-650 bg-indigo-50 border-indigo-100' },
          { label: 'Medicines & Brand Names', value: stats.medicinesCount, desc: 'Strengths-to-dosage active index', icon: Pill, color: 'text-violet-650 bg-violet-50 border-violet-100' },
          { label: 'Disease Classifications', value: stats.diseasesCount, desc: 'ICD-10 clinical classifications', icon: Activity, color: 'text-red-500 bg-red-50 border-red-100' }
        ].map((c, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between gap-4">
            <div className="flex items-start justify-between">
              <span className="text-[10px] text-slate-450 uppercase block font-black leading-snug max-w-[150px]">{c.label}</span>
              <div className={`p-2 rounded-xl border shrink-0 ${c.color}`}>
                <c.icon className="h-4.5 w-4.5" />
              </div>
            </div>
            <div>
              <strong className="text-slate-900 text-2xl font-black block font-mono">{c.value}</strong>
              <span className="text-[10px] text-slate-400 mt-1 block font-medium">{c.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary audit stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs lg:col-span-2 space-y-5">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest block border-b border-slate-50 pb-2">Approval Pipeline Workflow status</span>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Drafts pending', value: stats.queuePending, desc: 'operator review', color: 'bg-amber-500', bg: 'bg-amber-50 border-amber-100 text-amber-900' },
              { label: 'Approved', value: stats.queueApproved, desc: 'authorized', color: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-100 text-emerald-900' },
              { label: 'Rejected', value: stats.queueRejected, desc: 'declined edits', color: 'bg-red-500', bg: 'bg-red-50 border-red-100 text-red-900' },
              { label: 'Published', value: stats.queuePublished, desc: 'registry committed', color: 'bg-indigo-650', bg: 'bg-indigo-50 border-indigo-100 text-indigo-900' }
            ].map((p, pIdx) => (
              <div key={pIdx} className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${p.bg}`}>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${p.color}`} />
                  <span className="text-[10px] font-sans font-black uppercase tracking-wider block truncate">{p.label}</span>
                </div>
                <div>
                  <strong className="text-slate-800 text-xl font-bold block font-mono leading-none">{p.value}</strong>
                  <span className="text-[9px] text-slate-400 block font-sans lowercase mt-1">{p.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Compliance Ledger status card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest block border-b border-slate-50 pb-2">Unalterable Audit Ledger</span>
            <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-2xl flex items-start gap-2 text-emerald-900">
              <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-xs font-black block">Trace Ledger Online</strong>
                <p className="text-[10px] mt-1 text-emerald-800 leading-normal font-semibold">Every insert, lifecycle soft delete, edit, or approval state is cryptographically signed and serialized into a compliance log trace.</p>
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-450 font-bold font-sans">LEDGER TRACE COUNT</span>
            <strong className="text-slate-800 font-extrabold">{stats.versionsCount} events written</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
