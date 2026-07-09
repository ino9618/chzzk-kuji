import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'src/client'),
  build: {
    outDir: path.resolve(__dirname, 'dist/client'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        admin: path.resolve(__dirname, 'src/client/admin.html'),
        overlay: path.resolve(__dirname, 'src/client/overlay.html'),
        manual: path.resolve(__dirname, 'src/client/manual.html'),
      },
    },
  },
  server: {
    // Allows access through a Cloudflare Tunnel (quick tunnels get a random
    // *.trycloudflare.com hostname each run) or a custom tunnel hostname set
    // via TUNNEL_HOSTNAME, in addition to localhost. Needed because Vite's
    // dev server rejects requests whose Host header it doesn't recognize.
    allowedHosts: ['.trycloudflare.com', ...(process.env.TUNNEL_HOSTNAME ? [process.env.TUNNEL_HOSTNAME] : [])],
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});
