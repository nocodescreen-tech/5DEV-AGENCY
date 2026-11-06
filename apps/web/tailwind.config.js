/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#f47721',
        brandDark: '#d9610f',
        ink: '#171717',
        inkSoft: '#2a2a2a',
        paper: '#ffffff',
        muted: '#6b6b6b',
        line: '#e6e2dd',
        wash: '#faf8f5',
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
