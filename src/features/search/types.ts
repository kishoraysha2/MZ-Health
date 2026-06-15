/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  PharmaceuticalCompanyEntity, 
  MedicineGenericEntity, 
  MedicineEntity, 
  DiseaseEntity 
} from '../mdm/types';
import { DoctorCatalog } from '../../types';

export type SearchCategory = 'all' | 'medicines' | 'diseases' | 'generics' | 'pharmaceutical_companies' | 'doctors';

export interface SearchMatch {
  field: string;
  type: 'exact' | 'prefix' | 'partial' | 'bengali' | 'phonetic' | 'synonym';
  matchedText: string;
}

export interface SearchResultItem {
  id: string;
  category: Exclude<SearchCategory, 'all'>;
  title: string; // Primary name (English)
  subtitle?: string; // High-level subtitle (e.g., "SQUARE Pharmaceuticals" or "Paracetamol")
  bengaliTitle?: string; // Bengali translation
  payload: any; // The whole underlying entity
  relevanceScore: number;
  matches: SearchMatch[];
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  category: SearchCategory;
  timestamp: string; // ISO String
  resultCount: number;
}

export interface PopularSearchItem {
  query: string;
  category: SearchCategory;
  searchCount: number;
  tag?: string;
}

export interface SearchAnalytics {
  totalSearches: number;
  successfulSearches: number;
  zeroResultSearches: number;
  categoryDistribution: Record<string, number>;
  topQueries: { query: string; count: number; category: SearchCategory }[];
  recentActivity: SearchHistoryItem[];
  volumeTrend: { date: string; count: number; success: number; failed: number }[];
}
