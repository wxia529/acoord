import * as esbuild from 'esbuild';
import { mkdir } from 'fs/promises';

const watch = process.argv.includes('--watch');

async function build() {
  // Ensure dist directory exists
  await mkdir('dist', { recursive: true });
  
  const ctx = await esbuild.context({
    entryPoints: ['src/index.ts'],
    bundle: true,
    outfile: 'dist/index.js',
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    sourcemap: true,
    external: ['three'],  // Keep three.js as external (peer dependency)
    logLevel: 'info',
  });
  
  if (watch) {
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log('Build complete!');
  }
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
