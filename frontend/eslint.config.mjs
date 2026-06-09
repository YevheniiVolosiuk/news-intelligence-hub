// Google TypeScript Style (gts) flat config for the Next.js app.
import gts from 'gts';
import {defineConfig} from 'eslint/config';

export default defineConfig([
    {
        ignores: [
            '.next/',
            'node_modules/',
            'next-env.d.ts',
            'next.config.js',
            'postcss.config.js',
            'eslint.config.mjs',
        ],
    },
    ...gts,
]);
