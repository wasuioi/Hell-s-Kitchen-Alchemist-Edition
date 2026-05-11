import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the 3D engine (three + r3f + drei) into its own chunk so it
        // doesn't get bundled into the main entry. Scene.tsx is already
        // lazy-loaded, so this chunk only downloads when the player clicks
        // Start — the menu paints instantly with just the React/UI bundle.
        manualChunks(id) {
          if (
            id.includes('node_modules/three/') ||
            id.includes('node_modules/@react-three/')
          ) {
            return 'three'
          }
        },
      },
    },
  },
})
