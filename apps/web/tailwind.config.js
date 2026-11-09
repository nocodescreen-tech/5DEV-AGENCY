/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Les couleurs passent par des variables CSS : le thème sombre les remplace
      // d'un bloc, et /opacité continue de fonctionner (<alpha-value>).
      colors: {
        brand: 'rgb(var(--c-brand) / <alpha-value>)',
        brandDark: 'rgb(var(--c-brand-dark) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        inkSoft: 'rgb(var(--c-ink-soft) / <alpha-value>)',
        paper: 'rgb(var(--c-paper) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        wash: 'rgb(var(--c-wash) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      maxWidth: { prose: '68ch' },
    },
  },
  plugins: [],
};
