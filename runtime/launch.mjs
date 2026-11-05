import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
const mode = process.argv[2];
if (!['studio', 'render'].includes(mode)) throw new Error('Modo inválido: studio o render.');
if (mode === 'render' && !/^[a-zA-Z0-9-]+\.mp4$/.test(process.argv[3] ?? '')) {
  throw new Error('Nombre MP4 inseguro.');
}
const video = JSON.parse(readFileSync('/app/project/video.json', 'utf8'));
const common = ['--config=/app/runtime/remotion.config.ts', '--public-dir=/app/project/public', '--props=/app/project/props.json'];
const args = mode === 'studio'
  ? ['studio', '/app/project/src/index.tsx', ...common, '--port=3000', '--ipv4', '--no-open', '--webpack-poll=1000']
  : ['render', '/app/project/src/index.tsx', video.composition, `/out/${process.argv[3]}`, ...common,
    '--codec=h264', '--audio-codec=aac', '--pixel-format=yuv420p', '--crf=18', '--concurrency=1', '--overwrite=false'];
const result = spawnSync('/app/node_modules/.bin/remotion', args, {stdio: 'inherit'});
if (result.error) console.error(result.error.message);
if (mode === 'render' && result.status === 0) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', `/out/${process.argv[3]}`], {encoding: 'utf8'});
  if (probe.status !== 0) throw new Error(`ffprobe falló: ${probe.stderr}`);
  const metadata = JSON.parse(probe.stdout);
  const stream = metadata.streams.find((s) => s.codec_type === 'video');
  const [rate, scale] = (stream?.avg_frame_rate ?? '0/1').split('/').map(Number);
  if (!stream || stream.codec_name !== 'h264' || stream.width !== video.width || stream.height !== video.height
    || stream.pix_fmt !== 'yuv420p' || rate / scale !== video.fps || Number(stream.nb_frames) !== video.durationInFrames
    || Math.abs(Number(metadata.format.duration) - video.durationInFrames / video.fps) > 0.1) {
    throw new Error('MP4 no coincide con video.json (codec, dimensiones, fotogramas o duración).');
  }
  writeFileSync(`/out/${process.argv[3]}.json`, JSON.stringify(metadata, null, 2) + '\n', {flag: 'wx'});
  console.log(`ffprobe OK: H.264 ${stream.width}×${stream.height}, ${stream.nb_frames} frames, ${metadata.format.duration}s`);
}
process.exit(result.status ?? 1);
