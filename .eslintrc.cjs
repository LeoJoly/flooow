module.exports = {
  root: true,
  plugins: ['@typescript-eslint'],
  extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    'no-console': 'warn',
    'no-var': 'error',
    'prefer-const': 'error',
  },
  ignorePatterns: ['dist', 'build', 'vite.config.ts'],
}