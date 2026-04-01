import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Plugin to auto-stamp sw.js with a unique build version
function swVersionPlugin(): Plugin {
  return {
    name: 'sw-version-stamp',
    closeBundle() {
      const swPath = path.resolve(__dirname, 'dist/sw.js');
      if (fs.existsSync(swPath)) {
        const buildHash = Date.now().toString(36);
        let content = fs.readFileSync(swPath, 'utf-8');
        content = content.replace(
          /const CACHE_VERSION = '[^']*'/,
          `const CACHE_VERSION = 'ashta-chamma-${buildHash}'`
        );
        fs.writeFileSync(swPath, content);
        console.log(`\n✅ SW cache version stamped: ashta-chamma-${buildHash}`);
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load .env from project root (not from ./client)
  const env = loadEnv(mode, path.resolve(__dirname), '')
  const serverPort = env.PORT || '3000'

  return {
    root: './client',
    plugins: [react(), swVersionPlugin()],
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, './shared'),
        '@': path.resolve(__dirname, './client/src'),
      },
    },
    build: {
      outDir: '../dist',
      emptyOutDir: true,
      minify: 'esbuild',
      target: 'es2020',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-socket': ['socket.io-client'],
          },
        },
      },
    },
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
    server: {
      port: 5173,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
        },
        '/socket.io': {
          target: `http://localhost:${serverPort}`,
          ws: true,
          // Suppress EPIPE/ECONNRESET noise from socket reconnections in dev
          configure: (proxy) => {
            proxy.on('error', () => {});
            proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
              socket.on('error', () => {});
            });
          },
        },
      },
    },
  }
})
