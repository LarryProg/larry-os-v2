// SOLO PARA PRUEBAS: simula la API de GitHub en memoria (sessionStorage).
// No se carga en la app. Uso en la consola: await import('/tools/fake-github.js')
(function () {
  const st = () => JSON.parse(sessionStorage.getItem('fakegh') || '{"files":{},"n":0,"puts":0}');
  const save = s => sessionStorage.setItem('fakegh', JSON.stringify(s));
  const realFetch = window.__realFetch || window.fetch;
  window.__realFetch = realFetch;
  const J = (c, o) => new Response(JSON.stringify(o), { status: c, headers: { 'Content-Type': 'application/json' } });
  window.fetch = async (url, opt = {}) => {
    if (!String(url).includes('api.github.com')) return realFetch(url, opt);
    const s = st(); const p = new URL(url).pathname; let m;
    if ((m = p.match(/\/contents\/(.+)$/))) {
      const f = decodeURIComponent(m[1]);
      if ((opt.method || 'GET') === 'PUT') {
        const b = JSON.parse(opt.body), cur = s.files[f];
        if (cur && b.sha !== cur.sha) return J(409, { message: 'sha mismatch' });
        if (!cur && b.sha) return J(422, { message: 'no file' });
        const sha = 'sha' + (++s.n); s.files[f] = { sha, content: b.content }; s.puts++; save(s);
        return J(200, { content: { sha } });
      }
      const cur = s.files[f]; if (!cur) return J(404, {});
      const big = cur.content.length > 1000000;
      return J(200, { sha: cur.sha, content: big ? '' : cur.content, encoding: big ? 'none' : 'base64' });
    }
    if ((m = p.match(/\/git\/blobs\/(.+)$/))) {
      const f = Object.values(st().files).find(x => x.sha === m[1]);
      return f ? J(200, { content: f.content }) : J(404, {});
    }
    return J(200, { full_name: 'test/larry-os-data', private: true });
  };
  const dec = b => new TextDecoder().decode(Uint8Array.from(atob(b), c => c.charCodeAt(0)));
  const enc = t => { const by = new TextEncoder().encode(t); let bin = ''; for (let i = 0; i < by.length; i += 0x8000) bin += String.fromCharCode.apply(null, by.subarray(i, i + 0x8000)); return btoa(bin); };
  window.fakeGH = {
    read(path = 'larry-os-v2-data.json') { const f = st().files[path]; return f ? JSON.parse(dec(f.content)) : null; },
    // Simula que otro dispositivo edita el archivo remoto
    edit(fn, path = 'larry-os-v2-data.json') { const s = st(); const f = s.files[path]; const snap = JSON.parse(dec(f.content)); fn(snap.data); f.content = enc(JSON.stringify(snap)); f.sha = 'sha' + (++s.n); save(s); },
    put(path, snap) { const s = st(); s.files[path] = { sha: 'sha' + (++s.n), content: enc(JSON.stringify(snap)) }; save(s); },
    reset() { sessionStorage.removeItem('fakegh'); },
    stats() { const s = st(); return { files: Object.keys(s.files), puts: s.puts }; }
  };
})();
