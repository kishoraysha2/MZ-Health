/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Building2, 
  Upload, 
  FileEdit, 
  UserCheck, 
  Download, 
  History, 
  Database,
  Grid
} from 'lucide-react';
import { MdmDashboard } from './components/MdmDashboard';
import { ImportCenter } from './components/ImportCenter';
import { ManualEntry } from './components/ManualEntry';
import { ApprovalCenter } from './components/ApprovalCenter';
import { ExportCenter } from './components/ExportCenter';
import { ActivityHistory } from './components/ActivityHistory';

type MdmSection = 'dashboard' | 'import' | 'manual' | 'approval' | 'export' | 'history';

export const MdmWorkspace: React.FC = () => {
  const [activeSection, setActiveSection] = useState<MdmSection>('dashboard');

  return (
    <div className="space-y-6" id="mdm-workspace-root">
      {/* Workspace Sub-tab Navigation */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-50 text-indigo-750 p-2 rounded-xl border border-indigo-100">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 tracking-tight">MDM Workspace Portal</h1>
            <span className="text-[10px] text-slate-400 font-mono">Master Data Management Engine • Sprint 3E Gate</span>
          </div>
        </div>

        {/* Action navigation tabs selector */}
        <div className="flex flex-wrap gap-1.5" id="mdm-workspace-navigation-tabs">
          {[
            { id: 'dashboard', label: 'Monitor Dashboard', icon: Grid },
            { id: 'import', label: 'Bulk Ingestor', icon: Upload },
            { id: 'manual', label: 'Composition', icon: FileEdit },
            { id: 'approval', label: 'Approval Queue', icon: UserCheck },
            { id: 'export', label: 'Compliance Export', icon: Download },
            { id: 'history', label: 'Ledger Audit History', icon: History }
          ].map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id as MdmSection)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                activeSection === sec.id
                  ? 'bg-indigo-650 border-indigo-650 text-white shadow-sm shadow-indigo-750/15'
                  : 'bg-white border-slate-150 text-slate-600 hover:bg-slate-50'
              }`}
              id={`mdm-tab-trigger-${sec.id}`}
            >
              <sec.icon className="h-3.5 w-3.5" />
              <span>{sec.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Render active workspace module section */}
      <div className="animate-fade-in" id="mdm-rendered-module">
        {activeSection === 'dashboard' && <MdmDashboard />}
        {activeSection === 'import' && <ImportCenter />}
        {activeSection === 'manual' && <ManualEntry />}
        {activeSection === 'approval' && <ApprovalCenter />}
        {activeSection === 'export' && <ExportCenter />}
        {activeSection === 'history' && <ActivityHistory />}
      </div>
    </div>
  );
};
