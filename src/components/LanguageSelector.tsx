/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAuthStore } from '../store/authStore';

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage } = useAuthStore();

  return (
    <button
      onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition duration-150-all border border-slate-200/60 shadow-xs cursor-pointer"
      title={language === 'en' ? 'বাংলায় দেখুন' : 'Switch to English'}
      id="global-language-swap-trigger"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-3.5 w-3.5 text-slate-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        id="language-svg-icon"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 11.37 7.37 16.5 3 19"
        />
      </svg>
      <span>{language === 'en' ? 'বাংলা' : 'English'}</span>
    </button>
  );
};
