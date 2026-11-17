import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const htmlEntries = fs.readdirSync(root)
  .filter(name => name.endsWith('.html'))
  .map(name => path.resolve(root, name));

function copyClassicPageScripts() {
  const scripts = ['admin.js', 'cart.js', 'contact.js', 'customer-session.js', 'customer-portal.js', 'orders.js', 'project12.js', 'product-view.js', 'wishlist.js'];
  return {
    name: 'readers-corner-classic-page-scripts',
    apply: 'build',
    generateBundle() {
      for (const script of scripts) {
        this.emitFile({
          type: 'asset',
          fileName: script,
          source: fs.readFileSync(path.join(root, script))
        });
      }
    }
  };
}

function localConfigEndpoint(env) {
  return {
    name: 'readers-corner-local-config',
    configureServer(server) {
      server.middlewares.use('/api/config', (request, response) => {
        if (request.method !== 'GET') {
          response.statusCode = 405;
          response.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Cache-Control', 'no-store');
        const url = env.SUPABASE_URL || process.env.SUPABASE_URL;
        const anonKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!url || !anonKey) {
          response.statusCode = 503;
          response.end(JSON.stringify({ error: 'Supabase URL and publishable/anon key are required.' }));
          return;
        }
        response.end(JSON.stringify({ url, anonKey }));
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, '');
  return {
    plugins: [localConfigEndpoint(env), copyClassicPageScripts()],
    publicDir: 'public',
    build: {
      outDir: 'dist',
      rollupOptions: { input: htmlEntries }
    }
  };
});
