import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        // ── shadcn/ui CSS variable tokens (kept for compatibility) ──────────────
        border:     "hsl(var(--border))",
        input:      "hsl(var(--input))",
        ring:       "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // ── Stitch / Material Design 3 color tokens (exact names from HTML) ─────
        "primary-container":          "#00f5ff",
        "on-primary":                 "#003739",
        "on-primary-container":       "#006c71",
        "primary-fixed":              "#63f7ff",
        "primary-fixed-dim":          "#00dce5",
        "on-primary-fixed":           "#002021",
        "on-primary-fixed-variant":   "#004f53",
        "inverse-primary":            "#00696e",
        "surface-tint":               "#00dce5",
        "surface":                    "#0e131f",
        "surface-dim":                "#0e131f",
        "surface-bright":             "#343946",
        "surface-container-lowest":   "#080e1a",
        "surface-container-low":      "#161c28",
        "surface-container":          "#1a202c",
        "surface-container-high":     "#242a36",
        "surface-container-highest":  "#2f3542",
        "on-surface":                 "#dde2f3",
        "on-surface-variant":         "#b9caca",
        "inverse-surface":            "#dde2f3",
        "inverse-on-surface":         "#2b303d",
        "surface-variant":            "#2f3542",
        "outline":                    "#849495",
        "outline-variant":            "#3a494a",
        "on-background":              "#dde2f3",
        "tertiary":                   "#ebffec",
        "on-tertiary":                "#00391d",
        "tertiary-container":         "#00fd93",
        "on-tertiary-container":      "#00703e",
        "tertiary-fixed":             "#5bffa1",
        "tertiary-fixed-dim":         "#00e383",
        "on-tertiary-fixed":          "#00210e",
        "on-tertiary-fixed-variant":  "#00522c",
        "error":                      "#ffb4ab",
        "on-error":                   "#690005",
        "error-container":            "#93000a",
        "on-error-container":         "#ffdad6",
        "secondary-fixed":            "#eaddff",
        "secondary-fixed-dim":        "#d2bbff",
        "on-secondary":               "#3f008e",
        "secondary-container":        "#6001d1",
        "on-secondary-container":     "#c9aeff",
        "on-secondary-fixed":         "#25005a",
        "on-secondary-fixed-variant": "#5a00c6",

        // ── Mawi shorthand aliases (kept for existing component compatibility) ───
        mawi: {
          cyan:              "#00f5ff",
          "cyan-dim":        "#00dce5",
          "cyan-on":         "#003739",
          bg:                "#0e131f",
          surface:           "#1a202c",
          "surface-high":    "#242a36",
          "surface-highest": "#2f3542",
          "surface-bright":  "#343946",
          "on-bg":           "#dde2f3",
          purple:            "#d2bbff",
          "purple-dim":      "#c9aeff",
          "purple-container":"#6001d1",
          green:             "#00e383",
          error:             "#ffb4ab",
          outline:           "#849495",
          "outline-variant": "#3a494a",
        },
      },

      fontFamily: {
        // Stitch semantic font tokens
        "h1-display":  ["var(--font-space-grotesk)", "Space Grotesk", "sans-serif"],
        "h2-headline": ["var(--font-space-grotesk)", "Space Grotesk", "sans-serif"],
        "h3-technical":["var(--font-space-grotesk)", "Space Grotesk", "sans-serif"],
        "body-main":   ["var(--font-inter)", "Inter", "sans-serif"],
        "label-caps":  ["var(--font-inter)", "Inter", "sans-serif"],
        "mono-data":   ["var(--font-inter)", "Inter", "sans-serif"],
        // Named aliases (existing code)
        "space-grotesk": ["var(--font-space-grotesk)", "Space Grotesk", "sans-serif"],
        inter:           ["var(--font-inter)", "Inter", "sans-serif"],
      },

      fontSize: {
        "h1-display":  ["48px", { lineHeight: "1.1", letterSpacing: "-0.04em", fontWeight: "700" }],
        "h2-headline": ["32px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "600" }],
        "h3-technical":["20px", { lineHeight: "1.2", letterSpacing: "0.02em",  fontWeight: "500" }],
        "body-main":   ["16px", { lineHeight: "1.6", letterSpacing: "0em",     fontWeight: "400" }],
        "label-caps":  ["12px", { lineHeight: "1",   letterSpacing: "0.1em",   fontWeight: "700" }],
        "mono-data":   ["14px", { lineHeight: "1",   letterSpacing: "-0.01em", fontWeight: "500" }],
      },

      spacing: {
        "grid-unit":     "4px",
        "gutter":        "24px",
        "margin":        "40px",
        "container-max": "1440px",
      },

      borderRadius: {
        DEFAULT: "0.25rem",
        sm:      "0.125rem",
        md:      "0.375rem",
        lg:      "0.5rem",
        xl:      "0.75rem",
        "2xl":   "1rem",
        full:    "9999px",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "pulse-cyan": {
          "0%":   { boxShadow: "0 0 0 0 rgba(0,245,255,0.4)" },
          "70%":  { boxShadow: "0 0 0 10px rgba(0,245,255,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(0,245,255,0)" },
        },
      },

      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "pulse-cyan":     "pulse-cyan 2s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
