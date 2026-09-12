import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'child_process';

let persistentDevServerProc = null;

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'persistent-python-api-server',
      configureServer(server) {
        const PORT = 5055;
        try {
          persistentDevServerProc = spawn('python', ['scripts/dev_server.py', String(PORT)], {
            cwd: process.cwd(),
            env: { ...process.env },
            stdio: ['ignore', 'ignore', 'inherit']
          });

          persistentDevServerProc.on('error', (err) => {
            console.warn('[vite] Could not start persistent Python dev server:', err.message);
          });

          const cleanup = () => {
            if (persistentDevServerProc) {
              persistentDevServerProc.kill();
              persistentDevServerProc = null;
            }
          };

          process.on('exit', cleanup);
          process.on('SIGINT', () => { cleanup(); process.exit(); });
          process.on('SIGTERM', () => { cleanup(); process.exit(); });
        } catch (e) {
          console.warn('[vite] Error spawning python dev_server:', e);
        }
      }
    }
  ],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/.netlify/functions': {
        target: 'http://127.0.0.1:5055',
        changeOrigin: true,
        timeout: 10000
      },
      '/api': {
        target: 'http://127.0.0.1:5055',
        changeOrigin: true,
        timeout: 10000
      }
    }
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
