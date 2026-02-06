/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                display: ['Orbitron', 'sans-serif'],
                sans: ['Rajdhani', 'sans-serif'],
            },
            animation: {
                'pulse-glow': 'pulse-glow 3s infinite',
            },
            keyframes: {
                'pulse-glow': {
                    '0%, 100%': { boxShadow: '0 0 5px rgba(124, 58, 237, 0.3)' },
                    '50%': { boxShadow: '0 0 15px rgba(124, 58, 237, 0.6)' },
                }
            }
        },
    },
    plugins: [],
}
