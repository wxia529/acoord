import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: ['media/webview/src/app.ts'],
  bundle: true,
  outfile: 'out/webview/webview.js',
  platform: 'browser',
  target: 'es2020',
  sourcemap: true,
  logLevel: 'info',
});

if (watch) {
  await ctx.watch();
  console.log('watching...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
