import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { copy } from 'fs-extra'

export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve';
  
  // For GitHub Pages deployment with custom domain, use root base path
  // This ensures assets are loaded from the root of the domain
  const base = '/';
  
  return {
    plugins: [
      react(),
      {
        name: 'copy-extension',
        writeBundle() {
          // Copy extension directory to dist after build
          copy('extension', 'dist/extension', { overwrite: true })
            .then(() => console.log('Extension files copied to dist'))
            .catch(err => console.error('Error copying extension files:', err));
        }
      }
    ],
    base: base,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5500,
      open: true,
      fs: {
        strict: false
      }
    },
    preview: {
      port: 4173,
      open: true
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      rollupOptions: {
        input: {
          main: 'index.html'
        }
      }
    },
    optimizeDeps: {
      include: ['react', 'react-dom']
    }
  };
}) 