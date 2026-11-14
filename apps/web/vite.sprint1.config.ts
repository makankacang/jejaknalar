import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createDemoService } from '../../tools/d-sprint1/mock-service';
export default defineConfig({
  plugins: [react(), {
    name: 'pic-d-local-demo-only',
    configureServer(server) {
      const submit = createDemoService();
      server.middlewares.use('/__pic_d_demo/submit', async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        if (req.method !== 'POST') { res.statusCode = 405; res.end(JSON.stringify({ ok: false })); return; }
        try {
          let body = '';
          for await (const chunk of req) { body += chunk; if (body.length > 16000) throw new Error('VALIDATION_ERROR'); }
          res.end(JSON.stringify(submit(JSON.parse(body), JSON.parse(String(req.headers['x-demo-context'] ?? '{"hintsUsed":0,"attemptCount":1}')))));
        } catch (err) {
          const code = err instanceof Error && err.message === 'CONFLICT' ? 'CONFLICT' : err instanceof Error && err.message === 'RATE_LIMITED' ? 'RATE_LIMITED' : 'VALIDATION_ERROR';
          res.statusCode = code === 'CONFLICT' ? 409 : code === 'RATE_LIMITED' ? 429 : 400;
          res.end(JSON.stringify({ ok: false, error: { code, message: 'Permintaan demo ditolak.' }, request_id: crypto.randomUUID() }));
        }
      });
    },
  }],
  build: { outDir: 'dist-sprint1', rollupOptions: { input: 'sprint1.preview.html' } },
});
