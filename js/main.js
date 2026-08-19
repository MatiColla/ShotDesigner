/* ============ Playback & init ============ */
var Main = {};
(() => {
  const playBtn = document.getElementById('btn-play');
  const durInput = document.getElementById('dur-input');
  const autoKeyBtn = document.getElementById('btn-autokey');
  const loopBtn = document.getElementById('btn-loop');
  let lastTs = null, rafId = null;

  function setTime(t) {
    State.time = Math.max(0, Math.min(State.project.duration, t));
    Timeline.updatePlayhead();
    UI.renderSwitcher();
    requestRender();
  }
  Main.setTime = setTime;

  function tick(ts) {
    if (!State.playing) return;
    if (lastTs == null) lastTs = ts;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;
    let t = State.time + dt;
    if (t >= State.project.duration) {
      if (State.loop) t = 0;
      else { t = State.project.duration; togglePlay(false); }
    }
    setTime(t);
    rafId = requestAnimationFrame(tick);
  }

  function togglePlay(force) {
    State.playing = force !== undefined ? force : !State.playing;
    playBtn.textContent = State.playing ? '⏸' : '▶';
    playBtn.classList.toggle('playing', State.playing);
    lastTs = null;
    if (State.playing) rafId = requestAnimationFrame(tick);
    else if (rafId) cancelAnimationFrame(rafId);
  }
  Main.togglePlay = togglePlay;

  playBtn.onclick = () => togglePlay();
  document.getElementById('btn-stop').onclick = () => { togglePlay(false); setTime(0); };
  document.getElementById('btn-end').onclick = () => setTime(State.project.duration);

  durInput.onchange = () => {
    let d = Math.max(1, Math.min(30, Math.round(+durInput.value || 15)));
    durInput.value = d;
    State.project.duration = d;
    /* clamp keyframes & cuts */
    State.project.entities.forEach(e => {
      e.keyframes = e.keyframes.filter((k, i) => k.t <= d || i === 0);
      e.keyframes.forEach(k => { if (k.t > d) k.t = d; });
    });
    State.project.cuts = State.project.cuts.filter(c => c.t <= d);
    setTime(Math.min(State.time, d));
    Timeline.render();
    scheduleSave();
  };

  autoKeyBtn.onclick = () => {
    State.autoKey = !State.autoKey;
    autoKeyBtn.classList.toggle('on', State.autoKey);
  };
  loopBtn.onclick = () => {
    State.loop = !State.loop;
    loopBtn.classList.toggle('on', State.loop);
  };

  /* ---- render menu ---- */
  const renderBtn = document.getElementById('btn-render');
  const renderMenu = document.getElementById('render-menu');
  renderBtn.onclick = ev => {
    ev.stopPropagation();
    if (State.rendering) return;
    renderMenu.classList.toggle('hidden');
  };
  document.addEventListener('click', () => renderMenu.classList.add('hidden'));

  /* ---- render to video ---- */
  document.getElementById('btn-render-video').onclick = () => {
    renderMenu.classList.add('hidden');
    if (State.rendering) return;
    const mimes = [
      'video/mp4;codecs=avc1.42E01E',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm'
    ];
    const mime = (window.MediaRecorder && mimes.find(m => MediaRecorder.isTypeSupported(m))) || null;
    if (!mime) { alert(T('Tu navegador no soporta grabacion de video.')); return; }
    const ext = mime.indexOf('mp4') !== -1 ? 'mp4' : 'webm';
    togglePlay(false);
    State.selectedId = null; State.selectedKf = null;
    State.rendering = true;
    UI.refresh(); Timeline.render();
    const dur = State.project.duration;
    /* bitrate budget: never exceed ~30 MB total (with 10% margin), quality-capped at 10 Mbps */
    const MAX_MB = 30;
    const bps = Math.min(10000000, Math.max(1500000, Math.floor(MAX_MB * 8 * 1024 * 1024 * 0.9 / dur)));
    const stream = cv.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bps });
    const chunks = [];
    rec.ondataavailable = ev => { if (ev.data && ev.data.size) chunks.push(ev.data); };
    rec.onstop = () => {
      State.rendering = false;
      renderBtn.textContent = '🎬 Render ▾';
      renderBtn.disabled = false;
      const blob = new Blob(chunks, { type: mime });
      console.log('render: ' + (blob.size / 1048576).toFixed(1) + ' MB @ ' + Math.round(bps / 1000) + ' kbps');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'shotdesigner-escena.' + ext;
      a.click();
      URL.revokeObjectURL(a.href);
      setTime(0);
      requestRender();
      if (ext === 'webm') alert(T('Tu navegador no muxea MP4 nativo: se descargo WebM (Chrome/Edge actual descarga MP4 directo). El WebM se convierte facil con cualquier conversor.'));
    };
    renderBtn.disabled = true;
    renderBtn.textContent = '⏺ 0.0s';
    rec.start();
    const t0 = performance.now();
    const frame = now => {
      const t = (now - t0) / 1000;
      if (t >= dur) {
        setTime(dur);
        drawScene();
        setTimeout(() => rec.stop(), 120);
        return;
      }
      setTime(t);
      drawScene();
      renderBtn.textContent = '⏺ ' + t.toFixed(1) + 's / ' + dur + 's';
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };

  /* ---- render to image sequence (1 frame each 3 s, zipped) ---- */
  document.getElementById('btn-render-seq').onclick = async () => {
    renderMenu.classList.add('hidden');
    if (State.rendering) return;
    togglePlay(false);
    State.selectedId = null; State.selectedKf = null;
    State.rendering = true;
    UI.refresh(); Timeline.render();
    renderBtn.disabled = true;
    const dur = State.project.duration;
    const times = [];
    for (let t = 0; t <= dur + 1e-6; t += 3) times.push(snapT(Math.min(t, dur)));
    if (times[times.length - 1] < dur - 0.01) times.push(dur);
    const files = [];
    try {
      for (let i = 0; i < times.length; i++) {
        const t = times[i];
        State.time = t;
        Timeline.updatePlayhead();
        drawScene();
        renderBtn.textContent = '📷 ' + (i + 1) + '/' + times.length;
        const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
        const buf = new Uint8Array(await blob.arrayBuffer());
        files.push({ name: 'frame_' + String(t).replace('.', '_') + 's.png', data: buf });
      }
      const zip = makeZip(files);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zip);
      a.download = 'shotdesigner-frames.zip';
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      State.rendering = false;
      renderBtn.textContent = '🎬 Render ▾';
      renderBtn.disabled = false;
      setTime(0);
      requestRender();
    }
  };

  /* keyboard */
  window.addEventListener('keydown', ev => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === 's' || ev.key === 'S')) {
      ev.preventDefault();
      exportJSON();
      return;
    }
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'z' || ev.key === 'Z' || ev.key === 'y' || ev.key === 'Y')) {
      ev.preventDefault();
      const redo = ev.key === 'y' || ev.key === 'Y' || ev.shiftKey;
      const ok = redo ? History.redoStep() : History.undoStep();
      if (ok) {
        durInput.value = State.project.duration;
        Timeline.render(); UI.refresh(); requestRender(); scheduleSave();
      }
      return;
    }
    if (ev.code === 'Space') { ev.preventDefault(); togglePlay(); return; }
    if (ev.key >= '1' && ev.key <= '9') {
      const cams = State.project.entities.filter(e => e.type === 'camera');
      const cam = cams[+ev.key - 1];
      if (cam) UI.cutTo(cam);
      return;
    }
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      if (State.selectedKf) {
        const e = getEntity(State.selectedKf.entityId);
        if (e) deleteKeyframe(e, State.selectedKf.index);
        State.selectedKf = null;
        UI.afterChange();
      } else if (State.selectedId) {
        removeEntity(State.selectedId);
        UI.afterChange();
      }
      return;
    }
    if (ev.key === 'ArrowLeft') { setTime(snapT(State.time - (ev.shiftKey ? 1 : 0.1))); return; }
    if (ev.key === 'ArrowRight') { setTime(snapT(State.time + (ev.shiftKey ? 1 : 0.1))); return; }
    if (ev.key === 'Escape') { State.selectedId = null; State.selectedKf = null; UI.refresh(); Timeline.render(); requestRender(); }
  });

  /* ---- init ---- */
  const had = loadSaved();
  if (!had) {
    /* demo scene so the app doesn't open empty */
    const a = addEntity('character', { gender: 'f', x: -140, y: -40 });
    a.name = 'Ana';
    const b = addEntity('character', { gender: 'm', x: 60, y: 60 });
    b.name = 'Bruno';
    setKeyframe(a, 5, { x: 40, y: -60, rot: 0 });
    setKeyframe(a, 10, { x: 90, y: 40, rot: 90 });
    a.keyframes[0].bx = -30; a.keyframes[0].by = -70; /* curved first leg */
    const c1 = addEntity('camera', { x: -60, y: 220 });
    c1.keyframes[0].rot = -90;
    const c2 = addEntity('camera', { x: 260, y: -40 });
    c2.keyframes[0].rot = 180;
    addCut(6, c2.id);
    State.selectedId = null;
  }
  durInput.value = State.project.duration;
  autoKeyBtn.classList.toggle('on', State.autoKey);
  loopBtn.classList.toggle('on', State.loop);

  applyStaticLang();
  document.getElementById('lang-en').onclick = () => setLang('en');
  document.getElementById('lang-es').onclick = () => setLang('es');
  resizeCanvas();
  Timeline.render();
  UI.refresh();
  setTime(0);
  History.baseline();
})();
