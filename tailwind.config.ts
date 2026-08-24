import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
    darkMode: "class",
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
        extend: {
                colors: {
                        background: 'hsl(var(--background))',
                        foreground: 'hsl(var(--foreground))',
                        card: {
                                DEFAULT: 'hsl(var(--card))',
                                foreground: 'hsl(var(--card-foreground))'
                        },
                        popover: {
                                DEFAULT: 'hsl(var(--popover))',
                                foreground: 'hsl(var(--popover-foreground))'
                        },
                        primary: {
                                DEFAULT: 'hsl(var(--primary))',
                                foreground: 'hsl(var(--primary-foreground))'
                        },
                        secondary: {
                                DEFAULT: 'hsl(var(--secondary))',
                                foreground: 'hsl(var(--secondary-foreground))'
                        },
                        muted: {
                                DEFAULT: 'hsl(var(--muted))',
                                foreground: 'hsl(var(--muted-foreground))'
                        },
                        accent: {
                                DEFAULT: 'hsl(var(--accent))',
                                foreground: 'hsl(var(--accent-foreground))'
                        },
                        destructive: {
                                DEFAULT: 'hsl(var(--destructive))',
                                foreground: 'hsl(var(--destructive-foreground))'
                        },
                        border: 'hsl(var(--border))',
                        input: 'hsl(var(--input))',
                        ring: 'hsl(var(--ring))',
                        chart: {
                                '1': 'hsl(var(--chart-1))',
                                '2': 'hsl(var(--chart-2))',
                                '3': 'hsl(var(--chart-3))',
                                '4': 'hsl(var(--chart-4))',
                                '5': 'hsl(var(--chart-5))'
                        },
                        // Kozy brand palette
                        navy: {
                                DEFAULT: '#0A192F',
                                50: '#E8ECF2',
                                100: '#C8D2DF',
                                200: '#9FB1C7',
                                300: '#6F88A8',
                                400: '#3F5F88',
                                500: '#1B3A5F',
                                600: '#102740',
                                700: '#0A192F',
                                800: '#07101F',
                                900: '#040A14',
                        },
                        gold: {
                                DEFAULT: '#D4AF37',
                                50: '#FBF5E0',
                                100: '#F7EBBF',
                                200: '#EFD87E',
                                300: '#E3BE4F',
                                400: '#D4AF37',
                                500: '#B8962B',
                                600: '#947621',
                                700: '#6B541A',
                                800: '#4A3A12',
                                900: '#2D2410',
                        },
                        linen: {
                                DEFAULT: '#F8F9FA',
                                50: '#FFFFFF',
                                100: '#F8F9FA',
                                200: '#EEF0F2',
                                300: '#E2E5E9',
                                400: '#CCD1D8',
                                500: '#B0B7C2',
                        },
                },
                fontFamily: {
                        sans: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
                        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
                },
                borderRadius: {
                        lg: 'var(--radius)',
                        md: 'calc(var(--radius) - 2px)',
                        sm: 'calc(var(--radius) - 4px)'
                }
        }
  },
  plugins: [tailwindcssAnimate],
};
export default config;
