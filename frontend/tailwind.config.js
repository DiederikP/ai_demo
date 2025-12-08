/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        barnes: {
          50: '#f8fbff',
          100: '#eef7ff',
          200: '#d7eeff',
          300: '#bfe3ff',
          400: '#8fd4ff',
          500: '#5fc4ff',
          600: '#37a9e6',
          700: '#2b7fb4',
          800: '#205a86',
          900: '#173b5a',
          // Barnes brand colors - professional business palette
          orange: '#EA580C',
          violet: '#1F7D53',
          'dark-violet': '#18230F',
          'orange-red': '#C2410C',
          'light-gray': '#F8FAFC',
          'dark-gray': '#475569',
          'blue': '#2563EB',
          'blue-dark': '#1E40AF'
        }
      },
      fontFamily: {
        'barnes-serif': ['Libre Baskerville', 'serif'],
        'barnes-sans': ['Lato', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem'
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-subtle': 'bounceSubtle 0.6s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        }
      }
    },
  },
  plugins: [],
}
