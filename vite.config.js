import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { host: true },
  build: {
    rollupOptions: {
      output: {
        // Separate vendor chunks so app updates don't re-download React / Supabase.
        manualChunks: (id) => {
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('node_modules/react')) return 'react';
          return undefined;
        },
      },
    },
  },
});
