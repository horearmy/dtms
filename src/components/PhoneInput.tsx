'use client';

import { useState, useRef, useEffect, useMemo } from 'react';

type Country = { code: string; name: string; dial: string; flag: string; maxLen: number };

const COUNTRIES: Country[] = [
  { code: 'ID', name: 'Indonesia', dial: '+62', flag: '\u{1F1EE}\u{1F1E9}', maxLen: 12 },
  { code: 'MY', name: 'Malaysia', dial: '+60', flag: '\u{1F1F2}\u{1F1FE}', maxLen: 10 },
  { code: 'SG', name: 'Singapore', dial: '+65', flag: '\u{1F1F8}\u{1F1EC}', maxLen: 8 },
  { code: 'TH', name: 'Thailand', dial: '+66', flag: '\u{1F1F9}\u{1F1ED}', maxLen: 9 },
  { code: 'PH', name: 'Philippines', dial: '+63', flag: '\u{1F1F5}\u{1F1ED}', maxLen: 10 },
  { code: 'VN', name: 'Vietnam', dial: '+84', flag: '\u{1F1FB}\u{1F1F3}', maxLen: 9 },
  { code: 'JP', name: 'Japan', dial: '+81', flag: '\u{1F1EF}\u{1F1F5}', maxLen: 10 },
  { code: 'KR', name: 'South Korea', dial: '+82', flag: '\u{1F1F0}\u{1F1F7}', maxLen: 10 },
  { code: 'CN', name: 'China', dial: '+86', flag: '\u{1F1E8}\u{1F1F3}', maxLen: 11 },
  { code: 'IN', name: 'India', dial: '+91', flag: '\u{1F1EE}\u{1F1F3}', maxLen: 10 },
  { code: 'US', name: 'United States', dial: '+1', flag: '\u{1F1FA}\u{1F1F8}', maxLen: 10 },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '\u{1F1EC}\u{1F1E7}', maxLen: 10 },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '\u{1F1E6}\u{1F1FA}', maxLen: 9 },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '\u{1F1E9}\u{1F1EA}', maxLen: 11 },
  { code: 'AE', name: 'UAE', dial: '+971', flag: '\u{1F1E6}\u{1F1EA}', maxLen: 9 },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', flag: '\u{1F1F8}\u{1F1E6}', maxLen: 9 },
  { code: 'TW', name: 'Taiwan', dial: '+886', flag: '\u{1F1F9}\u{1F1FC}', maxLen: 9 },
];

const DEFAULT_COUNTRY = COUNTRIES[0]; // Indonesia

interface PhoneInputProps {
  value: string;
  onChange: (e164: string) => void;
  className?: string;
  placeholder?: string;
}

function formatDisplay(dial: string, number: string): string {
  if (!number) return dial;
  return `${dial} ${number}`;
}

export default function PhoneInput({ value, onChange, className = '', placeholder = '8xx xxx xxx' }: PhoneInputProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Parse existing value
  const { country, number } = useMemo(() => {
    if (!value) return { country: DEFAULT_COUNTRY, number: '' };
    const match = COUNTRIES.find(c => value.startsWith(c.dial));
    if (match) return { country: match, number: value.slice(match.dial.length) };
    return { country: DEFAULT_COUNTRY, number: value.replace(/^\+/, '') };
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = useMemo(() => {
    if (!query) return COUNTRIES;
    const q = query.toLowerCase();
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q));
  }, [query]);

  function selectCountry(c: Country) {
    onChange(c.dial + number);
    setOpen(false);
    setQuery('');
  }

  function handleNumberChange(val: string) {
    let digits = val.replace(/\D/g, '');
    if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
    digits = digits.slice(0, country.maxLen);
    onChange(country.dial + digits);
  }

  return (
    <div ref={ref} className="relative flex">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 items-center gap-1.5 rounded-l-lg border border-r-0 border-[#E4E7EC] bg-white px-2.5 text-sm hover:bg-[#F7F9FC] transition"
      >
        <span className="text-base leading-none">{country.flag}</span>
        <span className="text-xs font-semibold text-[#667085]">{country.dial}</span>
        <svg className={`h-3 w-3 text-[#667085] transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 4l4 4 4-4" /></svg>
      </button>
      <input
        id="phone-number"
        name="phone"
        required
        value={number}
        onChange={(e) => handleNumberChange(e.target.value)}
        className={className + ' rounded-l-none flex-1'}
        placeholder={placeholder}
        maxLength={country.maxLen}
      />
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-[#E4E7EC] bg-white shadow-lg">
          <div className="p-2">
            <input
              id="phone-country-search"
              name="countrySearch"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari negara..."
              className="w-full rounded-md border border-[#E4E7EC] bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#0D6EFD]"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(c => (
              <button
                key={c.code}
                type="button"
                onClick={() => selectCountry(c)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#F7F9FC] transition ${c.code === country.code ? 'bg-blue-50 font-semibold' : ''}`}
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span className="flex-1 text-xs text-[#101828]">{c.name}</span>
                <span className="text-xs font-semibold text-[#667085]">{c.dial}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-[#667085]">Tidak ditemukan</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { COUNTRIES, DEFAULT_COUNTRY };
