import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Interfața React a extensiei.
    files: ['extension/src/**/*.jsx'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  },
  {
    // Codul extensiei rulează în Chrome (API-ul chrome.*).
    files: ['extension/**/*.{js,jsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.webextensions } },
  },
  {
    // Backend, scripturi, teste și configurații: Node.
    files: ['api/**/*.js', 'scripts/**/*.js', 'tests/**/*.js', '**/__tests__/**/*.js', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
])
