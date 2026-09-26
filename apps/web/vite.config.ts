import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: true },
  // The built game, served as it would be in production. Open to the network
  // so it can be tried on a phone on the same Wi-Fi.
  preview: { host: true, port: 4173 },
  // The rules package is workspace source, not a third-party dependency. Left in
  // the pre-bundler it gets frozen into a cached chunk that hot reloads do not
  // invalidate, so edits to the game logic silently fail to reach the page.
  //
  // Havok is excluded for a different reason: the pre-bundler moves its script
  // away from the WebAssembly binary it loads, and the physics then fails to
  // start in development only.
  optimizeDeps: { exclude: ['@pocketknives/core', '@babylonjs/havok'] },
});
