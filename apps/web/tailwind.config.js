/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#000a24",
        "primary-container": "#14213d",
        "on-primary": "#ffffff",
        "on-primary-container": "#7c89aa",
        "secondary": "#006a63",
        "secondary-container": "#99efe5",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#006f67",
        "tertiary": "#00072c",
        "tertiary-container": "#001a60",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#5d80ff",
        "surface": "#faf8ff",
        "surface-dim": "#d2d9f4",
        "surface-bright": "#faf8ff",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f2f3ff",
        "surface-container": "#eaedff",
        "surface-container-high": "#e2e7ff",
        "surface-container-highest": "#dae2fd",
        "surface-variant": "#dae2fd",
        "on-surface": "#131b2e",
        "on-surface-variant": "#45464d",
        "outline": "#75777e",
        "outline-variant": "#c5c6ce",
        "error": "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",
        "on-error-container": "#93000a",

        // Role accents
        "role-rm": {
          DEFAULT: "#0f766e",
          surface: "#f0fdfa",
          border: "#ccfbf1",
        },
        "role-analyst": {
          DEFAULT: "#1d4ed8",
          surface: "#eff6ff",
          border: "#bfdbfe",
        },
        "role-cm": {
          DEFAULT: "#1e293b",
          surface: "#f1f5f9",
          border: "#334155",
        },
        "role-owner": {
          DEFAULT: "#6d28d9",
          surface: "#faf5ff",
          border: "#e9d5ff",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
