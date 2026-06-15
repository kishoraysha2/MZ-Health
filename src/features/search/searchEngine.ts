/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SearchCategory, SearchResultItem, SearchMatch } from './types';

// Broad Synonym Dictionary for clinical symptoms, common translations, and layman terms
export const SEARCH_SYNONYMS: Record<string, string[]> = {
  // Symptoms & Layman Terms
  'fever': ['paracetamol', 'napa', 'ace', 'dengue', 'influenza', 'paracitamol', 'জ্বর', 'jhor', 'jwar'],
  'jhor': ['paracetamol', 'napa', 'ace', 'dengue', 'influenza', 'জ্বর'],
  'জ্বর': ['paracetamol', 'napa', 'ace', 'dengue', 'influenza'],
  'headache': ['paracetamol', 'napa', 'ace', 'migraine', 'matha betha', 'painkiller', 'মাথাব্যথা'],
  'matha betha': ['paracetamol', 'napa', 'ace', 'migraine', 'mathabyatha'],
  'মাথাব্যথা': ['paracetamol', 'napa', 'ace', 'migraine'],
  'gastric': ['omeprazole', 'seclo', 'losectil', 'acidity', 'pantoprazole', 'heartburn', 'ulcer', 'গ্যাস্ট্রিক', 'gas'],
  'gas': ['omeprazole', 'seclo', 'losectil', 'acidity', 'pantoprazole', 'গ্যাস্ট্রিক'],
  'গ্যাস্ট্রিক': ['omeprazole', 'seclo', 'losectil', 'acidity', 'pantoprazole'],
  'acidity': ['omeprazole', 'seclo', 'losectil', 'pantoprazole', 'antacid'],
  'stomach ache': ['omeprazole', 'antacid', 'pet betha', 'seclo', 'পেট ব্যথা'],
  'pet betha': ['omeprazole', 'antacid', 'seclo'],
  'পেট ব্যথা': ['omeprazole', 'antacid', 'seclo'],
  'pressure': ['atorvastatin', 'amlodipine', 'hypertension', 'blood pressure', 'উচ্চ রক্তচাপ'],
  'hypertension': ['atorvastatin', 'amlodipine', 'blood pressure', 'উচ্চ রক্তচাপ'],
  'উচ্চ রক্তচাপ': ['atorvastatin', 'amlodipine', 'hypertension'],
  'diabetes': ['metformin', 'insulin', 'sugar', 'diabetic', 'ডায়াবেটিস'],
  'sugar': ['metformin', 'insulin', 'diabetes', 'ডায়াবেটিস'],
  'ডায়াবেটিস': ['metformin', 'insulin', 'diabetes'],
  'cough': ['azithromycin', 'fexo', 'fexofenadine', 'cold', 'sneeze', 'কাশি', 'kashi'],
  'kaশি': ['azithromycin', 'fexo', 'cold', 'কাশি'],
  'কাশি': ['azithromycin', 'fexo', 'cold'],
  'flu': ['paracetamol', 'napa', 'ace', 'influenza', 'cold'],
  'cold': ['paracetamol', 'napa', 'fexofenadine', 'fexo', 'cough'],
  'infection': ['azithromycin', 'ceftriaxone', 'antibiotic'],
  'antibiotic': ['azithromycin', 'ceftriaxone'],
  'heart': ['cardiologist', 'cardiology', 'atorvastatin', 'chest pain', 'beximco', 'হৃদরোগ'],
  'হৃদরোগ': ['cardiologist', 'cardiology', 'atorvastatin', 'chest pain'],
  'kidney': ['nephrologist', 'nephrology', 'renal'],
  'eye': ['ophthalmologist', 'চোখ', 'vision', 'glaucoma'],
  'চোখ': ['ophthalmologist', 'vision', 'eye clinic'],
  'skin': ['dermatologist', 'dermatology', 'skin allergy', 'cream'],
  'allergy': ['fexofenadine', 'fexo', 'dermatology', 'allergen', 'অ্যালার্জি']
};

/**
 * Basic transliteration mapping to approximate Bengali input to English letters.
 * Helps type Bengali phonetically (e.g., "beximco" -> "বেক্সিমকো" or "napa" -> "নাপা").
 */
export function phoneticTransliterate(text: string): string {
  const input = text.toLowerCase().trim();
  
  // Basic character translations
  const map: Record<string, string> = {
    'প': 'p', 'ফ': 'f', 'ব': 'b', 'ভ': 'v', 'ম': 'm',
    'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
    'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh',
    'চ': 'ch', 'ছ': 'ch', 'জ': 'j', 'ঝ': 'jh',
    'র': 'r', 'ল': 'l', 'স': 's', 'শ': 'sh', 'ষ': 'sh', 'হ': 'h',
    'এ': 'e', 'ও': 'o', 'ই': 'i', 'উ': 'u', 'আ': 'a',
    'ো': 'o', 'ে': 'e', 'ি': 'i', 'া': 'a', 'ী': 'i', 'ু': 'u', 'ূ': 'u',
    'য়': 'y', 'ড়': 'r', 'ঢ়': 'r', 'ৎ': 't', 'ং': 'ng', 'ঃ': 'h', 'ঁ': 'n'
  };

  let result = '';
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    result += map[char] || char;
  }
  
  return result;
}

/**
 * Clean up strings for soundex/phonetic extraction.
 */
function cleanForSoundex(str: string): string {
  return str.toUpperCase().replace(/[^A-Z]/g, '');
}

/**
 * Standard Soundex algorithm implementation for phonetic consonants matching.
 */
export function getSoundex(word: string): string {
  const clean = cleanForSoundex(word);
  if (!clean) return '';

  const firstLetter = clean[0];
  const mappings: Record<string, string> = {
    'B': '1', 'F': '1', 'P': '1', 'V': '1',
    'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
    'D': '3', 'T': '3',
    'L': '4',
    'M': '5', 'N': '5',
    'R': '6'
  };

  let code = firstLetter;
  let prevCode = mappings[firstLetter] || '';

  for (let i = 1; i < clean.length; i++) {
    const char = clean[i];
    const currentCode = mappings[char] || '';
    if (currentCode && currentCode !== prevCode) {
      code += currentCode;
      prevCode = currentCode;
    } else if (!currentCode) {
      prevCode = ''; // restart tracking after skipped characters (vowels)
    }
    if (code.length === 4) break;
  }

  return code.padEnd(4, '0');
}

/**
 * Core matching evaluation for search entities.
 * Returns score (0 - 100) and specific matches detected.
 */
export function evaluateMatch(
  queryText: string,
  targetEn: string,
  targetBn: string = '',
  additionalMetadata: string[] = [],
  synonymKeys: string[] = []
): { score: number; matches: SearchMatch[] } {
  const cleanQuery = queryText.toLowerCase().trim();
  const enLower = targetEn.toLowerCase().trim();
  const bnLower = targetBn.toLowerCase().trim();
  
  if (!cleanQuery) return { score: 0, matches: [] };

  const matchesList: SearchMatch[] = [];
  let score = 0;

  // 1. EXACT Matches (100 pts)
  if (enLower === cleanQuery) {
    matchesList.push({ field: 'name', type: 'exact', matchedText: targetEn });
    score = Math.max(score, 100);
  }
  if (bnLower === cleanQuery && bnLower) {
    matchesList.push({ field: 'bengaliName', type: 'exact', matchedText: targetBn });
    score = Math.max(score, 100);
  }

  // 2. PREFIX Matches (75-85 pts)
  if (enLower.startsWith(cleanQuery)) {
    matchesList.push({ field: 'name', type: 'prefix', matchedText: targetEn });
    score = Math.max(score, 85);
  }
  if (bnLower.startsWith(cleanQuery) && bnLower) {
    matchesList.push({ field: 'bengaliName', type: 'prefix', matchedText: targetBn });
    score = Math.max(score, 85);
  }

  // 3. SYNONYM Matches (70-80 pts)
  for (const sKey of synonymKeys) {
    const synonyms = SEARCH_SYNONYMS[sKey.toLowerCase()] || [];
    if (synonyms.some(syn => syn.includes(cleanQuery) || cleanQuery.includes(syn))) {
      matchesList.push({ field: 'synonym', type: 'synonym', matchedText: sKey });
      score = Math.max(score, 80);
    }
  }
  // Check global synonym terms
  for (const [key, list] of Object.entries(SEARCH_SYNONYMS)) {
    if (cleanQuery.includes(key) || key.includes(cleanQuery)) {
      if (list.some(s => enLower.includes(s) || bnLower.includes(s))) {
        matchesList.push({ field: 'synonym', type: 'synonym', matchedText: key });
        score = Math.max(score, 75);
      }
    }
  }

  // 4. PARTIAL / Substring Matches (50-60 pts)
  if (enLower.includes(cleanQuery)) {
    matchesList.push({ field: 'name', type: 'partial', matchedText: targetEn });
    score = Math.max(score, 60);
  }
  if (bnLower.includes(cleanQuery) && bnLower) {
    matchesList.push({ field: 'bengaliName', type: 'partial', matchedText: targetBn });
    score = Math.max(score, 60);
  }

  // 5. TRANSLITERATED / BENGALI MATCH (45-55 pts)
  const transliteratedQuery = phoneticTransliterate(cleanQuery);
  const transliteratedBn = phoneticTransliterate(bnLower);
  if (transliteratedBn && (transliteratedBn.includes(cleanQuery) || cleanQuery.includes(transliteratedBn))) {
    matchesList.push({ field: 'bengaliName', type: 'bengali', matchedText: targetBn });
    score = Math.max(score, 55);
  }
  if (enLower.includes(transliteratedQuery) && cleanQuery !== transliteratedQuery) {
    matchesList.push({ field: 'name', type: 'bengali', matchedText: targetEn });
    score = Math.max(score, 50);
  }

  // 6. PHONETIC Match via Soundex (40-50 pts)
  const wordsQuery = cleanQuery.split(/[\s\-]+/);
  const wordsTarget = enLower.split(/[\s\-]+/);
  
  for (const wQ of wordsQuery) {
    if (wQ.length < 3) continue;
    const soundexQ = getSoundex(wQ);
    
    for (const wT of wordsTarget) {
      if (wT.length < 3) continue;
      if (getSoundex(wT) === soundexQ) {
        matchesList.push({ field: 'name', type: 'phonetic', matchedText: wT });
        score = Math.max(score, 45);
      }
    }
  }

  // 7. ADDITIONAL METADATA matches (30-40 pts)
  for (const meta of additionalMetadata) {
    const metaLower = String(meta).toLowerCase();
    if (metaLower.includes(cleanQuery)) {
      matchesList.push({ field: 'metadata', type: 'partial', matchedText: meta });
      score = Math.max(score, 35);
    }
  }

  return { score, matches: matchesList };
}

/**
 * Filter and sort results using evaluated score & categorization constraints.
 */
export function runSearch(
  query: string,
  category: SearchCategory,
  dataset: SearchResultItem[]
): SearchResultItem[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) {
    // Return all or defaults for category
    return category === 'all' 
      ? dataset 
      : dataset.filter(item => item.category === category);
  }

  return dataset
    .map(item => {
      // Create properties to search against
      let targetEn = item.title;
      let targetBn = item.bengaliTitle || '';
      let meta: string[] = [];
      let synKeys: string[] = [item.title];

      if (item.subtitle) {
        meta.push(item.subtitle);
        synKeys.push(item.subtitle);
      }

      if (item.category === 'medicines') {
        meta.push(item.payload.strength || '');
        meta.push(item.payload.dosageForm || '');
        meta.push(item.payload.genericName || '');
        meta.push(item.payload.manufacturerName || '');
      } else if (item.category === 'diseases') {
        meta.push(item.payload.icd10 || '');
        meta.push(item.payload.icd11 || '');
        if (item.payload.symptoms) meta.push(...item.payload.symptoms);
        if (item.payload.severityLevel) meta.push(item.payload.severityLevel);
      } else if (item.category === 'doctors') {
        meta.push(item.payload.specialization || '');
        meta.push(item.payload.city || '');
      } else if (item.category === 'generics') {
        meta.push(item.payload.therapeuticClass || '');
      }

      const evalResult = evaluateMatch(normalizedQuery, targetEn, targetBn, meta, synKeys);
      return {
        ...item,
        relevanceScore: evalResult.score,
        matches: evalResult.matches
      };
    })
    .filter(item => {
      // Filter out low scores and enforce category
      const matchesCategory = category === 'all' || item.category === category;
      return matchesCategory && item.relevanceScore > 0;
    })
    .sort((a, b) => {
      // Sort by score descending, then alphabetically
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return a.title.localeCompare(b.title);
    });
}
