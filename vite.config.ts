import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    proxy: {
      '/api': {
        target: 'https://openparking.stockholm.se',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/LTF-Tolken/v1/servicedagar'),
        secure: true
      }
    }
  }
})
