/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2563eb",
          hover: "#1d4ed8",
        },
        success: {
          DEFAULT: "#10b981",
          hover: "#059669",
        },
        danger: {
          DEFAULT: "rgba(239, 68, 68, 0.9)",
          hover: "rgba(220, 38, 38, 0.9)",
        },
      },
      backgroundImage: {
        "premium-gradient": "linear-gradient(135deg, rgb(248 250 252) 0%, rgb(219 234 254) 100%)",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0, 0, 0, 0.08)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        rise: "rise 500ms ease-out",
      },
    },
  },
  plugins: [],
};
