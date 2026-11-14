import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()], build: { rollupOptions: { input: ['index.html', 'bi8.preview.html', 'sprint2.preview.html', 'paired-c03.preview.html'] } } });
