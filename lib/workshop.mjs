import {spawnSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync, cpSync, rmSync, realpathSync} from 'node:fs';
import {join} from 'node:path';
import {createServer} from 'node:net';

export function slug(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) || value.length > 48) {
    throw new Error('Slug inválido: usa 1–48 caracteres, minúsculas, números y guiones; empieza por letra.');
  }
  return value;
}

// Rechazar enlaces incluso internos: ninguna ruta montada puede escapar al trabajo.
export function noLinks(path) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) throw new Error(`Enlace simbólico rechazado: ${path}`);
  if (stat.isDirectory()) for (const child of readdirSync(path)) noLinks(join(path, child));
}

// Líneas sin llenar del contrato de motion; null si el brief no tiene la sección.
export function contractGaps(brief) {
  const start = brief.search(/^## Contrato de motion\s*$/m);
  if (start < 0) return null;
  const rest = brief.slice(start).split('\n').slice(1);
  const end = rest.findIndex((line) => /^#{1,2} /.test(line));
  return (end < 0 ? rest : rest.slice(0, end)).map((line) => line.match(/^- ([^:]+):\s*(.*)$/)).filter((m) => m && !m[2].trim()).map((m) => m[1]);
}

// Archivos de sonido declarados en "- Archivos de sonido: a.wav, b.wav" (o "ninguno") y los que no existen.
// Devuelve null si la línea no está; {declared, none, missing} si está.
export function soundFiles(brief, audioDir) {
  const m = brief.match(/^- Archivos de sonido:[ \t]*(.*)$/m);
  if (!m) return null;
  const text = m[1].trim();
  if (/^ninguno\b/i.test(text)) return {declared: [], none: true, missing: []};
  const declared = text.split(',').map((n) => n.trim()).filter(Boolean);
  return {declared, none: false, missing: declared.filter((n) => !/^[\w.-]+$/.test(n) || !existsSync(join(audioDir, n)))};
}

export function portFree(port) {
  return new Promise((done) => {
    const server = createServer();
    server.once('error', () => done(false));
    server.listen({host: '127.0.0.1', port, exclusive: true}, () => server.close(() => done(true)));
  });
}

export async function allocatePort(reserved, available = portFree) {
  for (let port = 3100; port <= 3999; port++) {
    if (!reserved.includes(port) && await available(port)) return port;
  }
  throw new Error('No hay puertos libres entre 3100 y 3999.');
}

function docker(args, {env, capture = false} = {}) {
  const result = spawnSync('docker', args, {
    env: {...process.env, ...env}, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit',
  });
  if (result.error) throw new Error(`Docker no disponible: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`docker ${args.join(' ')} falló (${result.status}). ${result.stderr ?? ''}`);
  return result.stdout?.trim() ?? '';
}

const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', {mode: 0o644});
const hash = (text) => createHash('sha256').update(text).digest('hex');

export class Workshop {
  constructor(root, {run = docker, available = portFree, ready, log = console.log} = {}) {
    this.root = realpathSync(root);
    this.run = run;
    this.available = available;
    this.ready = ready ?? this.httpReady;
    this.log = log;
    this.namespace = `tv-${hash(this.root).slice(0, 10)}`;
  }

  directory(name) {
    const path = join(this.root, name);
    if (!existsSync(path)) mkdirSync(path, {mode: 0o755});
    if (lstatSync(path).isSymbolicLink() || !lstatSync(path).isDirectory()) throw new Error(`Directorio inseguro: ${path}`);
    return path;
  }

  async locked(fn) {
    const state = this.directory('.state');
    const lock = join(state, 'command.lock');
    if (existsSync(lock)) {
      if (lstatSync(lock).isSymbolicLink()) throw new Error('Lock inseguro: enlace simbólico.');
      const pid = Number(readFileSync(lock, 'utf8'));
      if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Lock inválido; revisa .state/command.lock.');
      try {process.kill(pid, 0);} catch (error) {
        if (error.code === 'ESRCH') {
          // Do not steal a replacement lock if another invocation reconciled it first.
          if (readFileSync(lock, 'utf8') === String(pid)) rmSync(lock);
        } else throw error;
      }
    }
    // Exclusive create: concurrent invocations cannot allocate the same port or render output.
    let owned = false;
    try {
      writeFileSync(lock, String(process.pid), {flag: 'wx', mode: 0o644});
      owned = true;
      return await fn();
    } catch (error) {
      if (error.code === 'EEXIST' && !owned) throw new Error('Otro comando está activo. Si cayó, comprueba el PID de .state/command.lock y retira solo ese lock.');
      throw error;
    } finally {
      if (owned) rmSync(lock);
    }
  }

  names() {
    return readdirSync(this.directory('projects')).filter((name) => {
      try {slug(name); return true;} catch {return false;}
    }).sort();
  }

  project(name) {
    slug(name);
    const path = join(this.directory('projects'), name);
    if (!existsSync(path)) throw new Error(`No existe ${name}. Ejecuta: npm run video -- new ${name}`);
    noLinks(path);
    for (const dir of ['src', 'public', 'exports']) {
      if (!lstatSync(join(path, dir)).isDirectory()) throw new Error(`Falta directorio: ${dir}`);
    }
    const video = json(join(path, 'video.json'));
    if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(video.composition)) throw new Error('composition inválida en video.json.');
    for (const key of ['width', 'height', 'fps', 'durationInFrames']) {
      if (!Number.isSafeInteger(video[key]) || video[key] < 1) throw new Error(`${key} debe ser entero positivo.`);
    }
    if (video.width % 2 || video.height % 2) throw new Error('H.264 yuv420p requiere dimensiones pares.');
    const props = json(join(path, 'props.json'));
    if (!props || typeof props !== 'object' || Array.isArray(props)) throw new Error('props.json debe ser un objeto.');
    const local = json(join(path, '.work', 'project.json'));
    if (!Number.isInteger(local.port) || local.port < 3100 || local.port > 3999) throw new Error('Puerto inválido en .work/project.json.');
    return {name, path, video, port: local.port, contract: local.contract === true, compose: `${this.namespace}-${name}`};
  }

  async create(name) {
    slug(name);
    const parent = this.directory('projects');
    const path = join(parent, name);
    if (existsSync(path)) throw new Error(`Proyecto duplicado: ${name}. No se sobrescribe.`);
    const reserved = this.names().map((n) => this.project(n).port);
    const port = await allocatePort(reserved, this.available);
    noLinks(join(this.root, 'template'));
    mkdirSync(path, {mode: 0o755});
    for (const item of readdirSync(join(this.root, 'template'))) {
      cpSync(join(this.root, 'template', item), join(path, item), {recursive: true, force: false, errorOnExist: true});
    }
    mkdirSync(join(path, '.work'));
    save(join(path, '.work', 'project.json'), {port, contract: true});
    this.log(`Creado ${name}: projects/${name} · puerto reservado ${port}`);
    return this.project(name);
  }

  image() {
    const inputs = ['Dockerfile', 'package-lock.json', 'package.json', 'tsconfig.json', 'runtime/launch.mjs', 'runtime/remotion.config.ts'];
    return `taller-videos-runtime:${hash(inputs.map((p) => readFileSync(join(this.root, p))).join('\n')).slice(0, 16)}`;
  }

  context(project, input = project.path) {
    return {env: {
      VIDEO_IMAGE: this.image(), VIDEO_INPUT: input, VIDEO_OUTPUT: join(project.path, 'exports'),
      VIDEO_PORT: String(project.port), VIDEO_UID: String(process.getuid()), VIDEO_GID: String(process.getgid()),
    }};
  }

  compose(project, args, options = {}) {
    return this.run(['compose', '--project-directory', this.root, '-f', join(this.root, 'compose.yaml'), '-p', project.compose, ...args],
      {...this.context(project, options.input), ...options});
  }

  engine() {
    this.run(['info'], {capture: true});
    this.run(['compose', 'version'], {capture: true});
  }

  ensureImage(project) {
    try {this.run(['image', 'inspect', this.image()], {capture: true});}
    catch {this.compose(project, ['build', 'render']);}
  }

  async httpReady(port) {
    for (let i = 0; i < 60; i++) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}`, {signal: AbortSignal.timeout(2000)});
        if (response.ok) return;
      } catch { /* wait for the managed server */ }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`Studio no responde en http://127.0.0.1:${port}. Revisa logs de Compose.`);
  }

  running(project) {
    return this.compose(project, ['ps', '--status', 'running', '-q', 'studio'], {capture: true}) !== '';
  }

  async studio(project) {
    this.ensureImage(project);
    if (!this.running(project)) {
      if (!await this.available(project.port)) {
        const reserved = this.names().filter((n) => n !== project.name).map((n) => this.project(n).port);
        project.port = await allocatePort(reserved, this.available);
        save(join(project.path, '.work', 'project.json'), {port: project.port, ...(project.contract && {contract: true})});
      }
      try {
        this.compose(project, ['up', '-d', '--no-build', '--wait', '--wait-timeout', '120', 'studio']);
        await this.ready(project.port);
      } catch (error) {
        this.compose(project, ['stop', 'studio']);
        throw error;
      }
    } else await this.ready(project.port);
    this.log(`${project.name}: http://127.0.0.1:${project.port}`);
  }

  snapshot(project) {
    const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
    const work = join(project.path, '.work', 'renders');
    mkdirSync(work, {recursive: true});
    const path = join(work, id);
    mkdirSync(path);
    for (const item of ['src', 'public', 'props.json', 'video.json', 'brief.md']) cpSync(join(project.path, item), join(path, item), {recursive: true});
    const checksums = {};
    const walk = (dir, prefix = '') => {
      for (const entry of readdirSync(dir)) {
        const relative = prefix + entry;
        const child = join(dir, entry);
        if (lstatSync(child).isDirectory()) walk(child, `${relative}/`);
        else checksums[relative] = hash(readFileSync(child));
      }
    };
    walk(path);
    save(join(path, 'receipt.json'), {id, project: project.name, image: this.image(), checksums});
    return {id, path};
  }

  // Solo proyectos creados con contrato; los anteriores no se bloquean.
  checkContract(project) {
    if (!project.contract) return;
    const gaps = contractGaps(readFileSync(join(project.path, 'brief.md'), 'utf8'));
    if (gaps === null) throw new Error('Falta "## Contrato de motion" en brief.md. Ver MOTION.md.');
    if (gaps.length) throw new Error(`Contrato de motion incompleto en brief.md: ${gaps.join(' · ')}. Ver MOTION.md.`);
    const sound = soundFiles(readFileSync(join(project.path, 'brief.md'), 'utf8'), join(project.path, 'public', 'audio'));
    const skill = 'Efectos siempre de asset-vault: skill .claude/skills/sonido/SKILL.md y tools/sfx.py.';
    if (!sound) throw new Error(`Falta la línea "- Archivos de sonido:" en el brief (lista de archivos de public/audio/ o "ninguno"). ${skill}`);
    if (!sound.none && !sound.declared.length) throw new Error(`"Archivos de sonido" vacío en brief.md: lista los archivos de public/audio/ o escribe "ninguno". ${skill}`);
    if (sound.missing.length) throw new Error(`Sonido declarado que no existe en public/audio/: ${sound.missing.join(', ')}. ${skill}`);
  }

  render(project) {
    this.checkContract(project);
    this.ensureImage(project);
    const snapshot = this.snapshot(project);
    const imageId = this.run(['image', 'inspect', '--format', '{{.Id}}', this.image()], {capture: true});
    save(join(snapshot.path, 'image.json'), {imageId});
    this.compose(project, ['run', '--rm', '--no-deps', '-T', 'render', 'node', 'runtime/launch.mjs', 'render', `${snapshot.id}.mp4`], {input: snapshot.path});
    const output = join(project.path, 'exports', `${snapshot.id}.mp4`);
    if (!existsSync(output) || lstatSync(output).size === 0) throw new Error('Render terminó sin MP4 válido.');
    this.log(`MP4: ${output}`);
    return output;
  }

  async execute(args) {
    const [command, name, ...extra] = args;
    const perProject = ['new', 'studio', 'render', 'stop'];
    if (!['list', 'status', ...perProject].includes(command) || extra.length || (perProject.includes(command) && !name)) {
      throw new Error('Uso: npm run video -- new|studio|render|stop slug · list [slug] · status [slug]');
    }
    if (name) slug(name);
    return this.locked(async () => {
      if (command === 'new') return this.create(name);
      if (command === 'list') {
        for (const n of name ? [name] : this.names()) {
          const p = this.project(n);
          this.log(`${n} · projects/${n} · puerto ${p.port} · exports: ${readdirSync(join(p.path, 'exports')).filter((f) => f.endsWith('.mp4')).length}`);
        }
        return;
      }
      const project = name ? this.project(name) : null;
      this.engine();
      if (command === 'studio') return this.studio(project);
      if (command === 'render') return this.render(project);
      if (command === 'stop') {
        this.compose(project, ['stop', 'studio']);
        this.log(`Studio detenido: ${name}. Exports conservados.`);
      }
      if (command === 'status') {
        for (const n of name ? [name] : this.names()) {
          const p = this.project(n);
          this.log(`${n}: ${this.running(p) ? `activo http://127.0.0.1:${p.port}` : 'detenido'} · ${p.compose}`);
        }
      }
    });
  }
}
