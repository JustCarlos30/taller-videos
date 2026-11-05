#!/usr/bin/env python3
"""Pipeline de voz y subtitulos del taller.

Uso: python3 -I tools/voz.py <paso|todo|entregar> <slug> [opciones]
Pasos: entrada limpiar silencios transcribir palabras ajustar cortar masterizar
Requiere python3, numpy, ffmpeg/ffprobe, whisper-cli y sqlite3 (modulo estandar).
Archivos NN-* en projects/<slug>/.work/voz/ (o --work). Detalle en VOZ.md.
"""
import argparse, json, os, re, shutil, sqlite3, struct, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100
PASOS = ['entrada', 'limpiar', 'silencios', 'transcribir', 'palabras', 'ajustar', 'cortar', 'masterizar']
SLUG_RE = re.compile(r'^[a-z0-9][a-z0-9-]*$')

CADENA_EQ = ('highpass=f=90,afftdn=nf=-70:nr=4,equalizer=f=500:t=q:w=1.0:g=-4,'
             'equalizer=f=220:t=q:w=1.2:g=-1.5,equalizer=f=3000:t=q:w=1.2:g=3,'
             'equalizer=f=10000:t=h:w=0.7:g=0.5,deesser=i=0.7:m=0.6:f=0.45,'
             'acompressor=threshold=-22dB:ratio=3:attack=6:release=120:makeup=2')
LIM1 = 'alimiter=limit=0.5:attack=3:release=60:level=disabled,loudnorm=I=-14:TP=-1.2:LRA=9'
PRE, POST = 0.12, 0.14


def die(msg):
    sys.exit('voz.py: ' + msg)


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        die(f'fallo {cmd[0]} (codigo {r.returncode}):\n' + r.stderr[-1500:])
    return r


def ffmpeg(*args):
    return run(['ffmpeg', '-hide_banner', '-nostdin', '-y', *args])


# ---------- rutas ----------
def proyecto(slug):
    if not SLUG_RE.match(slug or ''):
        die(f'slug invalido: {slug!r}')
    p = os.path.join(ROOT, 'projects', slug)
    if not os.path.isfile(os.path.join(p, 'video.json')):
        die(f'no existe el proyecto projects/{slug} (falta video.json)')
    return p


def workdir(a):
    w = a.work or os.path.join(proyecto(a.slug), '.work', 'voz')
    w = os.path.abspath(w)
    os.makedirs(w, exist_ok=True)
    return w


def P(w, name):
    return os.path.join(w, name)


def necesita(w, *names):
    for n in names:
        if not os.path.isfile(P(w, n)):
            die(f'falta {n} en {w}; corre antes el paso que lo genera')


def f32_a_wav(src, dst, sr=SR):
    ffmpeg('-f', 'f32le', '-ar', str(sr), '-ac', '1', '-i', src, '-c:a', 'pcm_s16le', dst)


# ---------- paso 0: entrada (parser de ProjectSerializer de Audacity) ----------
def parse_serializer(buf, names, out, charsize):
    i, n = 0, len(buf)

    def s(l):
        nonlocal i
        raw = buf[i:i + l]; i += l
        cs = charsize[0]
        return raw.decode('utf-32-le' if cs == 4 else ('utf-16-le' if cs == 2 else 'utf-8'), 'replace')

    while i < n:
        t = buf[i]; i += 1
        if t == 0:
            charsize[0] = buf[i]; i += 1
        elif t == 15:
            id_, ln = struct.unpack_from('<HH', buf, i); i += 4
            names[id_] = s(ln)
        elif t == 1:
            id_, = struct.unpack_from('<H', buf, i); i += 2; out.append(('<', names[id_]))
        elif t == 2:
            id_, = struct.unpack_from('<H', buf, i); i += 2; out.append(('>', names[id_]))
        elif t == 3:
            id_, ln = struct.unpack_from('<HI', buf, i); i += 6; out.append((names[id_], s(ln)))
        elif t == 4:
            id_, v = struct.unpack_from('<Hi', buf, i); i += 6; out.append((names[id_], v))
        elif t == 5:
            id_, v = struct.unpack_from('<HB', buf, i); i += 3; out.append((names[id_], bool(v)))
        elif t in (6, 8):
            id_, v = struct.unpack_from('<Hi', buf, i); i += 6; out.append((names[id_], v))
        elif t == 7:
            id_, v = struct.unpack_from('<Hq', buf, i); i += 10; out.append((names[id_], v))
        elif t == 9:
            id_, v, _ = struct.unpack_from('<Hfi', buf, i); i += 10; out.append((names[id_], v))
        elif t == 10:
            id_, v, _ = struct.unpack_from('<Hdi', buf, i); i += 14; out.append((names[id_], v))
        elif t in (11, 12):
            ln, = struct.unpack_from('<I', buf, i); i += 4; out.append(('raw', s(ln)))
        elif t in (13, 14):
            out.append(('push' if t == 13 else 'pop', None))
        else:
            die(f'.aup3: token desconocido {t} en offset {i - 1}')


def aup3_pistas(path):
    db = sqlite3.connect(f'file:{path}?mode=ro', uri=True)
    try:
        d, doc = db.execute('select dict, doc from project').fetchone()
        names, out = {}, []
        parse_serializer(d, names, [], [4])
        parse_serializer(doc, names, out, [4])
        pistas, cur = [], None
        for k, v in out:
            if k == '<' and v == 'wavetrack':
                cur = {'channel': len(pistas), 'rate': SR, 'clips': 0, 'num': None, 'blocks': [], 'fmt': None}
                pistas.append(cur)
            elif cur is None:
                continue
            elif k == '>' and v == 'wavetrack':
                cur = None
            elif k == '<' and v == 'waveclip':
                cur['clips'] += 1
            elif k == 'rate':
                cur['rate'] = v
            elif k == 'channel':
                cur['channel'] = v
            elif k == 'sampleformat':
                cur['fmt'] = v
            elif k == 'numsamples':
                cur['num'] = v
            elif k == 'blockid':
                cur['blocks'].append(v)
        if not pistas:
            die('.aup3 sin wavetrack')
        for i, p in enumerate(pistas):
            if p['clips'] != 1:
                die(f'.aup3: la pista {i} tiene {p["clips"]} waveclips; solo se admite 1 (combina o exporta la pista desde Audacity)')
            if p['fmt'] != 262159:
                die(f'.aup3: sampleformat {p["fmt"]} no soportado (solo 262159 = float32)')
            partes = []
            for b in p['blocks']:
                row = db.execute('select samples from sampleblocks where blockid=?', (b,)).fetchone()
                if row is None:
                    die(f'.aup3: falta sampleblock {b}')
                partes.append(np.frombuffer(row[0], dtype='<f4'))
            x = np.concatenate(partes) if partes else np.zeros(0, np.float32)
            p['x'] = x[:p['num']].astype(np.float32)
        return pistas
    finally:
        db.close()


def rms_db(x):
    return 20 * np.log10(np.sqrt((x.astype(np.float64) ** 2).mean()) + 1e-12) if len(x) else -99.0


def paso_entrada(a, w):
    src = a.entrada
    if not src:
        die('falta --entrada <archivo .aup3 o audio>')
    src = os.path.abspath(src)
    if not os.path.isfile(src):
        die(f'no existe la entrada: {src}')
    ext = os.path.splitext(src)[1].lower()
    shutil.copyfile(src, P(w, '00-origen' + ext))
    if ext == '.aup3':
        pistas = aup3_pistas(src)
        for p in pistas:
            p['rms'] = rms_db(p['x'])
            print(f'pista canal {p["channel"]}: {len(p["x"])} muestras, {p["rate"]:.0f} Hz, RMS {p["rms"]:.1f} dB')
        if a.canal is not None:
            sel = [p for p in pistas if p['channel'] == a.canal]
            if not sel:
                die(f'--canal {a.canal} no existe')
            p = sel[0]
        else:
            p = max(pistas, key=lambda q: q['rms'])
        print(f'usando canal {p["channel"]}')
        if int(round(p['rate'])) == SR:
            p['x'].tofile(P(w, '00-entrada.f32'))
        else:
            p['x'].tofile(P(w, '00-bruto.f32'))
            ffmpeg('-f', 'f32le', '-ar', str(int(round(p['rate']))), '-ac', '1', '-i', P(w, '00-bruto.f32'),
                   '-ar', str(SR), '-f', 'f32le', P(w, '00-entrada.f32'))
            os.remove(P(w, '00-bruto.f32'))
    else:
        ffmpeg('-i', src, '-vn', '-ac', '1', '-ar', str(SR), '-f', 'f32le', P(w, '00-entrada.f32'))
    f32_a_wav(P(w, '00-entrada.f32'), P(w, '00-entrada.wav'))
    n = os.path.getsize(P(w, '00-entrada.f32')) // 4
    print(f'00-entrada.f32: {n / SR:.2f} s')


# ---------- paso 1: limpiar ----------
def paso_limpiar(a, w):
    necesita(w, '00-entrada.f32')
    ffmpeg('-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', P(w, '00-entrada.f32'),
           '-af', CADENA_EQ, '-f', 'f32le', P(w, '01-eq.f32'))
    f32_a_wav(P(w, '01-eq.f32'), P(w, '01-eq.wav'))
    print(f'01-eq.f32 y 01-eq.wav: {os.path.getsize(P(w, "01-eq.f32")) / 4 / SR:.2f} s (escucha 01-eq.wav)')


# ---------- paso 2: silencios ----------
def paso_silencios(a, w):
    necesita(w, '00-entrada.f32')
    total = os.path.getsize(P(w, '00-entrada.f32')) / 4 / SR
    r = ffmpeg('-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', P(w, '00-entrada.f32'),
               '-af', 'silencedetect=n=-45dB:d=0.35', '-f', 'null', '-')
    ini = [float(m) for m in re.findall(r'silence_start: (-?[\d.]+)', r.stderr)]
    fin = [float(m) for m in re.findall(r'silence_end: ([\d.]+)', r.stderr)]
    if len(fin) < len(ini):
        fin.append(total)
    sil = [(max(0.0, s), e) for s, e in zip(ini, fin)]
    with open(P(w, '02-silencios.txt'), 'w') as f:
        for s, e in sil:
            f.write(f'{s:.6f} {e:.6f}\n')
    # tramos de habla = huecos entre silencios de mas de 0,15 s
    tramos, t = [], 0.0
    for s, e in sil:
        if s - t > 0.15:
            tramos.append((t, s))
        t = max(t, e)
    if total - t > 0.15:
        tramos.append((t, total))
    with open(P(w, '02-tramos.txt'), 'w') as f:
        for s, e in tramos:
            f.write(f'{s:.6f} {e:.6f}\n')
    print(f'{len(sil)} silencios, {len(tramos)} tramos de habla, {total:.2f} s')


# ---------- paso 3: transcribir ----------
def paso_transcribir(a, w):
    necesita(w, '01-eq.f32')
    modelo = os.path.expanduser(a.modelo)
    if not os.path.isfile(modelo):
        die(f'falta el modelo whisper: {modelo}')
    ffmpeg('-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', P(w, '01-eq.f32'),
           '-ar', '16000', '-c:a', 'pcm_s16le', P(w, '03-16k.wav'))
    run(['whisper-cli', '-m', modelo, '-l', 'es', '-f', P(w, '03-16k.wav'), '-oj', '-ojf',
         '-ml', '42', '-sow', '-t', '8', '-of', P(w, '03-whisper')])
    print('03-whisper.json listo')


# ---------- paso 4: palabras ----------
def cargar_fix(arg):
    if not arg:
        return {}
    try:
        txt = open(arg).read() if os.path.isfile(arg) else arg
        fix = json.loads(txt)
    except (OSError, ValueError) as e:
        die(f'--fix no es JSON valido ni archivo: {e}')
    if not isinstance(fix, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in fix.items()):
        die('--fix debe ser un objeto {"mal": "bien"} con textos')
    return fix


def paso_palabras(a, w):
    necesita(w, '03-whisper.json')
    d = json.load(open(P(w, '03-whisper.json')))
    words = []
    for seg in d['transcription']:
        for t in seg['tokens']:
            tx = t['text']
            if tx.startswith('[_') or (not tx.strip() and not words):
                continue
            if tx.startswith(' ') or not words:
                words.append([tx.strip(), t['offsets']['from'], t['offsets']['to']])
            else:
                words[-1][0] += tx
                words[-1][2] = t['offsets']['to']
    words = [x for x in words if x[0]]
    fix = cargar_fix(a.fix)
    plano = lambda ws: [re.sub(r'[.,?!]+$', '', x[0]) for x in ws]
    for mal, bien in fix.items():
        aw, bw = mal.split(), bien.split()
        for i in range(len(words) - len(aw) + 1):
            if plano(words[i:i + len(aw)]) == aw:
                tail = re.search(r'[.,?!]+$', words[i + len(aw) - 1][0])
                tail = tail[0] if tail else ''
                s, e = words[i][1], words[i + len(aw) - 1][2]
                step = (e - s) / len(bw)
                words[i:i + len(aw)] = [[x + (tail if k == len(bw) - 1 else ''), int(s + k * step), int(s + (k + 1) * step)]
                                        for k, x in enumerate(bw)]
                break
        else:
            die(f'--fix: "{mal}" no aparece en la transcripcion')
    salida = [{'text': x[0], 'startMs': x[1], 'endMs': x[2]} for x in words]
    json.dump(salida, open(P(w, '04-palabras.json'), 'w'), ensure_ascii=False, indent=1)
    texto = ' '.join(x['text'] for x in salida)
    open(P(w, '04-texto.txt'), 'w').write(texto + '\n')
    print(len(salida), 'palabras')
    print(texto)


# ---------- paso 5: ajustar ----------
def leer_pares(path):
    return [tuple(map(float, l.split())) for l in open(path) if l.strip()]


def paso_ajustar(a, w):
    necesita(w, '04-palabras.json', '02-tramos.txt', '01-eq.f32')
    segs = [(int(s * 1000), int(e * 1000)) for s, e in leer_pares(P(w, '02-tramos.txt'))]
    if not segs:
        die('no hay tramos de habla (02-tramos.txt vacio)')
    wd = json.load(open(P(w, '04-palabras.json')))
    n = len(wd)

    def seg_of(t):
        for i, (s, e) in enumerate(segs):
            if s - 60 <= t <= e + 60:
                return i
        return None

    idx = []
    for x in wd:
        i = seg_of((x['startMs'] + x['endMs']) / 2)
        if i is None or x['endMs'] - x['startMs'] < 40:
            i = None
        idx.append(i)
    for k in range(n):
        if idx[k] is None:
            prev = next((idx[j] for j in range(k - 1, -1, -1) if idx[j] is not None), 0)
            nxt = next((idx[j] for j in range(k + 1, n) if idx[j] is not None), len(segs) - 1)
            t = wd[k]['startMs']
            cand = [i for i in range(prev, nxt + 1) if segs[i][0] - 80 <= t <= segs[i][1] + 80]
            idx[k] = cand[0] if cand else (nxt if abs(t - segs[nxt][0]) < abs(t - segs[prev][1]) else prev)
    for k in range(1, n):
        idx[k] = max(idx[k], idx[k - 1])
    for i, (s0, e0) in enumerate(segs):
        ks = [k for k in range(n) if idx[k] == i]
        if not ks:
            continue
        good = lambda k: wd[k]['endMs'] - wd[k]['startMs'] >= 40 and s0 - 30 <= wd[k]['startMs'] and wd[k]['endMs'] <= e0 + 30
        wd[ks[0]]['startMs'] = max(s0, min(wd[ks[0]]['startMs'], s0 + 150)) if good(ks[0]) else s0
        if good(ks[-1]):
            wd[ks[-1]]['endMs'] = min(e0, max(wd[ks[-1]]['endMs'], e0 - 150))
        else:
            wd[ks[-1]]['endMs'] = e0
        k0 = 0
        while k0 < len(ks):
            if good(ks[k0]):
                k0 += 1
                continue
            k1 = k0
            while k1 < len(ks) and not good(ks[k1]):
                k1 += 1
            s = wd[ks[k0 - 1]]['endMs'] if k0 > 0 else s0
            e = wd[ks[k1]]['startMs'] if k1 < len(ks) else e0
            if k0 == 0 and k1 == len(ks):
                s, e = s0, e0
            if e - s < 60 * (k1 - k0):
                if k1 < len(ks):
                    e = wd[ks[k1]]['endMs']; k1 += 1
                if k0 > 0:
                    s = wd[ks[k0 - 1]]['startMs']; k0 -= 1
            lens = [len(wd[ks[j]]['text']) + 1 for j in range(k0, k1)]
            tot = sum(lens); t = s
            for j, L in zip(range(k0, k1), lens):
                wd[ks[j]]['startMs'] = round(t); t += (e - s) * L / tot; wd[ks[j]]['endMs'] = round(t)
            k0 = k1
    for k in range(1, n):
        if wd[k]['startMs'] < wd[k - 1]['endMs']:
            wd[k]['startMs'] = wd[k - 1]['endMs']
        if wd[k]['endMs'] < wd[k]['startMs'] + 40:
            wd[k]['endMs'] = wd[k]['startMs'] + 40
    json.dump(wd, open(P(w, '05-palabras.json'), 'w'), ensure_ascii=False, indent=1)
    x = np.fromfile(P(w, '01-eq.f32'), np.float32)
    bad = []
    for q in wd:
        seg = x[int(q['startMs'] / 1000 * SR):int(q['endMs'] / 1000 * SR)]
        r = rms_db(seg)
        if r < -45:
            bad.append((q['text'], round(r)))
    print(f'05-palabras.json: {n} palabras')
    print('palabras con poca energia (< -45 dB):', bad)


# ---------- paso 6: cortar ----------
def paso_cortar(a, w):
    necesita(w, '01-eq.f32', '02-silencios.txt', '05-palabras.json')
    x = np.fromfile(P(w, '01-eq.f32'), np.float32)
    cuts = []
    for s, e in leer_pares(P(w, '02-silencios.txt')):
        if s == 0:
            continue
        s0, e0 = s + PRE, e - POST
        if e0 - s0 > 0.02:
            cuts.append((s0, e0))
    endw = len(x) / SR
    keep, t = [], 0.0
    for s, e in cuts:
        keep.append((t, s)); t = e
    keep.append((t, endw))
    F = int(0.008 * SR)
    parts = []
    for s, e in keep:
        seg = x[int(s * SR):int(e * SR)].copy()
        if len(seg) > 2 * F:
            seg[:F] *= np.linspace(0, 1, F); seg[-F:] *= np.linspace(1, 0, F)
        parts.append(seg)
    out = np.concatenate(parts).astype(np.float32)
    out.tofile(P(w, '06-corte.f32'))
    json.dump({'cuts': cuts}, open(P(w, '06-cortes.json'), 'w'))

    def m(t):
        r = 0.0
        for s, e in cuts:
            if t >= e:
                r += e - s
            elif t > s:
                return s - r
        return t - r

    wd = json.load(open(P(w, '05-palabras.json')))
    for q in wd:
        q['startMs'] = round(m(q['startMs'] / 1000) * 1000)
        q['endMs'] = round(m(q['endMs'] / 1000) * 1000)
    json.dump(wd, open(P(w, '06-palabras.json'), 'w'), ensure_ascii=False, indent=1)
    print(f'{len(cuts)} cortes, quitados {sum(e - s for s, e in cuts):.2f} s, dura {len(out) / SR:.2f} s')
    print(f'06-palabras.json: {len(wd)} palabras')


# ---------- paso 7: masterizar ----------
def medir(path):
    dur = float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).stdout)
    r = ffmpeg('-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-')
    res = r.stderr.split('Summary:')[-1]
    lufs = re.search(r'I:\s+(-?[\d.]+) LUFS', res)
    pico = re.search(r'Peak:\s+(-?[\d.]+) dBFS', res)
    return dur, float(lufs[1]) if lufs else None, float(pico[1]) if pico else None


def paso_masterizar(a, w):
    necesita(w, '06-corte.f32')
    ent = ['-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', P(w, '06-corte.f32')]
    r = ffmpeg(*ent, '-af', LIM1 + ':print_format=json', '-f', 'null', '-')
    try:
        j = json.loads(r.stderr[r.stderr.rindex('{'):r.stderr.rindex('}') + 1])
    except ValueError:
        die('no pude leer la medicion de loudnorm')
    p2 = (f'{LIM1}:measured_I={j["input_i"]}:measured_TP={j["input_tp"]}:measured_LRA={j["input_lra"]}:'
          f'measured_thresh={j["input_thresh"]}:offset={j["target_offset"]}:linear=true,aresample=48000')
    ffmpeg(*ent, '-af', p2, '-c:a', 'pcm_s24le', P(w, '07-norm.wav'))
    ffmpeg('-i', P(w, '07-norm.wav'), '-af', 'volume=1.6dB,alimiter=limit=0.84:attack=2:release=50:level=disabled',
           '-c:a', 'pcm_s24le', P(w, '07-final.wav'))
    os.remove(P(w, '07-norm.wav'))
    dur, lufs, pico = medir(P(w, '07-final.wav'))
    print(f'07-final.wav: {dur:.2f} s, {lufs} LUFS, pico {pico} dBFS (escuchalo)')


# ---------- entregar ----------
def entregar(a, w):
    p = proyecto(a.slug)
    nombre = a.nombre or f'voz-{a.slug}'
    if not re.match(r'^[A-Za-z0-9][A-Za-z0-9._-]*$', nombre):
        die(f'nombre invalido: {nombre!r}')
    necesita(w, '07-final.wav', '06-palabras.json')
    dst = [(P(w, '07-final.wav'), os.path.join(p, 'public', nombre + '.wav')),
           (P(w, '06-palabras.json'), os.path.join(p, 'src', nombre + '.palabras.json'))]
    if not a.reemplazar:
        ya = [d for _, d in dst if os.path.exists(d)]
        if ya:
            die('ya existe (usa --reemplazar para sobrescribir, no se escribio nada): ' + ', '.join(ya))
    for s, d in dst:
        os.makedirs(os.path.dirname(d), exist_ok=True)
        shutil.copyfile(s, d)
        print('escrito', os.path.relpath(d, ROOT))


FUN = {'entrada': paso_entrada, 'limpiar': paso_limpiar, 'silencios': paso_silencios, 'transcribir': paso_transcribir,
       'palabras': paso_palabras, 'ajustar': paso_ajustar, 'cortar': paso_cortar, 'masterizar': paso_masterizar}


def main():
    ap = argparse.ArgumentParser(prog='voz.py', description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('paso', choices=PASOS + ['todo', 'entregar'])
    ap.add_argument('slug', help='proyecto en projects/<slug>')
    ap.add_argument('--work', help='carpeta de trabajo (por defecto projects/<slug>/.work/voz)')
    ap.add_argument('--entrada', help='.aup3 o audio (paso entrada / todo)')
    ap.add_argument('--canal', type=int, help='canal del .aup3 (por defecto el de mas RMS)')
    ap.add_argument('--fix', help='JSON {"mal":"bien"} o ruta a un archivo JSON (paso palabras / todo)')
    ap.add_argument('--modelo', default='~/.cache/whisper/ggml-small.bin')
    ap.add_argument('--nombre', help='nombre de entrega (por defecto voz-<slug>)')
    ap.add_argument('--reemplazar', action='store_true', help='entregar: sobrescribe archivos existentes')
    a = ap.parse_args()
    proyecto(a.slug)
    w = workdir(a)
    if a.paso == 'entregar':
        return entregar(a, w)
    for paso in (PASOS if a.paso == 'todo' else [a.paso]):
        print(f'== {PASOS.index(paso)} {paso}')
        FUN[paso](a, w)


if __name__ == '__main__':
    main()
