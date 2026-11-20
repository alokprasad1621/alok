import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

const jobs = process.argv[2].split(',').map((j) => {
  const [name, range] = j.split('=');
  const [from, to] = range.split('-').map(Number);
  return { name, from, to, out: `out/chunks2/${name}.mp4` };
});

const serveUrl = await bundle({ entryPoint: new URL('.', import.meta.url).pathname + '../src/index.ts' });
const composition = await selectComposition({ serveUrl, id: 'MolassesShort' });

for (const { name, from, to, out } of jobs) {
  if (await import('node:fs').then((fs) => fs.existsSync(out))) { console.log('SKIP', name); continue; }
  const t0 = Date.now();
  await renderMedia({
    composition, serveUrl, codec: 'h264', crf: 16, scale: 1, muted: true,
    frameRange: [from, to], outputLocation: out, concurrency: 1,
    timeoutInMilliseconds: 180000, imageFormat: 'jpeg',
    chromiumOptions: { gl: 'swiftshader' },
  });
  console.log('OK', name, `${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
console.log('JOBS_DONE');
