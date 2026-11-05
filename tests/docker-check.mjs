// Prueba real opt-in: usa exclusivamente los ejemplos demo y segundo.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Workshop} from '../lib/workshop.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workshop = new Workshop(root);
const projects = ['demo', 'segundo'].map((name) => workshop.project(name));
const report = {date: new Date().toISOString(), checks: [], image: workshop.image()};
const check = (name) => {report.checks.push(name); console.log(`OK: ${name}`);};
const marker = `verification-${randomUUID()}.txt`;
const markerPath = join(projects[0].path, 'public', marker);
let markerCreated = false;
const textAt = async (url) => (await fetch(url, {signal: AbortSignal.timeout(10000)})).text();
const directory = join(root, 'verification');
mkdirSync(directory, {recursive: true});
const reportPath = join(directory, `${randomUUID()}.json`);
try {
  workshop.engine();
  workshop.compose(projects[0], ['config', '--quiet']);
  workshop.compose(projects[0], ['build', 'render']);
  check('Compose válido e imagen construida');
  for (const project of projects) {
    await workshop.execute(['stop', project.name]);
    await workshop.execute(['studio', project.name]);
  }
  const first = workshop.compose(projects[0], ['ps', '-q', 'studio'], {capture: true});
  await workshop.execute(['studio', projects[0].name]);
  assert.equal(workshop.compose(projects[0], ['ps', '-q', 'studio'], {capture: true}), first);
  assert.notEqual(projects[0].port, projects[1].port);
  for (const project of projects) {
    const id = workshop.compose(project, ['ps', '-q', 'studio'], {capture: true});
    const [container] = JSON.parse(workshop.run(['inspect', id], {capture: true}));
    const bindings = container.HostConfig.PortBindings['3000/tcp'];
    assert.deepEqual(bindings, [{HostIp: '127.0.0.1', HostPort: String(project.port)}]);
    assert.equal(container.Config.User, `${process.getuid()}:${process.getgid()}`);
  }
  check('Dos Studios HTTP, puertos localhost exclusivos, UID/GID host e idempotencia real');
  const bases = [];
  for (const project of projects) {
    const base = `http://127.0.0.1:${project.port}`;
    const html = await textAt(base);
    const match = html.match(/window\.remotion_staticBase\s*=\s*("[^"]+")/);
    assert.ok(match, 'Studio debe publicar el directorio de assets');
    bases.push(base + JSON.parse(match[1]));
  }
  writeFileSync(markerPath, 'recurso exclusivo en vivo', {flag: 'wx'});
  markerCreated = true;
  assert.equal(await textAt(`${bases[0]}/${marker}`), 'recurso exclusivo en vivo');
  assert.notEqual(await textAt(`${bases[1]}/${marker}`), 'recurso exclusivo en vivo');
  rmSync(markerPath);
  markerCreated = false;
  check('Recurso añadido en vivo visible solo en su proyecto, sin reconstruir');
  await workshop.execute(['stop', projects[0].name]);
  assert.equal(workshop.running(projects[0]), false);
  assert.equal(workshop.running(projects[1]), true);
  check('Detener demo conserva segundo activo');
  const output = await workshop.execute(['render', projects[0].name]);
  const metadata = JSON.parse(readFileSync(`${output}.json`, 'utf8'));
  assert.equal(statSync(output).uid, process.getuid());
  assert.equal(statSync(output).gid, process.getgid());
  assert.equal(metadata.streams.find((s) => s.codec_type === 'video').codec_name, 'h264');
  report.output = output;
  report.metadata = metadata;
  report.imageId = workshop.run(['image', 'inspect', '--format', '{{.Id}}', workshop.image()], {capture: true});
  check('MP4 real inspeccionado con ffprobe y propiedad UID/GID host');
} catch (error) {
  report.error = error.stack;
  process.exitCode = 1;
  console.error(error);
} finally {
  if (markerCreated) rmSync(markerPath, {force: true});
  for (const project of projects) {
    try {await workshop.execute(['stop', project.name]);}
    catch (error) {report.cleanupError = String(error); process.exitCode = 1;}
  }
  try {
    assert.ok(projects.every((project) => !workshop.running(project)));
    check('Ambos Studios detenidos; exports y volúmenes conservados');
  } catch (error) {report.cleanupError = String(error); process.exitCode = 1;}
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  console.log(`Evidencia: ${reportPath}`);
}
