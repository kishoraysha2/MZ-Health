/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Sparkles, 
  History, 
  TrendingUp, 
  ChevronRight, 
  SlidersHorizontal,
  X,
  FileText,
  Activity,
  Heart,
  Users,
  Building,
  Filter,
  BarChart3,
  Calendar,
  AlertTriangle,
  Flame,
  Globe,
  Award,
  Stethoscope,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar 
} from 'recharts';

import { SearchCategory, SearchResultItem, SearchHistoryItem, SearchAnalytics } from '../types';
import { SearchService } from '../searchService';
import { runSearch } from '../searchEngine';

interface SearchCenterProps {
  onBack?: () => void;
}

export default function SearchCenter({ onBack }: SearchCenterProps) {
  // --- States ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'results' | 'analytics'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory>('all');
  
  // Data index caches
  const [catalog, setCatalog] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<SearchAnalytics | null>(null);
  
  // History and suggestions
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<SearchResultItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Filters for results page
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterCity, setFilterCity] = useState('all');
  const [filterPriceRange, setFilterPriceRange] = useState<[number, number]>([0, 1500]);
  
  // Active selected detail monograph item
  const [selectedItem, setSelectedItem] = useState<SearchResultItem | null>(null);

  // --- Initialize Search Center ---
  useEffect(() => {
    async function initData() {
      setLoading(true);
      try {
        const data = await SearchService.loadSearchCatalog();
        setCatalog(data);
        
        // Load recent searches from localStorage
        const st = localStorage.getItem('mz_recent_searches');
        if (st) {
          setRecentSearches(JSON.parse(st));
        } else {
          setRecentSearches(['Paracetamol', 'Fever', 'Square Pharma', 'Sabrina', 'Dengue']);
        }

        // Fetch analytics
        const summary = await SearchService.fetchAnalyticsSummary();
        setAnalytics(summary);
      } catch (err) {
        console.error('[SearchCenter] Failed to load initial resources:', err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, [activeTab]);

  // --- Dynamic Suggestions ---
  useEffect(() => {
    if (!searchQuery.trim() || catalog.length === 0) {
      setSuggestions([]);
      return;
    }
    const filtered = runSearch(searchQuery, selectedCategory, catalog);
    setSuggestions(filtered.slice(0, 5));
  }, [searchQuery, selectedCategory, catalog]);

  // --- Trigger Search Action ---
  const handleSearchExecute = async (queryText: string, cat: SearchCategory = selectedCategory) => {
    const qClean = queryText.trim();
    if (!qClean) return;

    // Update query and category state
    setSearchQuery(qClean);
    setSelectedCategory(cat);
    setActiveTab('results');
    setShowSuggestions(false);

    // Save to recent searches (localStorage)
    const updatedRecents = [qClean, ...recentSearches.filter(s => s.toLowerCase() !== qClean.toLowerCase())].slice(0, 8);
    setRecentSearches(updatedRecents);
    localStorage.setItem('mz_recent_searches', JSON.stringify(updatedRecents));
    
    // Execute search to find results count for analytic recording
    const results = runSearch(qClean, cat, catalog);

    // Record Log in Firestore
    await SearchService.recordSearchLog({
      query: qClean,
      category: cat,
      resultCount: results.length
    });
  };

  const handleClearQuery = () => {
    setSearchQuery('');
    setSuggestions([]);
  };

  // --- Filtered Results computed list ---
  const searchedResults = useMemo(() => {
    if (activeTab !== 'results') return [];
    
    let list = runSearch(searchQuery, selectedCategory, catalog);

    // Apply sidebar secondary filters
    if (selectedCategory === 'medicines' || selectedCategory === 'all') {
      if (filterCompany !== 'all') {
        list = list.filter(item => 
          item.category === 'medicines' && 
          item.payload.manufacturerId === filterCompany
        );
      }
      if (selectedCategory === 'medicines') {
        list = list.filter(item => 
          item.category === 'medicines' && 
          item.payload.unitPrice >= filterPriceRange[0] && 
          item.payload.unitPrice <= filterPriceRange[1]
        );
      }
    }

    if (selectedCategory === 'diseases' || selectedCategory === 'all') {
      if (filterSeverity !== 'all') {
        list = list.filter(item => 
          item.category === 'diseases' && 
          item.payload.severityLevel === filterSeverity
        );
      }
    }

    if (selectedCategory === 'doctors' || selectedCategory === 'all') {
      if (filterCity !== 'all') {
        list = list.filter(item => 
          item.category === 'doctors' && 
          item.payload.city?.toLowerCase() === filterCity.toLowerCase()
        );
      }
    }

    return list;
  }, [activeTab, searchQuery, selectedCategory, catalog, filterCompany, filterSeverity, filterCity, filterPriceRange]);

  // Helper dictionary counts
  const categoryCounts = useMemo(() => {
    const counts = { medicines: 0, diseases: 0, generics: 0, pharmaceutical_companies: 0, doctors: 0 };
    catalog.forEach(item => {
      if (item.category in counts) {
        counts[item.category as keyof typeof counts]++;
      }
    });
    return counts;
  }, [catalog]);

  // Unique companies and cities list for filter dropdowns
  const filterOptions = useMemo(() => {
    const companies = new Map<string, string>();
    const cities = new Set<string>();

    catalog.forEach(item => {
      if (item.category === 'medicines' && item.payload.manufacturerId) {
        companies.set(item.payload.manufacturerId, item.payload.manufacturerName || item.payload.manufacturerId);
      }
      if (item.category === 'doctors' && item.payload.city) {
        cities.add(item.payload.city);
      }
    });

    return {
      companies: Array.from(companies.entries()).map(([id, name]) => ({ id, name })),
      cities: Array.from(cities)
    };
  }, [catalog]);

  // Chart cell colors
  const COLORS = ['#0ea5e9', '#ef4444', '#10b981', '#6366f1', '#f59e0b'];

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center py-24" id="search-center-loading">
        <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400 mt-4 font-bold tracking-widest uppercase">Booting National Search Catalog...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="search-center-container">
      {/* Search Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5" id="search-banner">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-sky-50 rounded-lg text-sky-600 block">
              <Search className="h-5 w-5 animate-pulse" />
            </span>
            <h1 className="text-xl font-black text-slate-950 tracking-tight" id="search-heading">National Healthcare Search Engine</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">Ecosystem-wide integrated dictionary, pharmacological inventory, and practitioners lookup layer.</p>
        </div>

        <div className="flex items-center gap-2" id="search-navigation-pills">
          <button
            onClick={() => { setActiveTab('dashboard'); setSearchQuery(''); }}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition border ${
              activeTab === 'dashboard' 
                ? 'bg-sky-600 border-sky-600 text-white shadow-xs' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => { if (searchQuery) setActiveTab('results'); else setActiveTab('dashboard'); }}
            disabled={!searchQuery}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition border ${
              activeTab === 'results' 
                ? 'bg-sky-600 border-sky-600 text-white shadow-xs' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            Results {searchQuery && `(${searchedResults.length})`}
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition border flex items-center gap-1.5 ${
              activeTab === 'analytics' 
                ? 'bg-sky-600 border-sky-600 text-white shadow-xs' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Analytics
          </button>
        </div>
      </div>

      {/* SEARCH CORE DISPLAY */}
      <AnimatePresence mode="wait">
        
        {/* TAB 1: SEARCH DASHBOARD */}
        {activeTab === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
            id="search-tab-dashboard"
          >
            {/* Mega Search Console */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-10 shadow-lg border border-slate-800 relative overflow-hidden" id="mega-search-console">
              {/* Decorative accent glow */}
              <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
              
              <div className="max-w-2xl mx-auto text-center space-y-6 relative z-10">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] uppercase font-black tracking-widest bg-sky-500/20 text-sky-400 border border-sky-500/10">
                    <Sparkles className="h-3 w-3" />
                    Ultra-Lightweight Catalogs Ready
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">What clinically can we find for you?</h2>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">Instant search queries optimized for 10M+ users. Fully phonetic in English and Bengali.</p>
                </div>

                {/* Input Bar */}
                <div className="relative">
                  <div className="flex bg-white rounded-2xl shadow-xl overflow-hidden p-1 border border-slate-200 focus-within:ring-4 focus-within:ring-sky-500/20 transition">
                    <div className="flex items-center pl-4 pr-2 text-slate-400">
                      <Search className="h-5 w-5" />
                    </div>
                    <input
                      type="text"
                      className="w-full py-3.5 text-sm text-slate-900 focus:outline-none placeholder:text-slate-400 font-medium"
                      placeholder="Type medicines, generics, clinical terms, diseases, or doctors..."
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSearchExecute(searchQuery); }}
                      onFocus={() => setShowSuggestions(true)}
                    />
                    
                    {searchQuery && (
                      <button 
                        onClick={handleClearQuery}
                        className="p-1 px-2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}

                    <button
                      onClick={() => handleSearchExecute(searchQuery)}
                      className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition cursor-pointer self-center"
                    >
                      Search
                    </button>
                  </div>

                  {/* Suggestion panel drops */}
                  <AnimatePresence>
                    {showSuggestions && suggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-150 overflow-hidden z-50 text-left"
                      >
                        <div className="p-2 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Matching Suggestions</span>
                          <button onClick={() => setShowSuggestions(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-md">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="divide-y divide-slate-50">
                          {suggestions.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => handleSearchExecute(item.title, item.category)}
                              className="p-3.5 hover:bg-slate-50/70 transition cursor-pointer flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <span className={`p-1.5 rounded-lg text-xs ${
                                  item.category === 'medicines' ? 'bg-emerald-50 text-emerald-600' :
                                  item.category === 'diseases' ? 'bg-red-50 text-red-600' :
                                  item.category === 'doctors' ? 'bg-indigo-50 text-indigo-600' :
                                  item.category === 'generics' ? 'bg-amber-50 text-amber-600' :
                                  'bg-slate-50 text-slate-600'
                                }`}>
                                  {item.category === 'medicines' && <Flame className="h-3.5 w-3.5" />}
                                  {item.category === 'diseases' && <AlertTriangle className="h-3.5 w-3.5" />}
                                  {item.category === 'doctors' && <Users className="h-3.5 w-3.5" />}
                                  {item.category === 'generics' && <FileText className="h-3.5 w-3.5" />}
                                  {item.category === 'pharmaceutical_companies' && <Building className="h-3.5 w-3.5" />}
                                </span>
                                <div>
                                  <p className="text-sm font-extrabold text-slate-900 leading-tight">
                                    {item.title}
                                    {item.bengaliTitle && <span className="font-medium text-slate-400 text-xs ml-1.5 font-sans">({item.bengaliTitle})</span>}
                                  </p>
                                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{item.subtitle}</p>
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-slate-300" />
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Category Filter Pills on Dashboard */}
                <div className="flex flex-wrap justify-center gap-1.5 pt-2" id="dashboard-cat-pills">
                  {(['all', 'medicines', 'diseases', 'generics', 'pharmaceutical_companies', 'doctors'] as SearchCategory[]).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border cursor-pointer transition ${
                        selectedCategory === cat 
                          ? 'bg-sky-500/20 text-white border-sky-400/50' 
                          : 'bg-slate-800/20 text-slate-300 border-slate-800 hover:bg-slate-800/40'
                      }`}
                    >
                      {cat === 'all' ? 'All Entities' : cat.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent & Popular Search Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="dashboard-chips-columns">
              {/* Popular Searches */}
              <div className="bg-white rounded-2xl border border-slate-150 p-5 space-y-4 shadow-2xs">
                <div className="flex items-center gap-2 text-slate-800 border-b border-slate-50 pb-3">
                  <TrendingUp className="h-4 w-4 text-sky-500" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">Popular Queries</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { query: 'Paracetamol', category: 'generics', tag: 'Analgesics' },
                    { query: 'Dengue Fever', category: 'diseases', tag: 'High Epidemic' },
                    { query: 'Square Pharma', category: 'pharmaceutical_companies', tag: 'Manufacturer' },
                    { query: 'Gastric', category: 'all', tag: 'Symptoms' },
                    { query: 'Losectil', category: 'medicines', tag: 'Brand' },
                    { query: 'Cardiology', category: 'doctors', tag: 'Practitioners' }
                  ].map((pop) => (
                    <button
                      key={pop.query}
                      onClick={() => handleSearchExecute(pop.query, pop.category as SearchCategory)}
                      className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-150 text-slate-700 hover:bg-slate-100/80 rounded-xl transition cursor-pointer flex items-center gap-1.5 group font-medium"
                    >
                      <span>{pop.query}</span>
                      <span className="text-[9px] bg-slate-200 text-slate-500 px-1.5 py-0.2 rounded-md font-bold group-hover:bg-slate-300 transition">
                        {pop.tag}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent Searches */}
              <div className="bg-white rounded-2xl border border-slate-150 p-5 space-y-4 shadow-2xs">
                <div className="flex items-center gap-2 text-slate-800 border-b border-slate-50 pb-3">
                  <History className="h-4 w-4 text-indigo-500" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">Recent Search Activity</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.length === 0 ? (
                    <span className="text-xs text-slate-400 py-2 italic font-medium">Your search logs is currently clear.</span>
                  ) : (
                    recentSearches.map((rec) => (
                      <button
                        key={rec}
                        onClick={() => handleSearchExecute(rec)}
                        className="px-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1 font-medium"
                      >
                        <Search className="h-3 w-3 text-slate-400 group-hover:text-slate-600 mr-0.5" />
                        <span>{rec}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Quick Catalog Directories Grid */}
            <div className="space-y-4" id="dashboard-directory-grid">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Ecosystem Catalogs at a Glance</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                
                {/* Medicines */}
                <div 
                  onClick={() => handleSearchExecute('Napa', 'medicines')}
                  className="bg-emerald-50/40 hover:bg-emerald-50 border border-emerald-100 rounded-2xl p-4 transition text-left cursor-pointer flex flex-col justify-between h-32"
                >
                  <span className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl w-fit"><Flame className="h-5 w-5" /></span>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 leading-tight">Medicines</h4>
                    <p className="text-[10px] text-emerald-800 font-bold mt-1 uppercase tracking-wide">
                      {categoryCounts.medicines} Registered
                    </p>
                  </div>
                </div>

                {/* Generics */}
                <div 
                  onClick={() => handleSearchExecute('Paracetamol', 'generics')}
                  className="bg-amber-50/40 hover:bg-amber-50 border border-amber-100 rounded-2xl p-4 transition text-left cursor-pointer flex flex-col justify-between h-32"
                >
                  <span className="p-2 bg-amber-500/10 text-amber-600 rounded-xl w-fit"><FileText className="h-5 w-5" /></span>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 leading-tight">Generics</h4>
                    <p className="text-[10px] text-amber-800 font-bold mt-1 uppercase tracking-wide">
                      {categoryCounts.generics} Compounds
                    </p>
                  </div>
                </div>

                {/* Diseases */}
                <div 
                  onClick={() => handleSearchExecute('Fever', 'diseases')}
                  className="bg-red-50/40 hover:bg-red-50 border border-red-100 rounded-2xl p-4 transition text-left cursor-pointer flex flex-col justify-between h-32"
                >
                  <span className="p-2 bg-red-500/10 text-red-600 rounded-xl w-fit"><AlertTriangle className="h-5 w-5" /></span>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 leading-tight">Diseases</h4>
                    <p className="text-[10px] text-red-800 font-bold mt-1 uppercase tracking-wide">
                      {categoryCounts.diseases} Monographs
                    </p>
                  </div>
                </div>

                {/* Companies */}
                <div 
                  onClick={() => handleSearchExecute('Square', 'pharmaceutical_companies')}
                  className="bg-sky-50/40 hover:bg-sky-50 border border-sky-100 rounded-2xl p-4 transition text-left cursor-pointer flex flex-col justify-between h-32"
                >
                  <span className="p-2 bg-sky-500/10 text-sky-600 rounded-xl w-fit"><Building className="h-5 w-5" /></span>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 leading-tight">Pharma Co.</h4>
                    <p className="text-[10px] text-sky-800 font-bold mt-1 uppercase tracking-wide">
                      {categoryCounts.pharmaceutical_companies} Manufacturers
                    </p>
                  </div>
                </div>

                {/* Doctors */}
                <div 
                  onClick={() => handleSearchExecute('Dhaka', 'doctors')}
                  className="bg-indigo-50/40 hover:bg-indigo-50 border border-indigo-100 rounded-2xl p-4 transition text-left cursor-pointer col-span-2 md:col-span-1 flex flex-col justify-between h-32"
                >
                  <span className="p-2 bg-indigo-500/10 text-indigo-600 rounded-xl w-fit"><Users className="h-5 w-5" /></span>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 leading-tight">Doctors</h4>
                    <p className="text-[10px] text-indigo-800 font-bold mt-1 uppercase tracking-wide">
                      {categoryCounts.doctors} Specialists
                    </p>
                  </div>
                </div>

              </div>
            </div>

          </motion.div>
        )}

        {/* TAB 2: SEARCH RESULTS & SIDEBAR FILTERS */}
        {activeTab === 'results' && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-4 gap-6"
            id="search-tab-results"
          >
            {/* Left Sidebar Filter Column */}
            <div className="lg:col-span-1 space-y-6" id="results-filter-sidebar">
              <div className="bg-white rounded-2xl border border-slate-150 p-5 space-y-5 shadow-2xs">
                
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <Filter className="h-4 w-4 text-sky-500" />
                    Refine Search
                  </span>
                  {(filterCompany !== 'all' || filterSeverity !== 'all' || filterCity !== 'all' || filterPriceRange[0] !== 0 || filterPriceRange[1] !== 1500) && (
                    <button 
                      onClick={() => {
                        setFilterCompany('all');
                        setFilterSeverity('all');
                        setFilterCity('all');
                        setFilterPriceRange([0, 1500]);
                      }}
                      className="text-[10px] text-rose-500 hover:text-rose-600 font-black tracking-wide uppercase transition"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Filter section: Entity Category */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Entity Type</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as SearchCategory)}
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none"
                  >
                    <option value="all">All Registries</option>
                    <option value="medicines">Medicines</option>
                    <option value="diseases">Diseases</option>
                    <option value="generics">Generics</option>
                    <option value="pharmaceutical_companies">Pharmaceutical Companies</option>
                    <option value="doctors">Doctors</option>
                  </select>
                </div>

                {/* Dynamic context-based filters */}
                {(selectedCategory === 'medicines' || selectedCategory === 'all') && (
                  <div className="space-y-4 pt-2 border-t border-slate-50">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">Manufacturer</label>
                      <select
                        value={filterCompany}
                        onChange={(e) => setFilterCompany(e.target.value)}
                        className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none"
                      >
                        <option value="all">All Manufacturers</option>
                        {filterOptions.companies.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {selectedCategory === 'medicines' && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Price Filter (BDT)</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={filterPriceRange[0]}
                            onChange={(e) => setFilterPriceRange([Number(e.target.value), filterPriceRange[1]])}
                            className="w-1/2 text-xs bg-slate-50 border border-slate-150 p-1.5 rounded-md font-bold focus:outline-none"
                            placeholder="Min"
                          />
                          <input
                            type="number"
                            value={filterPriceRange[1]}
                            onChange={(e) => setFilterPriceRange([filterPriceRange[0], Number(e.target.value)])}
                            className="w-1/2 text-xs bg-slate-50 border border-slate-150 p-1.5 rounded-md font-bold focus:outline-none"
                            placeholder="Max"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(selectedCategory === 'diseases' || selectedCategory === 'all') && (
                  <div className="space-y-2 pt-2 border-t border-slate-50">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">Clinical Severity</label>
                    <select
                      value={filterSeverity}
                      onChange={(e) => setFilterSeverity(e.target.value)}
                      className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none"
                    >
                      <option value="all">All Severities</option>
                      <option value="low">Low (Routine)</option>
                      <option value="moderate">Moderate</option>
                      <option value="high">High (Specialist Needed)</option>
                      <option value="critical">Critical (ICU Warning)</option>
                    </select>
                  </div>
                )}

                {(selectedCategory === 'doctors' || selectedCategory === 'all') && (
                  <div className="space-y-2 pt-2 border-t border-slate-50">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">Practitioner City</label>
                    <select
                      value={filterCity}
                      onChange={(e) => setFilterCity(e.target.value)}
                      className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none"
                    >
                      <option value="all">All Cities</option>
                      {filterOptions.cities.map(cit => (
                        <option key={cit} value={cit}>{cit}</option>
                      ))}
                    </select>
                  </div>
                )}

              </div>
            </div>

            {/* Right Results Listing Column */}
            <div className="lg:col-span-3 space-y-4" id="results-listing-panes">
              
              {/* Dynamic search input inside results */}
              <div className="bg-white rounded-2xl border border-slate-150 p-4 shadow-3xs flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold text-slate-900 focus:outline-none"
                    placeholder="Search medicines, generics, clinical properties..."
                  />
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                </div>
                <button
                  onClick={() => handleSearchExecute(searchQuery)}
                  className="px-5 py-2.5 bg-slate-950 hover:bg-slate-900 text-white font-extrabold text-xs rounded-xl cursor-pointer shadow-sm transition"
                >
                  Recall Search
                </button>
              </div>

              {/* Stats Bar */}
              <div className="flex justify-between items-center px-2">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  Found {searchedResults.length} index matching results
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  Query: <span className="font-bold text-slate-700">"{searchQuery}"</span>
                </span>
              </div>

              {/* Cards Grid */}
              {searchedResults.length === 0 ? (
                <div className="py-24 border-2 border-dashed border-slate-150 rounded-3xl text-center space-y-3 bg-white">
                  <p className="text-sm font-bold text-slate-700">No medical matches found for "{searchQuery}"</p>
                  <p className="text-xs text-slate-400">Try adjusting spelling or category filters, or search Bangla equivalents phonetically.</p>
                  <button 
                    onClick={() => { setSearchQuery('Paracetamol'); setSelectedCategory('all'); }} 
                    className="text-xs text-sky-600 font-bold underline"
                  >
                    Reset & Search Baseline Paracetamol
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchedResults.map(item => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="border border-slate-150 bg-white rounded-2xl p-5 shadow-3xs hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <span className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-md border ${
                            item.category === 'medicines' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            item.category === 'diseases' ? 'bg-red-50 text-red-700 border-red-100' :
                            item.category === 'doctors' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                            item.category === 'generics' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                            'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {item.category.replace('_', ' ')}
                          </span>

                          <span className="text-[10px] font-semibold text-slate-400">
                            Rel: {item.relevanceScore}%
                          </span>
                        </div>

                        <div>
                          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 leading-tight">
                            <span>{item.title}</span>
                            {item.bengaliTitle && (
                              <span className="font-medium text-xs text-slate-400 font-sans">
                                ({item.bengaliTitle})
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{item.subtitle}</p>
                        </div>

                        {/* Match Indicators Row */}
                        {item.matches.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1.5">
                            {item.matches.slice(0, 3).map((match, idx) => (
                              <span 
                                key={idx} 
                                className="inline-flex items-center gap-1.5 text-[9px] font-extrabold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full uppercase tracking-wider border border-slate-250"
                              >
                                {match.type === 'phonetic' && <Sparkles className="h-2.5 w-2.5 text-indigo-500" />}
                                {match.type === 'bengali' && <Globe className="h-2.5 w-2.5 text-emerald-500" />}
                                {match.type === 'synonym' && <Heart className="h-2.5 w-2.5 text-red-400" />}
                                {match.type === 'exact' && <Award className="h-2.5 w-2.5 text-sky-500" />}
                                <span>{match.type} Match</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs font-bold text-sky-600">
                        <span>Clinical Registry Doc</span>
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </motion.div>
        )}

        {/* TAB 3: SEARCH ANALYTICS & RECHARTS INTEL */}
        {activeTab === 'analytics' && analytics && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
            id="search-tab-analytics"
          >
            {/* Top Cards Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="analytics-grid-cards">
              <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Lookup Stream</span>
                <p className="text-2xl font-black text-slate-900">{analytics.totalSearches}</p>
                <p className="text-xs text-slate-400">Total processed search queries</p>
              </div>

              <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lookup Match Yield</span>
                <p className="text-2xl font-black text-emerald-600">
                  {Math.round((analytics.successfulSearches / (analytics.totalSearches || 1)) * 100)}%
                </p>
                <p className="text-xs text-slate-400">Successful clinical mapping records</p>
              </div>

              <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-2 col-span-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Catalog Miss Rate</span>
                <p className="text-2xl font-black text-red-500">{analytics.zeroResultSearches}</p>
                <p className="text-xs text-slate-400">Queries returned 0 results</p>
              </div>
            </div>

            {/* Recharts Area Chart Volume trend */}
            <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-4 shadow-3xs">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Search Volume Traces (Last 7 Days)</h3>
                <p className="text-[11px] text-slate-400">Dynamic ledger chart monitoring success and failure search operations over time.</p>
              </div>
              <div className="h-64 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.volumeTrend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '11px', color: '#fff' }} />
                    <Area type="monotone" dataKey="success" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#colorSuccess)" name="Match Successful" />
                    <Area type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorFailed)" name="Match Empty" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bottom table listings on Analytics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="analytics-breakdowns">
              
              {/* Category distribution graph (recharts) */}
              <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Catalog Access Distribution</h4>
                  <p className="text-[11px] text-slate-400">Total hits count sorted across healthcare entities.</p>
                </div>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.entries(analytics.categoryDistribution).map(([cat, val]) => ({ name: cat.replace('_', ' '), value: val }))}>
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: 'rgba(230,240,250,0.4)' }} />
                      <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]}>
                        {Object.entries(analytics.categoryDistribution).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Dynamic queries frequency table */}
              <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Top Healthcare Search Queries</h4>
                  <p className="text-[11px] text-slate-400">Audit trail frequency ledger identifying high volume keywords.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                        <th className="pb-2">Keyword Query</th>
                        <th className="pb-2">Target Registry</th>
                        <th className="pb-2 text-right">Access Frequency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {analytics.topQueries.slice(0, 6).map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 font-bold text-slate-900 font-mono">"{item.query}"</td>
                          <td className="py-2.5">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold capitalize">
                              {item.category.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-2.5 text-right font-bold text-slate-700">{item.count} hits</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </motion.div>
        )}

      </AnimatePresence>

      {/* DETAIL DRAWER / MONOGRAPH OVERLAY */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex justify-end z-50 p-4"
            onClick={() => setSelectedItem(null)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white rounded-2xl shadow-2xl h-full flex flex-col justify-between overflow-hidden border-l border-slate-100"
            >
              {/* Drawer Header */}
              <div className="bg-slate-900 text-white p-5 space-y-2 relative">
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 transition"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-2">
                  <span className="p-1 px-2.5 text-[9px] bg-sky-500/20 text-sky-400 border border-sky-400/20 font-black tracking-widest uppercase rounded">
                    {selectedItem.category.replace('_', ' ')}
                  </span>
                  {selectedItem.payload?.lifeCycleState && (
                    <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/10 uppercase tracking-widest px-2 py-0.5 rounded">
                      {selectedItem.payload.lifeCycleState}
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-bold flex wrap items-center gap-1.5 pt-1">
                  <span>{selectedItem.title}</span>
                  {selectedItem.bengaliTitle && (
                    <span className="font-medium text-sm text-slate-300">({selectedItem.bengaliTitle})</span>
                  )}
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed max-w-[90%]">{selectedItem.subtitle}</p>
              </div>

              {/* Drawer Body (Complex clinical details) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* 1. Details for Medicines */}
                {selectedItem.category === 'medicines' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-3 rounded-xl">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Strength</span>
                        <span className="text-sm font-bold text-slate-800">{selectedItem.payload.strength}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Dosage Form</span>
                        <span className="text-sm font-bold text-slate-800">{selectedItem.payload.dosageForm}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl col-span-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Core active Generic Substance</span>
                        <span className="text-sm font-bold text-sky-700 leading-tight block mt-0.5">{selectedItem.payload.genericName}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl col-span-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Registered Manufacturer</span>
                        <span className="text-sm font-bold text-slate-800 block mt-0.5">{selectedItem.payload.manufacturerName}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex justify-between items-center">
                      <div>
                        <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest block">DGDA Approved Retail Price</span>
                        <span className="text-sm font-extrabold text-slate-900 mt-1 block">BDT {selectedItem.payload.unitPrice?.toFixed(2)} per unit</span>
                      </div>
                      <span className="text-[10px] bg-emerald-500 text-white px-2.5 py-1 rounded-md font-black uppercase tracking-wider">
                        Active Price
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. Details for Generics */}
                {selectedItem.category === 'generics' && (
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl space-y-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Pharmacological Classification</span>
                      <span className="text-sm font-bold text-slate-800 block leading-tight">{selectedItem.payload.therapeuticClass}</span>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl space-y-1">
                      <span className="text-[9px] font-black text-amber-800 uppercase tracking-widest block">FDA Pregnancy Category</span>
                      <span className="text-lg font-black text-amber-900 block">{selectedItem.payload.pregnancyCategory}</span>
                      <p className="text-[11px] text-amber-700/80 leading-relaxed font-semibold">
                        {selectedItem.payload.pregnancyCategory === 'A' && 'Controlled studies show no risk. Adequate studies in pregnant women have failed to demonstrate risk.'}
                        {selectedItem.payload.pregnancyCategory === 'B' && 'Animal studies show no risk, or animal studies show some risk but human studies showed no risk.'}
                        {selectedItem.payload.pregnancyCategory === 'C' && 'Animal research shows risk, but human research is unavailable. Use only if clinical benefit outweighs threat.'}
                        {selectedItem.payload.pregnancyCategory === 'D' && 'Evidence of threat to human fetus exists, but therapeutic benefits might warrant usage.'}
                        {selectedItem.payload.pregnancyCategory === 'X' && 'Proven fetal abnormalities. Highly contraindicated in pregnancy. Absolutely unsafe.'}
                        {selectedItem.payload.pregnancyCategory === 'N/A' && 'Pregnancy risk parameter not medically applicable for this generic compound.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. Details for Diseases */}
                {selectedItem.category === 'diseases' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-3 rounded-xl">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">World Health Org ICD-10 Code</span>
                        <span className="text-sm font-bold text-slate-800 block mt-0.5">{selectedItem.payload.icd10 || 'N/A'}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">World Health Org ICD-11 Code</span>
                        <span className="text-sm font-bold text-slate-800 block mt-0.5">{selectedItem.payload.icd11 || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Symptoms lists */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Clinical Symptoms Diagnosis</span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedItem.payload.symptoms?.map((sym: string, i: number) => (
                          <span key={i} className="bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-lg text-xs">
                            {sym}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Causes */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Etiology & Causes</span>
                      <p className="text-xs text-slate-600 leading-relaxed font-semibold">{selectedItem.payload.causes?.join(', ') || 'No etiologies reported.'}</p>
                    </div>

                    {/* Prevention */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Prevention Guidelines</span>
                      <p className="text-xs text-amber-700 leading-relaxed bg-amber-50/50 border border-amber-100/50 p-3 rounded-xl font-medium">
                        {selectedItem.payload.prevention?.join(', ') || 'No specific preventions added.'}
                      </p>
                    </div>

                    {/* Warning Alerts */}
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl space-y-1">
                      <span className="text-[9px] font-black text-rose-800 uppercase tracking-widest block flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-rose-600 animate-bounce" />
                        Clinical Emergency Warnings
                      </span>
                      <ul className="list-disc pl-4 text-xs text-rose-700 space-y-1 font-semibold pt-1">
                        {selectedItem.payload.emergencyWarnings?.map((warn: string, i: number) => (
                          <li key={i}>{warn}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* 4. Details for Pharmaceutical Companies */}
                {selectedItem.category === 'pharmaceutical_companies' && (
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl space-y-1.5">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">DGDA Registration Number</span>
                      <span className="text-xs font-bold text-slate-800 block font-mono">{selectedItem.payload.dgdaRegistrationNumber}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-3 rounded-xl col-span-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Corporate Headquarters</span>
                        <span className="text-xs font-semibold text-slate-800 block mt-0.5">{selectedItem.payload.headquarters}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Details for Doctors */}
                {selectedItem.category === 'doctors' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                      <span className="w-12 h-12 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-lg border border-indigo-200 shadow-sm uppercase">
                        {selectedItem.title.replace('Dr. ', '').charAt(0)}
                      </span>
                      <div>
                        <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest leading-none">Registered Specialist</h4>
                        <span className="text-sm font-extrabold text-slate-900 mt-1 block leading-tight">{selectedItem.title}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div className="bg-slate-50 p-3 rounded-xl col-span-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Practitioner Specialty</span>
                        <span className="text-xs font-bold text-slate-800 block mt-0.5 leading-tight">{selectedItem.payload.specialization}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Chamber Location</span>
                        <span className="text-xs font-semibold text-slate-800 block mt-0.5">{selectedItem.payload.city}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Consultation Price</span>
                        <span className="text-xs font-extrabold text-slate-800 block mt-0.5">BDT {selectedItem.payload.consultationFee}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl space-y-1">
                      <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest block">BMDC Verification Claim</span>
                      <p className="text-xs text-emerald-700 font-bold leading-relaxed">
                        Clinician is standard mapped in active Doctor catalogs with medical licensing compliance status verified.
                      </p>
                    </div>
                  </div>
                )}

              </div>

              {/* Drawer Footer (System tracing metadata info) */}
              <div className="bg-slate-50 p-5 border-t border-slate-100 text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  MZ Health Clinical Inventory Monograph
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
