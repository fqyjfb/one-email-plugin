import { build } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runBuild() {
  await build({
    root: __dirname,
    build: {
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: true,
      minify: true,
      rollupOptions: {
        input: path.resolve(__dirname, 'src/index.tsx'),
        output: {
          dir: path.resolve(__dirname, 'dist'),
          format: 'iife',
          entryFileNames: 'index.js'
        }
      }
    }
  });
  console.log("Build complete: dist/index.js generated.");
}
runBuild();
