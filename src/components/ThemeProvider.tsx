"use client";

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

const ThemeContext = createContext<Theme>({
  primaryColor: '#2563eb',
  secondaryColor: '#1e40af',
  accentColor: '#3b82f6',
});

export function useTheme() {
  return useContext(ThemeContext);
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function generateShades(hex: string): Record<string, string> {
  const [h, s] = hexToHsl(hex);
  return {
    '50': `hsl(${h}, ${s}%, 97%)`,
    '100': `hsl(${h}, ${s}%, 93%)`,
    '500': hex,
    '600': `hsl(${h}, ${Math.min(100, s + 10)}%, ${Math.max(20, 40 - 5)}%)`,
    '700': `hsl(${h}, ${Math.min(100, s + 15)}%, ${Math.max(15, 35 - 10)}%)`,
    '900': `hsl(${h}, ${Math.min(100, s + 20)}%, ${Math.max(10, 25 - 10)}%)`,
  };
}

export function ThemeProvider({
  theme,
  children,
}: {
  theme: Theme;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const shades = generateShades(theme.primaryColor);
    const root = document.documentElement;
    Object.entries(shades).forEach(([shade, color]) => {
      root.style.setProperty(`--color-brand-${shade}`, color);
    });
  }, [theme]);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}
