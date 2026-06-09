// Google TypeScript Style (gts) flat config, scoped to our source.
import gts from 'gts';
import {defineConfig} from 'eslint/config';

export default defineConfig([
    {ignores: ['dist/', 'node_modules/', 'eslint.config.mjs']},
    ...gts,
]);
