import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['lib/**/*.ts'],
      // lib/supabase and lib/auth require Next.js runtime — excluded from unit coverage
      exclude: ['lib/supabase/**', 'lib/auth/**'],
      thresholds: { lines: 100, functions: 100, branches: 90, statements: 100 },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './') },
  },
});
