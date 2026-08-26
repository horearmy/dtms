"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type Country = { iso2: string; dial: string };

export const COUNTRIES: Country[] = [
  { iso2: "AD", dial: "376" }, { iso2: "AE", dial: "971" }, { iso2: "AF", dial: "93" },
  { iso2: "AG", dial: "1268" }, { iso2: "AI", dial: "1264" }, { iso2: "AL", dial: "355" },
  { iso2: "AM", dial: "374" }, { iso2: "AO", dial: "244" }, { iso2: "AR", dial: "54" },
  { iso2: "AS", dial: "1684" }, { iso2: "AT", dial: "43" }, { iso2: "AU", dial: "61" },
  { iso2: "AW", dial: "297" }, { iso2: "AX", dial: "358" }, { iso2: "AZ", dial: "994" },
  { iso2: "BA", dial: "387" }, { iso2: "BB", dial: "1246" }, { iso2: "BD", dial: "880" },
  { iso2: "BE", dial: "32" }, { iso2: "BF", dial: "226" }, { iso2: "BG", dial: "359" },
  { iso2: "BH", dial: "973" }, { iso2: "BI", dial: "257" }, { iso2: "BJ", dial: "229" },
  { iso2: "BL", dial: "590" }, { iso2: "BM", dial: "1441" }, { iso2: "BN", dial: "673" },
  { iso2: "BO", dial: "591" }, { iso2: "BR", dial: "55" }, { iso2: "BS", dial: "1242" },
  { iso2: "BT", dial: "975" }, { iso2: "BW", dial: "267" }, { iso2: "BY", dial: "375" },
  { iso2: "BZ", dial: "501" }, { iso2: "CA", dial: "1" }, { iso2: "CD", dial: "243" },
  { iso2: "CF", dial: "236" }, { iso2: "CG", dial: "242" }, { iso2: "CH", dial: "41" },
  { iso2: "CI", dial: "225" }, { iso2: "CK", dial: "682" }, { iso2: "CL", dial: "56" },
  { iso2: "CM", dial: "237" }, { iso2: "CN", dial: "86" }, { iso2: "CO", dial: "57" },
  { iso2: "CR", dial: "506" }, { iso2: "CU", dial: "53" }, { iso2: "CV", dial: "238" },
  { iso2: "CW", dial: "599" }, { iso2: "CX", dial: "61" }, { iso2: "CY", dial: "357" },
  { iso2: "CZ", dial: "420" }, { iso2: "DE", dial: "49" }, { iso2: "DJ", dial: "253" },
  { iso2: "DK", dial: "45" }, { iso2: "DM", dial: "1767" }, { iso2: "DO", dial: "1809" },
  { iso2: "DZ", dial: "213" }, { iso2: "EC", dial: "593" }, { iso2: "EE", dial: "372" },
  { iso2: "EG", dial: "20" }, { iso2: "EH", dial: "212" }, { iso2: "ER", dial: "291" },
  { iso2: "ES", dial: "34" }, { iso2: "ET", dial: "251" }, { iso2: "FI", dial: "358" },
  { iso2: "FJ", dial: "679" }, { iso2: "FK", dial: "500" }, { iso2: "FM", dial: "691" },
  { iso2: "FO", dial: "298" }, { iso2: "FR", dial: "33" }, { iso2: "GA", dial: "241" },
  { iso2: "GB", dial: "44" }, { iso2: "GD", dial: "1473" }, { iso2: "GE", dial: "995" },
  { iso2: "GF", dial: "594" }, { iso2: "GG", dial: "44" }, { iso2: "GH", dial: "233" },
  { iso2: "GI", dial: "350" }, { iso2: "GL", dial: "299" }, { iso2: "GM", dial: "220" },
  { iso2: "GN", dial: "224" }, { iso2: "GP", dial: "590" }, { iso2: "GQ", dial: "240" },
  { iso2: "GR", dial: "30" }, { iso2: "GT", dial: "502" }, { iso2: "GU", dial: "1671" },
  { iso2: "GW", dial: "245" }, { iso2: "GY", dial: "592" }, { iso2: "HK", dial: "852" },
  { iso2: "HN", dial: "504" }, { iso2: "HR", dial: "385" }, { iso2: "HT", dial: "509" },
  { iso2: "HU", dial: "36" }, { iso2: "ID", dial: "62" }, { iso2: "IE", dial: "353" },
  { iso2: "IL", dial: "972" }, { iso2: "IM", dial: "44" }, { iso2: "IN", dial: "91" },
  { iso2: "IQ", dial: "964" }, { iso2: "IR", dial: "98" }, { iso2: "IS", dial: "354" },
  { iso2: "IT", dial: "39" }, { iso2: "JE", dial: "44" }, { iso2: "JM", dial: "1876" },
  { iso2: "JO", dial: "962" }, { iso2: "JP", dial: "81" }, { iso2: "KE", dial: "254" },
  { iso2: "KG", dial: "996" }, { iso2: "KH", dial: "855" }, { iso2: "KI", dial: "686" },
  { iso2: "KM", dial: "269" }, { iso2: "KN", dial: "1869" }, { iso2: "KP", dial: "850" },
  { iso2: "KR", dial: "82" }, { iso2: "KW", dial: "965" }, { iso2: "KY", dial: "1345" },
  { iso2: "KZ", dial: "7" }, { iso2: "LA", dial: "856" }, { iso2: "LB", dial: "961" },
  { iso2: "LC", dial: "1758" }, { iso2: "LI", dial: "423" }, { iso2: "LK", dial: "94" },
  { iso2: "LR", dial: "231" }, { iso2: "LS", dial: "266" }, { iso2: "LT", dial: "370" },
  { iso2: "LU", dial: "352" }, { iso2: "LV", dial: "371" }, { iso2: "LY", dial: "218" },
  { iso2: "MA", dial: "212" }, { iso2: "MC", dial: "377" }, { iso2: "MD", dial: "373" },
  { iso2: "ME", dial: "382" }, { iso2: "MF", dial: "590" }, { iso2: "MG", dial: "261" },
  { iso2: "MH", dial: "692" }, { iso2: "MK", dial: "389" }, { iso2: "ML", dial: "223" },
  { iso2: "MM", dial: "95" }, { iso2: "MN", dial: "976" }, { iso2: "MO", dial: "853" },
  { iso2: "MP", dial: "1670" }, { iso2: "MQ", dial: "596" }, { iso2: "MR", dial: "222" },
  { iso2: "MS", dial: "1664" }, { iso2: "MT", dial: "356" }, { iso2: "MU", dial: "230" },
  { iso2: "MV", dial: "960" }, { iso2: "MW", dial: "265" }, { iso2: "MX", dial: "52" },
  { iso2: "MY", dial: "60" }, { iso2: "MZ", dial: "258" }, { iso2: "NA", dial: "264" },
  { iso2: "NC", dial: "687" }, { iso2: "NE", dial: "227" }, { iso2: "NF", dial: "672" },
  { iso2: "NG", dial: "234" }, { iso2: "NI", dial: "505" }, { iso2: "NL", dial: "31" },
  { iso2: "NO", dial: "47" }, { iso2: "NP", dial: "977" }, { iso2: "NR", dial: "674" },
  { iso2: "NU", dial: "683" }, { iso2: "NZ", dial: "64" }, { iso2: "OM", dial: "968" },
  { iso2: "PA", dial: "507" }, { iso2: "PE", dial: "51" }, { iso2: "PF", dial: "689" },
  { iso2: "PG", dial: "675" }, { iso2: "PH", dial: "63" }, { iso2: "PK", dial: "92" },
  { iso2: "PL", dial: "48" }, { iso2: "PM", dial: "508" }, { iso2: "PR", dial: "1787" },
  { iso2: "PS", dial: "970" }, { iso2: "PT", dial: "351" }, { iso2: "PW", dial: "680" },
  { iso2: "PY", dial: "595" }, { iso2: "QA", dial: "974" }, { iso2: "RE", dial: "262" },
  { iso2: "RO", dial: "40" }, { iso2: "RS", dial: "381" }, { iso2: "RU", dial: "7" },
  { iso2: "RW", dial: "250" }, { iso2: "SA", dial: "966" }, { iso2: "SB", dial: "677" },
  { iso2: "SC", dial: "248" }, { iso2: "SD", dial: "249" }, { iso2: "SE", dial: "46" },
  { iso2: "SG", dial: "65" }, { iso2: "SH", dial: "290" }, { iso2: "SI", dial: "386" },
  { iso2: "SK", dial: "421" }, { iso2: "SL", dial: "232" }, { iso2: "SM", dial: "378" },
  { iso2: "SN", dial: "221" }, { iso2: "SO", dial: "252" }, { iso2: "SR", dial: "597" },
  { iso2: "SS", dial: "211" }, { iso2: "ST", dial: "239" }, { iso2: "SV", dial: "503" },
  { iso2: "SX", dial: "1721" }, { iso2: "SY", dial: "963" }, { iso2: "SZ", dial: "268" },
  { iso2: "TA", dial: "290" }, { iso2: "TC", dial: "1649" }, { iso2: "TD", dial: "235" },
  { iso2: "TG", dial: "228" }, { iso2: "TH", dial: "66" }, { iso2: "TJ", dial: "992" },
  { iso2: "TL", dial: "670" }, { iso2: "TM", dial: "993" }, { iso2: "TN", dial: "216" },
  { iso2: "TO", dial: "676" }, { iso2: "TR", dial: "90" }, { iso2: "TT", dial: "1868" },
  { iso2: "TV", dial: "688" }, { iso2: "TW", dial: "886" }, { iso2: "TZ", dial: "255" },
  { iso2: "UA", dial: "380" }, { iso2: "UG", dial: "256" }, { iso2: "US", dial: "1" },
  { iso2: "UY", dial: "598" }, { iso2: "UZ", dial: "998" }, { iso2: "VA", dial: "379" },
  { iso2: "VC", dial: "1784" }, { iso2: "VE", dial: "58" }, { iso2: "VG", dial: "1284" },
  { iso2: "VI", dial: "1340" }, { iso2: "VN", dial: "84" }, { iso2: "VU", dial: "678" },
  { iso2: "WF", dial: "681" }, { iso2: "WS", dial: "685" }, { iso2: "XK", dial: "383" },
  { iso2: "YE", dial: "967" }, { iso2: "YT", dial: "262" }, { iso2: "ZA", dial: "27" },
  { iso2: "ZM", dial: "260" }, { iso2: "ZW", dial: "263" },
];

function flagOf(iso2: string): string {
  const cc = iso2.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "\u{1F310}";
  return String.fromCodePoint(
    ...cc.split("").map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65),
  );
}

function displayName(iso2: string): string {
  try {
    return new Intl.DisplayNames(["id"], { type: "region" }).of(iso2.toUpperCase()) || iso2;
  } catch {
    return iso2;
  }
}

export function detectDial(): string {
  if (typeof window === "undefined") return "+62";
  try {
    const locale = navigator.language || "id-ID";
    const region =
      typeof Intl.Locale === "function"
        ? new Intl.Locale(locale).region
        : locale.split("-")[1];
    const hit = region && COUNTRIES.find((c) => c.iso2 === region.toUpperCase());
    return hit ? "+" + hit.dial : "+62";
  } catch {
    return "+62";
  }
}

export function splitPhone(phone: string): { dial: string; local: string } {
  if (phone.startsWith("+")) {
    const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
    for (const c of sorted) {
      if (phone === "+" + c.dial || phone.startsWith("+" + c.dial)) {
        return { dial: "+" + c.dial, local: phone.slice(1 + c.dial.length) };
      }
    }
    return { dial: "+62", local: phone.slice(1) };
  }
  return { dial: detectDial(), local: phone };
}

// Aturan panjang nomor lokal (digit setelah kode negara, tanpa leading 0)
const PHONE_RULES: Record<string, [number, number]> = {
  "62": [8, 12],
  "1": [10, 10],
  "65": [8, 8],
  "60": [8, 10],
  "61": [9, 9],
  "44": [9, 10],
  "91": [10, 10],
  "81": [9, 10],
  "86": [11, 11],
  "49": [9, 11],
  "66": [8, 9],
  "63": [9, 10],
  "84": [9, 10],
};

const DEFAULT_RULE: [number, number] = [7, 13];

export function phoneRule(dial: string): [number, number] {
  return PHONE_RULES[dial.replace(/\D/g, "")] || DEFAULT_RULE;
}

export function validatePhone(dial: string, local: string): string | null {
  const digits = local.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "Nomor telepon wajib diisi";
  const [min, max] = phoneRule(dial);
  if (digits.length < min || digits.length > max) {
    return `Nomor untuk +${dial.replace(/\D/g, "")} harus ${min}${max !== min ? `-${max}` : ""} digit`;
  }
  return null;
}

export function toE164(dial: string, local: string): string {
  return dial.replace(/\D/g, "") === ""
    ? ""
    : "+" + dial.replace(/\D/g, "") + local.replace(/\D/g, "").replace(/^0+/, "");
}

export default function CountryCodeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const matched = useMemo(
    () =>
      [...COUNTRIES]
        .filter((c) => ("+" + c.dial).startsWith(value))
        .sort((a, b) => a.dial.length - b.dial.length)[0],
    [value],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.dial.includes(s.replace(/\D/g, "")) ||
        displayName(c.iso2).toLowerCase().includes(s) ||
        c.iso2.toLowerCase() === s,
    );
  }, [q]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <div className="flex items-center gap-1 rounded-lg border border-[#D0D5DD] bg-white px-2 py-2 focus-within:border-[#0D6EFD] focus-within:ring-1 focus-within:ring-[#0D6EFD]">
        <span className="w-6 text-center text-base leading-none">{flagOf(matched?.iso2 || "")}</span>
        <input
          aria-label="Kode negara"
          title="Kode negara — pilih dari daftar atau ketik manual"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v.startsWith("+") ? "+" + v.slice(1).replace(/\D/g, "") : v.replace(/\D/g, ""));
          }}
          onFocus={() => setOpen(true)}
          className="w-12 bg-transparent text-sm focus:outline-none"
        />
        <button type="button" aria-label="Buka daftar kode negara" onClick={() => setOpen(!open)} className="px-0.5 text-xs text-[#667085] hover:text-[#101828]">
          ▼
        </button>
      </div>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-lg border border-[#E4E7EC] bg-white shadow-lg">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama / kode..."
            className="w-full border-b border-[#E4E7EC] px-3 py-2 text-sm focus:outline-none"
          />
          <ul className="max-h-60 overflow-auto">
            {filtered.map((c) => (
              <li key={c.iso2}>
                <button
                  type="button"
                  onClick={() => {
                    onChange("+" + c.dial);
                    setOpen(false);
                    setQ("");
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[#F7F9FC] ${
                    "+" + c.dial === value ? "bg-[#EFF4FF]" : ""
                  }`}
                >
                  <span className="text-base leading-none">{flagOf(c.iso2)}</span>
                  <span className="flex-1 truncate">{displayName(c.iso2)}</span>
                  <span className="text-xs text-[#667085]">+{c.dial}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-[#667085]">Tidak ditemukan</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
