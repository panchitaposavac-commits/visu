/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'visu-blue': {
          DEFAULT: '#0025A8',
          hover: '#001E87',
          dark: '#00196B',
          light: '#1A3FCE',
        },
        'visu-mint': {
          DEFAULT: '#51DCAE',
          hover: '#3EC99B',
          dark: '#2FB588',
          light: '#76E6C3',
          50: '#F0FDF8',
          100: '#D2F6EA',
          200: '#A7F0D6',
        },
      },
    },
  },
  plugins: [],
};
