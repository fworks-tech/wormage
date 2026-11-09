import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Two build flavours:
 *  - default: normal Vite build for Vercel (MSW service worker served from /public)
 *  - `--mode single`: one self-contained HTML file (no service worker, in-process API)
 */
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: single ? './' : '/',
    plugins: [react(), ...(single ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
    build: {
      target: 'es2020',
      outDir: single ? 'dist-single' : 'dist',
      chunkSizeWarningLimit: 1600,
      assetsInlineLimit: single ? 100_000_000 : 4096,
    },
    server: { port: 5173, host: true },
  };
});
