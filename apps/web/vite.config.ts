import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: true },
  // The rules package is workspace source, not a third-party dependency. Left in
  // the pre-bundler it gets frozen into a cached chunk that hot reloads do not
  // invalidate, so edits to the game logic silently fail to reach the page.
  optimizeDeps: { exclude: ['@pocketknives/core'] },
});
