import { defineConfig, loadEnv } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [svelte()],
    resolve: {
      alias: {
        '$lib': path.resolve('./src/lib'),
        '$components': path.resolve('./src/components')
      }
    },
    server: {
      proxy: {
        '/api': {
          target: 'https://openparking.stockholm.se',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '/LTF-Tolken/v1/servicedagar'),
          secure: true,
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              // Add API key to query string if not already present
              // Use env from loadEnv to ensure .env.local is loaded
              const apiKey = env.VITE_STOCKHOLM_API_KEY || process.env.VITE_STOCKHOLM_API_KEY;
              if (apiKey) {
                // Parse the path and query string
                const [pathname, search] = proxyReq.path.split('?');
                const searchParams = new URLSearchParams(search || '');
                if (!searchParams.has('apiKey')) {
                  searchParams.append('apiKey', apiKey);
                }
                proxyReq.path = pathname + '?' + searchParams.toString();
                console.log('Proxy request:', proxyReq.path.substring(0, 100) + '...');
              } else {
                console.warn('VITE_STOCKHOLM_API_KEY not found in environment variables');
              }
            });
          }
        }
      }
    }
  }
})
