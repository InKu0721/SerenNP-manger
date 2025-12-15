/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 根据图标配色调整 - 淡青薄荷绿主色调
        'cyber': {
          50: '#f0fdfd',
          100: '#ccfbfb',
          200: '#9ef7f7',
          300: '#7ce8e8',
          400: '#5cd4d4',
          500: '#4ecdc4',  // 主色 - 薄荷绿
          600: '#3db5ad',
          700: '#2f9089',
          800: '#25706b',
          900: '#1c5451',
        },
        // 紫灰色调 - 与图标背景协调
        'dark': {
          50: '#f5f5f7',
          100: '#e8e9ed',
          200: '#d1d3db',
          300: '#b0b5c3',
          400: '#8b92a5',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#0a0c10',
        },
        // 添加粉色强调色 - 与图标中的粉红色协调
        'accent': {
          50: '#fdf2f4',
          100: '#fce7eb',
          200: '#f9d0d9',
          300: '#f5a8bb',
          400: '#ee7696',
          500: '#e45577',  // 图标中的粉红色调
          600: '#cf3462',
          700: '#af264f',
          800: '#912346',
          900: '#7b2141',
        },
        // 淡紫色 - 与图标眼睛颜色协调
        'violet': {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b7cf6',  // 图标眼睛的紫色
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        }
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
        'display': ['Orbitron', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(78, 205, 196, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(78, 205, 196, 0.8)' },
        }
      }
    },
  },
  plugins: [],
}
