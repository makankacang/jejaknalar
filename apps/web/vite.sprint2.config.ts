import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({ root: fileURLToPath(new URL('.', import.meta.url)), plugins: [react()], server: { host: '127.0.0.1', port: 5173, strictPort: true }, build: { outDir: 'dist-sprint2', rollupOptions: { input: fileURLToPath(new URL('./sprint2.preview.html', import.meta.url)) } } });
