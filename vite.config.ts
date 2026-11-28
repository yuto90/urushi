import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  root: 'public',
  publicDir: mode === 'pages' ? '../pages' : false,
  plugins: [tailwindcss()],
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  build: { outDir: mode === 'pages' ? '../dist/pages' : '../dist/editor', emptyOutDir: true },
}));
