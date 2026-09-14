import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'netlify-functions-dev-middleware',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url.startsWith('/.netlify/functions/') && !req.url.startsWith('/api/')) {
            return next();
          }

          try {
            const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
            let rawPath = urlObj.pathname;
            let funcName = rawPath
              .replace('/.netlify/functions/', '')
              .replace('/api/', '')
              .replace('/api', '')
              .trim()
              .split('/')[0] || 'addresses';

            let targetFile = `${funcName}.js`;
            if (funcName === 'import') targetFile = 'import_addresses.js';
            if (funcName === 'check-duplicate') targetFile = 'check_duplicate.js';
            if (funcName === 'create-address') targetFile = 'create_address.js';
            if (funcName === 'update-address') targetFile = 'update_address.js';
            if (funcName === 'delete-address') targetFile = 'delete_address.js';
            if (funcName === 'important-dates') targetFile = 'important_dates.js';

            const filePath = path.resolve(process.cwd(), 'netlify/functions', targetFile);

            // Read POST/PUT request body
            const buffers = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const bodyStr = Buffer.concat(buffers).toString('utf-8');

            const queryParams = {};
            urlObj.searchParams.forEach((v, k) => {
              queryParams[k] = v;
            });

            const event = {
              httpMethod: req.method,
              path: rawPath,
              queryStringParameters: queryParams,
              headers: req.headers,
              body: bodyStr
            };

            const mod = await server.ssrLoadModule(filePath);

            if (!mod || !mod.handler) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ error: `Function ${funcName} not found` }));
              return;
            }

            const result = await mod.handler(event, {});
            const statusCode = result.statusCode || 200;
            const headers = result.headers || {};
            const responseBody = result.body || '';

            res.statusCode = statusCode;
            for (const [k, v] of Object.entries(headers)) {
              res.setHeader(k, v);
            }
            if (!res.getHeader('Access-Control-Allow-Origin')) {
              res.setHeader('Access-Control-Allow-Origin', '*');
            }

            res.end(typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody));
          } catch (err) {
            console.error('[Netlify Dev Middleware Error]:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ error: err.message || 'Internal Dev Server Error' }));
          }
        });
      }
    }
  ],
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'esnext',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('jspdf') || id.includes('xlsx')) {
              return 'vendor-export';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
          }
        }
      }
    }
  }
});
