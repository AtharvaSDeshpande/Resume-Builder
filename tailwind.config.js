/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Reverse-engineered from the PDF template.
        accent: '#2E74B5', // job titles + key-skill bullets (steel blue)
        'accent-dark': '#1F4E79', // divider terminus + strong accents
        'accent-light': '#8DB4E2', // gradient origin for rules/dividers
        ink: '#111111', // primary body text (near-black)
        'ink-soft': '#333333',
        flag: '#dc2626', // validation flag (preview-only)
      },
      fontFamily: {
        // The template is a single Arial/Helvetica family (headings = bold weight).
        heading: ['Arial', 'Helvetica', 'Segoe UI', 'sans-serif'],
        body: ['Arial', 'Helvetica', 'Segoe UI', 'sans-serif'],
      },
      spacing: {
        a4w: '210mm',
        a4h: '297mm',
      },
    },
  },
  plugins: [],
}
