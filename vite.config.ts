import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // Impede que o Vite tente pré-bundlizar o zxing-wasm (ele carrega o
    // .wasm dinamicamente em runtime — pré-bundlizar quebra esse carregamento)
    optimizeDeps: {
      exclude: ['zxing-wasm'],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
