import type { Config } from 'tailwindcss';
export default {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: { extend: { colors: { brand: '#0B4F3C', gold: '#E8B004', paper: '#EEF1EC', line: '#D5DBD3', danger: '#B3261E', good: '#1B7F4B' }, fontFamily: { sans: ['"Hind Siliguri"', 'system-ui', 'sans-serif'] } } },
  plugins: [],
} satisfies Config;
