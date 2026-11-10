'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type Lang = 'en' | 'hi';

const STORAGE_KEY = 'prime_dreems_lang';

const dictionaries: Record<string, Record<string, string>> = {
  en: {
    home: 'Home',
    matches: 'Matches',
    my_teams: 'My Teams',
    wallet: 'Wallet',
    rewards: 'Rewards',
    guru: 'Guru',
    notifications: 'Notifications',
    login: 'Login',
    logout: 'Logout',
    signup: 'Sign Up',
    add_cash: 'Add Cash',
    withdraw: 'Withdraw',
    deposit: 'Deposit',
    winnings: 'Winnings',
    bonus: 'Bonus',
    balance: 'Balance',
    history: 'History',
    join_contest: 'Join Contest',
    practice: 'Practice',
    private_contests: 'Private Contests',
    create_team: 'Create Team',
    team_builder: 'Team Builder',
    captain: 'Captain',
    vice_captain: 'Vice-Captain',
    credits: 'Credits',
    selected_by: 'Selected By',
    last_match: 'Last Match',
    avg_points: 'Avg Points',
    form: 'Form',
    playing_xi: 'Playing XI',
    prize_breakup: 'Prize Breakup',
    winners: 'Winners',
    win_probability: 'Win Probability',
    you_are_winning: 'You are winning',
    share_team: 'Share Team',
    switch_contest: 'Switch Contest',
    rookie: 'Rookie',
    language: 'Language',
    english: 'English',
    hindi: 'Hindi',
    dreamcoins: 'DreamCoins',
    spin: 'Spin',
    scratch: 'Scratch',
    missions: 'Missions',
    claim: 'Claim',
    daily_reward: 'Daily Reward',
    copy_team: 'Copy Team',
    expert_teams: 'Expert Teams',
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    submit: 'Submit',
    search: 'Search',
  },
  hi: {
    home: 'होम',
    matches: 'मैच',
    my_teams: 'मेरी टीमें',
    wallet: 'वॉलेट',
    rewards: 'रिवॉर्ड्स',
    guru: 'गुरु',
    notifications: 'सूचनाएं',
    login: 'लॉगिन',
    logout: 'लॉगआउट',
    signup: 'साइन अप',
    add_cash: 'कैश जोड़ें',
    withdraw: 'निकासी',
    deposit: 'जमा',
    winnings: 'जीत',
    bonus: 'बोनस',
    balance: 'बैलेंस',
    history: 'इतिहास',
    join_contest: 'कॉन्टेस्ट जॉइन करें',
    practice: 'प्रैक्टिस',
    private_contests: 'प्राइवेट कॉन्टेस्ट',
    create_team: 'टीम बनाएं',
    team_builder: 'टीम बिल्डर',
    captain: 'कप्तान',
    vice_captain: 'उप-कप्तान',
    credits: 'क्रेडिट्स',
    selected_by: 'द्वारा चुना गया',
    last_match: 'पिछला मैच',
    avg_points: 'औसत अंक',
    form: 'फॉर्म',
    playing_xi: 'प्लेइंग XI',
    prize_breakup: 'प्राइज़ ब्रेकअप',
    winners: 'विजेता',
    win_probability: 'जीत की संभावना',
    you_are_winning: 'आप जीत रहे हैं',
    share_team: 'टीम शेयर करें',
    switch_contest: 'कॉन्टेस्ट बदलें',
    rookie: 'रूकी',
    language: 'भाषा',
    english: 'English',
    hindi: 'हिंदी',
    dreamcoins: 'ड्रीमकॉइन्स',
    spin: 'स्पिन',
    scratch: 'स्क्रैच',
    missions: 'मिशन',
    claim: 'क्लेम करें',
    daily_reward: 'डेली रिवॉर्ड',
    copy_team: 'टीम कॉपी करें',
    expert_teams: 'एक्सपर्ट टीमें',
    loading: 'लोड हो रहा है...',
    save: 'सेव करें',
    cancel: 'रद्द करें',
    submit: 'सबमिट करें',
    search: 'खोजें',
  },
};

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Initialize 'en' so SSR and the first client render match (no hydration
  // mismatch); the persisted preference is applied in the mount effect below.
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'hi') setLangState(stored);
    } catch (_) {}
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (_) {}
  }, []);

  const t = useCallback(
    (key: string): string => dictionaries[lang]?.[key] ?? dictionaries.en[key] ?? key,
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}