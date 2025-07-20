/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			colors: {
				coffee: '#c0ffee',
			},
		},
	},
	plugins: [
		require('@tailwindcss/typography'),
	],
}
