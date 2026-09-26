import HavokPhysics from '@babylonjs/havok';
import havokWasmUrl from '@babylonjs/havok/lib/esm/HavokPhysics.wasm?url';
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';

/**
 * Loads the Havok physics engine.
 *
 * Havok is compiled to WebAssembly and ships as a separate binary. Vite hands
 * back a URL for it, and the loader is told to fetch from there rather than
 * guessing a path next to the script — a guess that holds in development and
 * breaks the moment the build hashes the file name.
 *
 * Effectful: fetches and compiles the binary. Needs WebAssembly SIMD, which
 * every current browser has (iOS since 16.4).
 */
export const loadHavok = async (): Promise<HavokPlugin> => {
  const havok = await HavokPhysics({ locateFile: () => havokWasmUrl });
  return new HavokPlugin(true, havok);
};
