/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F3F5F0',
        surface: '#FFFFFF',
        ink: '#16211E',
        muted: '#68746D',
        line: '#DBD9CE',
        pine: {
          DEFAULT: '#1F3D3A',
          light: '#2F5650',
          dark: '#132623',
        },
        gold: {
          DEFAULT: '#C9A227',
          light: '#E4C868',
          dark: '#9A7B18',
        },
        brick: {
          DEFAULT: '#B54834',
          light: '#D5735C',
          dark: '#8C3423',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        card: '10px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(22, 33, 30, 0.06), 0 1px 0 rgba(22,33,30,0.04)',
      },
    },
  },
  plugins: [],
}
