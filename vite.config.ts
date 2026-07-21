import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Sprint 01C: no Gemini key is ever injected into the client bundle — the
// AI feature is a permanent, deterministic mock (services/geminiService.ts)
// that needs no key and makes no network call. See docs/memory.md's Sprint
// 01C entry for why this was removed rather than fixed.
export default defineConfig(() => ({
  server: {
    port: 5174,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
}));
