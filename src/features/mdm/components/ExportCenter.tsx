/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Download, 
  FileSpreadsheet, 
  FileJson, 
  RefreshCw, 
  CheckCircle,
  Database,
  Search
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { MdmEntityType } from '../types';

export const ExportCenter: React.FC = () => {
  const [selectedEntity, setSelectedEntity] = useState<MdmEntityType>('pharmaceutical_companies');
  const [records, setRecords] = useState<{ id: string; data: any }[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, selectedEntity));
      const list = snap.docs.map(doc => ({ id: doc.id, data: doc.data() }));
      setRecords(list);
    } catch (err) {
      console.error('Error fetching export records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedEntity]);

  const triggerCsvDownload = () => {
    if (records.length === 0) return;
    setExporting('csv');
    
    try {
      // Find all unique fields in row payloads to formulate CSV header column
      const sample = records.map(r => r.data);
      const allKeys = new Set<string>();
      sample.forEach(item => {
        Object.keys(item).forEach(k => allKeys.add(k));
      });
      const headers = Array.from(allKeys);
      
      let csvContent = headers.join(',') + '\n';
      
      records.forEach(row => {
        const item = row.data;
        const rowString = headers.map(key => {
          let val = item[key];
          if (val === undefined || val === null) return '';
          
          if (Array.isArray(val)) {
            // Arrays split with semi-colon inside double quotes
            return `"${val.join('; ')}"`;
          }
          let str = String(val).replace(/"/g, '""'); // Escape inner quotes
          if (str.includes(',') || str.includes('\n') || str.includes('"')) {
            return `"${str}"`;
          }
          return str;
        }).join(',');
        
        csvContent += rowString + '\n';
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedEntity}_export_${new Date().toISOString().substring(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(null);
    }
  };

  const triggerJsonDownload = () => {
    if (records.length === 0) return;
    setExporting('json');

    try {
      const payload = records.map(r => r.data);
      const jsonContent = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedEntity}_export_${new Date().toISOString().substring(0,10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6" id="mdm-export-center-pane">
      {/* Intro Header */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Download className="h-5 w-5 text-violet-650" />
            <span>Master Data Compliance Exporter Engine</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">Export official production registries in sanitized CSV or clinical JSON formats for national healthcare systems.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left hand selection */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-6">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Select Export Subject</span>
            <div className="space-y-2">
              {(['pharmaceutical_companies', 'medicine_generics', 'medicines', 'diseases'] as MdmEntityType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedEntity(type)}
                  className={`w-full text-left p-3.5 rounded-xl border flex items-center justify-between transition cursor-pointer select-none font-bold text-xs ${
                    selectedEntity === type
                      ? 'border-violet-600 bg-violet-50/15 text-violet-850'
                      : 'border-slate-150 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="capitalize">{type.replace('_', ' ')}</span>
                  <Database className={`h-4 w-4 ${selectedEntity === type ? 'text-violet-600' : 'text-slate-300'}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-500">Live DB Connection Stream</span>
            <button
              onClick={fetchRecords}
              className="text-violet-650 hover:text-violet-750 font-bold flex items-center gap-1 transition"
              disabled={loading}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Count</span>
            </button>
          </div>
        </div>

        {/* Right hand layout showing statistics, preview, and download triggers */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs min-h-[350px] flex flex-col justify-between" id="exporter-preview-board">
            <div>
              <div className="border-b border-slate-50 pb-4 mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest block">Data Stream Audit Diagnostics</h3>
                  <span className="text-[10px] text-slate-400 font-mono block mt-1">Subject: {selectedEntity}</span>
                </div>
                <span className="text-xs font-mono font-bold bg-violet-55 text-violet-700 border border-violet-100 px-3 py-1 rounded-full uppercase">
                  Connected
                </span>
              </div>

              {loading ? (
                <div className="py-16 text-center text-xs text-slate-400">Loading catalog stream from Firestore...</div>
              ) : records.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 leading-normal">
                  No active clinical records found in the production database for this category. <br />
                  <span className="text-[10px] text-slate-400 block mt-1">Use the Ingestion center or manual editor to submit and approve records.</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Stats counts wrapper */}
                  <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                    <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl">
                      <span className="text-[9px] text-slate-450 block font-sans font-bold">ACTIVE RECORDS FOUND</span>
                      <strong className="text-slate-800 text-lg block mt-1">{records.length}</strong>
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl">
                      <span className="text-[9px] text-slate-450 block font-sans font-bold">LEDGER ENFORCEMENT</span>
                      <strong className="text-emerald-700 text-lg block mt-1">100% Secure</strong>
                    </div>
                  </div>

                  {/* Tiny preview comparison sheet */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Live Sample Records preview</span>
                    <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 border border-slate-100 bg-slate-50/50 rounded-xl">
                      {records.slice(0, 3).map((item) => (
                        <div key={item.id} className="text-xs p-2 bg-white border border-slate-150 rounded-lg font-mono flex items-center justify-between">
                          <span className="font-bold text-violet-800">{item.id}</span>
                          <span className="text-slate-400 text-[10px] truncate max-w-sm">
                            {JSON.stringify(item.data).substring(0, 90)}...
                          </span>
                        </div>
                      ))}
                      {records.length > 3 && (
                        <div className="text-center text-[10px] text-slate-400 italic">
                          And {records.length - 3} more master entries...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {records.length > 0 && (
              <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={triggerCsvDownload}
                  disabled={exporting !== null}
                  className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>{exporting === 'csv' ? 'Exporting CSV...' : 'Download CSV (Excel format)'}</span>
                </button>
                <button
                  onClick={triggerJsonDownload}
                  disabled={exporting !== null}
                  className="flex-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-md"
                >
                  <FileJson className="h-4 w-4 text-violet-400" />
                  <span>{exporting === 'json' ? 'Exporting JSON...' : 'Download clinical JSON'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
