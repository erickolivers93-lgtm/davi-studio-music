/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          dark: '#090D0B',
          card: '#101714',
          panel: '#131C18',
          border: '#1E2D24',
          accent: '#10B981'
        }
      }
    },
  },
  plugins: [],
}
