import type { Config } from 'tailwindcss';

export default {
    content: [
        './Component/**/*.{js,jsx,ts,tsx}',
        './view/**/*.{js,jsx,ts,tsx}',
    ],
    theme: {
        extend: {},
    },
    plugins: [],
} satisfies Config;
