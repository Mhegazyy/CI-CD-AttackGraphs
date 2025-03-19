import { resolve } from 'path';

export default {
  // Set the root to your templates folder so that index.html is treated as the root entry
  root: 'templates',
  base: './', // use relative asset paths
  build: {
    // Output to a folder outside of the templates folder.
    // Using "../static/dist" means that from templates/ folder, the output will go to static/dist at the project root.
    outDir: resolve(__dirname, 'static/dist'),
    emptyOutDir: true,
    // Do not preserve subfolder structure
    assetsDir: '',
    rollupOptions: {
      input: {
        // Since root is now templates, we can refer to index.html directly
        index: resolve(__dirname, 'templates/index.html')
      },
      output: {
        // Ensure assets are flattened
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  }
};
