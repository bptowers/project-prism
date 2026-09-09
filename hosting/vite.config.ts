import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // maps were publicly served from hosting; see review 2026-09-09
    emptyOutDir: true,  // stop shipping every historical bundle (dist was 221 MB)
  },
})