/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	darkMode: 'class',
	theme: {
		extend: {
			fontFamily: {
				sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
			},
			colors: {
				surface: {
					DEFAULT: '#f8f9fc',
					dark: '#0f0f17',
				},
				'surface-card': {
					DEFAULT: 'rgba(255, 255, 255, 0.8)',
					dark: 'rgba(255, 255, 255, 0.05)',
				},
				accent: {
					DEFAULT: '#7c3aed',
					light: '#a78bfa',
					dark: '#6d28d9',
				},
				'accent-secondary': {
					DEFAULT: '#06b6d4',
					light: '#22d3ee',
					dark: '#0891b2',
				},
			},
			animation: {
				'fade-in': 'fadeIn 0.6s ease-out forwards',
				'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
				'slide-down': 'slideDown 0.3s ease-out forwards',
				'glow': 'glow 2s ease-in-out infinite alternate',
			},
			keyframes: {
				fadeIn: {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' },
				},
				fadeInUp: {
					'0%': { opacity: '0', transform: 'translateY(20px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' },
				},
				slideDown: {
					'0%': { opacity: '0', transform: 'translateY(-10px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' },
				},
				glow: {
					'0%': { boxShadow: '0 0 5px rgba(124, 58, 237, 0.2), 0 0 20px rgba(124, 58, 237, 0.1)' },
					'100%': { boxShadow: '0 0 10px rgba(124, 58, 237, 0.4), 0 0 40px rgba(124, 58, 237, 0.2)' },
				},
			},
			backgroundImage: {
				'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
				'gradient-accent': 'linear-gradient(135deg, #7c3aed, #06b6d4)',
				'gradient-accent-hover': 'linear-gradient(135deg, #6d28d9, #0891b2)',
			},
		},
	},
	plugins: [
		require('@tailwindcss/typography'),
	],
}
