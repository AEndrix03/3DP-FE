export default {
  content: [
    "./src/**/*.{html,ts}",
    "./node_modules/primeng/**/*.{js,ts}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('tailwindcss-primeui')
  ],
}
