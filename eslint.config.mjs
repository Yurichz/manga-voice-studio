import serverStyle from './scripts/kelly-style.mjs';
import tseslint from 'typescript-eslint';
export default tseslint.config({ignores:['**/node_modules/**','**/.next/**','**/dist/**','.runtime/**','.cache/**','models/**','storage/**','outputs/**','work/**','**/next-env.d.ts']}, ...tseslint.configs.recommended, {rules:{'@typescript-eslint/no-explicit-any':'off','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]}}, ...serverStyle);
