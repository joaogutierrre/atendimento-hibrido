/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f172a',
        surface: '#1e293b',
        border: '#334155',
        'text-primary': '#f1f5f9',
        'text-secondary': '#94a3b8',
        ai: '#6366f1',
        human: '#10b981',
        alert: '#f59e0b',
        telegram: '#229ED9',
        whatsapp: '#25D366',
      },
    },
  },
  plugins: [],
}
