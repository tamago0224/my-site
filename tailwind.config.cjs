/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	darkMode: 'class',
	theme: {
		extend: {
			fontFamily: {
				sans: ['"JetBrains Mono"', '"Fira Code"', '"Cascadia Code"', 'Consolas', 'monospace'],
				mono: ['"JetBrains Mono"', '"Fira Code"', '"Cascadia Code"', 'Consolas', 'monospace'],
			},
			colors: {
				surface: {
					DEFAULT: '#f9fafb',
					dark: '#0d1117',
				},
				'surface-card': {
					DEFAULT: 'rgba(255, 255, 255, 0.9)',
					dark: 'rgba(22, 27, 34, 0.95)',
				},
				accent: {
					DEFAULT: '#4ade80',
					light: '#86efac',
					dark: '#22c55e',
				},
				'accent-secondary': {
					DEFAULT: '#fbbf24',
					light: '#fcd34d',
					dark: '#f59e0b',
				},
				term: {
					green: '#4ade80',
					'green-dim': '#16a34a',
					amber: '#fbbf24',
					red: '#f87171',
					blue: '#60a5fa',
					gray: '#6b7280',
					border: '#30363d',
					'border-light': '#d0d7de',
					'bg-dark': '#0d1117',
					'bg-card-dark': '#161b22',
					'bg-light': '#f9fafb',
					'bg-card-light': '#ffffff',
				},
			},
			animation: {
				'fade-in': 'fadeIn 0.4s ease-out forwards',
				'fade-in-up': 'fadeInUp 0.4s ease-out forwards',
				'slide-down': 'slideDown 0.2s ease-out forwards',
				'blink': 'blink 1s step-end infinite',
				'scanline': 'scanline 8s linear infinite',
			},
			keyframes: {
				fadeIn: {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' },
				},
				fadeInUp: {
					'0%': { opacity: '0', transform: 'translateY(12px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' },
				},
				slideDown: {
					'0%': { opacity: '0', transform: 'translateY(-8px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' },
				},
				blink: {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0' },
				},
				scanline: {
					'0%': { transform: 'translateY(-100%)' },
					'100%': { transform: 'translateY(100vh)' },
				},
			},
		},
	},
	plugins: [
		require('@tailwindcss/typography'),
	],
}
