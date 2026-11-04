// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'src/generated'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Guardrail (Phase 2 · P2-T1): process.env may only be read inside
    // src/config/; every other module must depend on the typed config
    // namespaces.
    files: ['src/**/*.ts'],
    ignores: ['src/config/**'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Read typed config from src/config/ (P2-T1) instead of process.env.',
        },
      ],
    },
  },
  eslintConfigPrettier,
);
