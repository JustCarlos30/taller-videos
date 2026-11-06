import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, cpSync, readFileSync, writeFileSync, mkdirSync, symlinkSync, existsSync, rmSync, realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {Workshop, allocatePort, portFree} from '../lib/workshop.mjs';

// Llena cada línea del contrato de la plantilla.
const llenar = (path) => writeFileSync(join(path, 'brief.md'), readFileSync(join(path, 'brief.md'), 'utf8').replace(/^- Archivos de sonido:\s*$/m, '- Archivos de sonido: ninguno').replace(/^(- [^:\n]+:)\s*$/gm, '$1 definido'));

function fixture(t, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'taller-test-'));
  for (const item of ['template', 'runtime', 'Dockerfile', 'package.json', 'package-lock.json', 'compose.yaml', 'tsconfig.json']) {
    cpSync(new URL(`../${item}`, import.meta.url), join(root, item), {recursive: true});
  }
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const calls = [];
  const active = new Set();
  const log = [];
  const run = (args, options = {}) => {
    calls.push({args, ...options});
    const name = args[args.indexOf('-p') + 1];
    if (args.includes('ps')) return active.has(name) ? 'container-id' : '';
    if (args.includes('up')) active.add(name);
    if (args.includes('stop')) active.delete(name);
    return '';
  };
  const workshop = new Workshop(root, {run, available: async () => true, ready: async () => {}, log: (s) => log.push(s), ...overrides});
  return {root, workshop, calls, active, log};
}

test('dos proyectos: editar código, props, recursos y salida no afecta al otro ni a la plantilla', async (t) => {
  const {root, workshop} = fixture(t);
  const a = await workshop.execute(['new', 'uno']);
  const b = await workshop.execute(['new', 'dos']);
  assert.notEqual(a.port, b.port);
  assert.notEqual(a.compose, b.compose);
  for (const file of ['src/Film.tsx', 'props.json']) {
    const before = readFileSync(join(b.path, file), 'utf8');
    writeFileSync(join(a.path, file), 'cambio exclusivo');
    assert.equal(readFileSync(join(b.path, file), 'utf8'), before);
    assert.equal(readFileSync(join(root, 'template', file), 'utf8'), before);
  }
  writeFileSync(join(a.path, 'public', 'asset.txt'), 'recurso uno');
  writeFileSync(join(a.path, 'exports', 'video.mp4'), 'salida uno');
  assert.equal(existsSync(join(b.path, 'public', 'asset.txt')), false);
  assert.equal(existsSync(join(b.path, 'exports', 'video.mp4')), false);
});

test('rechaza duplicados y traversal antes de invocar Docker o escribir fuera', async (t) => {
  const {workshop, calls} = fixture(t);
  const a = await workshop.execute(['new', 'uno']);
  writeFileSync(join(a.path, 'brief.md'), 'trabajo existente');
  await assert.rejects(workshop.execute(['new', 'uno']), /duplicado/);
  assert.equal(readFileSync(join(a.path, 'brief.md'), 'utf8'), 'trabajo existente');
  for (const value of ['../escape', '/tmp/escape', 'a/b', 'a\\b', '..', '-x', 'UPPER', 'a b', 'x'.repeat(49)]) {
    await assert.rejects(workshop.execute(['new', value]), /Slug inválido/);
  }
  assert.equal(calls.length, 0);
});

test('rechaza symlinks de recursos, salidas y raíz de proyecto', async (t) => {
  for (const location of ['public/escape', 'exports/escape', 'src/escape']) {
    const {workshop, root, calls} = fixture(t);
    const p = await workshop.execute(['new', 'uno']);
    symlinkSync(root, join(p.path, location));
    await assert.rejects(workshop.execute(['render', 'uno']), /simbólico/);
    assert.equal(calls.length, 0);
  }
  const {root, workshop} = fixture(t);
  mkdirSync(join(root, 'projects'));
  symlinkSync(join(root, 'template'), join(root, 'projects', 'enlace'));
  await assert.rejects(workshop.execute(['studio', 'enlace']), /simbólico/);
});

test('taller.local.json apunta la carpeta de proyectos a otra ruta real', async (t) => {
  const {root, workshop} = fixture(t);
  const external = mkdtempSync(join(tmpdir(), 'taller-canal-'));
  t.after(() => rmSync(external, {recursive: true, force: true}));
  writeFileSync(join(root, 'taller.local.json'), JSON.stringify({projects: external}));
  const p = await workshop.execute(['new', 'uno']);
  assert.equal(p.path, join(realpathSync(external), 'uno'));
  assert.deepEqual(workshop.names(), ['uno']);
  assert.ok(!existsSync(join(root, 'projects', 'uno')));
  writeFileSync(join(root, 'taller.local.json'), JSON.stringify({projects: join(external, 'no-existe')}));
  await assert.rejects(workshop.execute(['list']), /no encontrada/);
});

test('asigna puertos evitando reservas y sockets ocupados reales', async (t) => {
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => server.close(r)));
  assert.equal(await portFree(server.address().port), false);
  assert.equal(await allocatePort([3100, 3102], async (p) => p !== 3101), 3103);
  await assert.rejects(allocatePort([], async () => false), /No hay puertos/);
});

test('Studio idempotente, dos servicios separados y stop no toca el vecino', async (t) => {
  const {workshop, calls, active, log} = fixture(t);
  const a = await workshop.execute(['new', 'uno']);
  const b = await workshop.execute(['new', 'dos']);
  await workshop.execute(['studio', 'uno']);
  await workshop.execute(['studio', 'uno']);
  await workshop.execute(['studio', 'dos']);
  const starts = calls.filter((c) => c.args.includes('up'));
  assert.equal(starts.length, 2);
  assert.equal(starts[0].env.VIDEO_INPUT, a.path);
  assert.equal(starts[1].env.VIDEO_INPUT, b.path);
  assert.notEqual(starts[0].env.VIDEO_PORT, starts[1].env.VIDEO_PORT);
  assert.ok(starts.every((c) => c.args.includes('-d') && c.args.includes('--wait')));
  await workshop.execute(['stop', 'uno']);
  assert.equal(active.has(a.compose), false);
  assert.equal(active.has(b.compose), true);
  await workshop.execute(['status']);
  assert.ok(log.some((line) => line.startsWith('dos: activo')));
  assert.ok(calls.every((c) => !c.args.includes('--volumes')));
});

test('render congela entradas y conserva salidas exclusivas con nombres nuevos', async (t) => {
  const {workshop, calls} = fixture(t);
  const a = await workshop.execute(['new', 'uno']);
  const b = await workshop.execute(['new', 'dos']);
  const engine = workshop.run;
  workshop.run = (args, options) => {
    if (args.includes('run')) {
      assert.notEqual(options.env.VIDEO_INPUT, a.path);
      const props = readFileSync(join(options.env.VIDEO_INPUT, 'props.json'), 'utf8');
      writeFileSync(join(a.path, 'props.json'), '{"title":"cambio posterior"}');
      assert.equal(readFileSync(join(options.env.VIDEO_INPUT, 'props.json'), 'utf8'), props);
      assert.equal(options.env.VIDEO_OUTPUT, join(a.path, 'exports'));
      writeFileSync(join(options.env.VIDEO_OUTPUT, args.at(-1)), 'fake MP4 from engine');
    }
    return engine(args, options);
  };
  llenar(a.path);
  const one = await workshop.execute(['render', 'uno']);
  const two = await workshop.execute(['render', 'uno']);
  assert.notEqual(one, two);
  assert.equal(existsSync(one), true);
  assert.equal(existsSync(join(b.path, 'exports', one.split('/').at(-1))), false);
  assert.equal(calls.filter((c) => c.args.includes('run')).length, 2);
});

test('fallo de readiness detiene solo Studio propio; lock impide comandos simultáneos', async (t) => {
  const {workshop, active} = fixture(t, {ready: async () => {throw new Error('sin HTTP');}});
  const a = await workshop.execute(['new', 'uno']);
  await assert.rejects(workshop.execute(['studio', 'uno']), /sin HTTP/);
  assert.equal(active.has(a.compose), false);
  await workshop.locked(async () => {
    await assert.rejects(workshop.execute(['list']), /Otro comando/);
  });
  await workshop.execute(['list']);
});

test('puerto ocupado se reasigna y argv inesperado se rechaza sin Docker', async (t) => {
  const {workshop, calls} = fixture(t);
  const a = await workshop.execute(['new', 'uno']);
  workshop.available = async (p) => p !== a.port;
  await workshop.execute(['studio', 'uno']);
  assert.notEqual(workshop.project('uno').port, a.port);
  const count = calls.length;
  for (const args of [[], ['status', 'uno', 'dos'], ['new', 'otro', '--flag'], ['exec', 'uno']]) {
    await assert.rejects(workshop.execute(args), /Uso:/);
  }
  assert.equal(calls.length, count);
});

test('list y status aceptan un slug y consultan solamente ese proyecto', async (t) => {
  const {workshop, calls, log} = fixture(t);
  await workshop.execute(['new', 'uno']);
  await workshop.execute(['new', 'dos']);
  log.length = 0;
  await workshop.execute(['list', 'uno']);
  assert.equal(log.length, 1);
  assert.match(log[0], /^uno /);
  assert.equal(calls.length, 0);
  await workshop.execute(['status', 'uno']);
  assert.equal(calls.filter((c) => c.args.includes('ps')).length, 1);
  assert.match(log.at(-1), /^uno: detenido/);
  const count = calls.length;
  await assert.rejects(workshop.execute(['status', '../dos']), /Slug inválido/);
  assert.equal(calls.length, count);
});

test('render exige el contrato de motion en proyectos nuevos, antes de invocar Docker', async (t) => {
  const {workshop, calls} = fixture(t);
  const p = await workshop.execute(['new', 'uno']);
  await assert.rejects(workshop.execute(['render', 'uno']), /Contrato de motion incompleto.*Idea de autor/);
  llenar(p.path);
  const parcial = readFileSync(join(p.path, 'brief.md'), 'utf8').replace(/^- Sonido.*$/m, '- Sonido (efecto → causa visible):');
  writeFileSync(join(p.path, 'brief.md'), parcial);
  await assert.rejects(workshop.execute(['render', 'uno']), /incompleto en brief.md: Sonido/);
  writeFileSync(join(p.path, 'brief.md'), '# sin contrato');
  await assert.rejects(workshop.execute(['render', 'uno']), /Falta "## Contrato de motion"/);
  assert.equal(calls.some(({args}) => args.includes('render')), false);
});

test('render no bloquea proyectos creados antes del contrato', async (t) => {
  const {workshop} = fixture(t);
  const p = await workshop.execute(['new', 'viejo']);
  const local = join(p.path, '.work', 'project.json');
  writeFileSync(local, JSON.stringify({port: p.port}));
  await assert.doesNotReject(() => Promise.resolve(workshop.checkContract(workshop.project('viejo'))));
});

test('render exige que el sonido declarado exista en public/audio (proyectos con contrato)', async (t) => {
  const {workshop, calls} = fixture(t);
  const p = await workshop.execute(['new', 'uno']);
  llenar(p.path);
  const brief = readFileSync(join(p.path, 'brief.md'), 'utf8');
  const con = (valor) => writeFileSync(join(p.path, 'brief.md'), brief.replace(/^- Archivos de sonido:.*$/m, `- Archivos de sonido: ${valor}`));
  con('clic.wav, bass.wav');
  await assert.rejects(workshop.execute(['render', 'uno']), /no existe en public\/audio\/: clic\.wav, bass\.wav.*sonido\/SKILL\.md/);
  mkdirSync(join(p.path, 'public', 'audio'), {recursive: true});
  writeFileSync(join(p.path, 'public', 'audio', 'clic.wav'), 'x');
  await assert.rejects(workshop.execute(['render', 'uno']), /no existe en public\/audio\/: bass\.wav/);
  writeFileSync(join(p.path, 'brief.md'), brief.replace(/^- Archivos de sonido:.*\n?/m, ''));
  await assert.rejects(workshop.execute(['render', 'uno']), /Falta la línea "- Archivos de sonido:"/);
  assert.equal(calls.some(({args}) => args.includes('render')), false);
  writeFileSync(join(p.path, 'public', 'audio', 'bass.wav'), 'x');
  con('clic.wav, bass.wav');
  assert.doesNotThrow(() => workshop.checkContract(workshop.project('uno')));
  con('ninguno (video mudo)');
  assert.doesNotThrow(() => workshop.checkContract(workshop.project('uno')));
});

test('el candado de sonido no bloquea proyectos sin contrato', async (t) => {
  const {workshop} = fixture(t);
  const p = await workshop.execute(['new', 'viejo']);
  writeFileSync(join(p.path, '.work', 'project.json'), JSON.stringify({port: p.port}));
  writeFileSync(join(p.path, 'brief.md'), '# viejo\n\n- Archivos de sonido: fantasma.wav\n');
  assert.doesNotThrow(() => workshop.checkContract(workshop.project('viejo')));
});
