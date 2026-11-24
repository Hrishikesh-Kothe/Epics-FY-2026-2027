/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e8f4fd',
          100: '#c8e6fa',
          200: '#90cbf4',
          300: '#58b0ee',
          400: '#2995e8',
          500: '#1a7bd4',
          600: '#1361aa',
          700: '#0d4780',
          800: '#092e56',
          900: '#0a1628',
        },
        accent: {
          400: '#38d9a9',
          500: '#20c997',
          600: '#12b886',
        },
        warning: {
          400: '#ffd43b',
          500: '#fcc419',
        },
        danger: {
          400: '#ff6b6b',
          500: '#fa5252',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-in': 'slideIn 0.4s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        slideIn: { '0%': { opacity: 0, transform: 'translateX(-20px)' }, '100%': { opacity: 1, transform: 'translateX(0)' } },
      }
    },
  },
  plugins: [],
};
