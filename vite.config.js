import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'templates',
  base: './',
  build: {
    outDir: resolve(__dirname, 'static/dist'),
    emptyOutDir: true,
    assetsDir: '',
    rollupOptions: {
      input: {

        index: resolve(__dirname, 'templates/index.html'),
        attack_graph: resolve(__dirname, 'templates/attack_graph.html'),
        report: resolve(__dirname, 'templates/report.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  },
  resolve: {
    alias: {
      // Instead of aliasing to sigma.min.js, alias to the sigma package root.
      'sigma': resolve(__dirname, 'node_modules/sigma'),
      // Make sure your Graphology alias is pointing to an ES module build, if needed:
      'graphology': resolve(__dirname, 'node_modules/graphology/dist/graphology.esm.js')
    }
  },
  optimizeDeps: {
    include: ['graphology', 'sigma', 'tippy.js']
  },
  ssr: {
    noExternal: ['graphology', 'sigma', 'tippy.js']
  },
  server: {
    proxy: {
      '/scan': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
});
