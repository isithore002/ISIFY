import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // host: true listens on every network interface, not just this PC, so a phone or tablet on
  // the same Wi-Fi can open http://<this-pc's-ip>:5173. (127.0.0.1 is only reachable from the
  // PC itself.)
  server: { host: true, port: 5173, strictPort: true },
  preview: { host: true, port: 5173, strictPort: true },
})
