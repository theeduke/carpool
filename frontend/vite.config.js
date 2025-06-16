import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      jspdf: 'jspdf/dist/jspdf.es.min.js',
    },
  },
  server: {
    host: '0.0.0.0', // Bind to all interfaces
    port: 5173, // Ensure port matches
    hmr: {
      host: 'localhost', // 👈 or your host machine's IP
      port: 5173,
      protocol: 'ws',
    },
  },
})
