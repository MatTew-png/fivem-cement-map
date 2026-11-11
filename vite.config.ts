import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name(moduleId) {
                if (moduleId.includes('node_modules/leaflet') || moduleId.includes('node_modules\\leaflet')) {
                  return 'vendor-leaflet';
                }
                if (moduleId.includes('node_modules/mqtt') || moduleId.includes('node_modules\\mqtt')) {
                  return 'vendor-mqtt';
                }
                if (moduleId.includes('node_modules/lucide-react') || moduleId.includes('node_modules\\lucide-react')) {
                  return 'vendor-icons';
                }
                if (
                  moduleId.includes('node_modules/react/') ||
                  moduleId.includes('node_modules\\react\\') ||
                  moduleId.includes('node_modules/react-dom/') ||
                  moduleId.includes('node_modules\\react-dom\\') ||
                  moduleId.includes('node_modules/scheduler/') ||
                  moduleId.includes('node_modules\\scheduler\\')
                ) {
                  return 'vendor-react';
                }
                return null;
              },
            },
          ],
        },
      },
    },
  },
})