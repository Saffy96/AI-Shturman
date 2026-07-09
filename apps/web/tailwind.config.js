/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        road: {
          50: "#f7faf9",
          100: "#e6f3ef",
          500: "#0f766e",
          600: "#0b635d",
          900: "#12312d"
        },
        fuel: {
          500: "#f97316",
          600: "#ea580c"
        }
      },
      boxShadow: {
        soft: "0 16px 45px rgba(15, 23, 42, 0.10)"
      }
    }
  },
  plugins: []
};
