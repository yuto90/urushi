import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'public',
  publicDir: false,
  plugins: [tailwindcss()],
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  build: { outDir: '../dist/editor', emptyOutDir: true },
});
