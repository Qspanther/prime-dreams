'use client';

import { useLanguage } from '../lib/i18n';
import { Languages } from 'lucide-react';

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs font-black text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB] transition"
      title={lang === 'en' ? 'Switch to Hindi' : 'Switch to English'}
      aria-label={lang === 'en' ? 'Switch to Hindi' : 'Switch to English'}
    >
      <Languages className="w-3.5 h-3.5" />
      <span>{lang === 'en' ? 'EN' : 'हिं'}</span>
    </button>
  );
}