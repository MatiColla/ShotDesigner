/* ============ UI: toolbar, inspector, camera switcher ============ */
var UI = {};
(() => {
  const inspector = document.getElementById('inspector');
  const switcher = document.getElementById('cam-switcher');
  const liveTag = document.getElementById('live-tag');

  function spawnPoint() {
    return { x: State.view.x + (Math.random() * 120 - 60), y: State.view.y + (Math.random() * 120 - 60) };
  }

  function afterChange() {
    Timeline.render();
    requestRender();
    UI.refresh();
    scheduleSave();
  }
  UI.afterChange = afterChange;

  /* ---- toolbar ---- */
  document.getElementById('btn-add-m').onclick = () => { addEntity('character', { gender: 'm', ...spawnPoint() }); afterChange(); };
  document.getElementById('btn-add-f').onclick = () => { addEntity('character', { gender: 'f', ...spawnPoint() }); afterChange(); };
  document.getElementById('btn-add-cam').onclick = () => { addEntity('camera', spawnPoint()); afterChange(); };
  document.getElementById('btn-add-pov').onclick = () => {
    const chars = State.project.entities.filter(e => e.type === 'character');
    if (!chars.length) { alert(T('Primero agrega un personaje.')); return; }
    const cur = getEntity(State.selectedId);
    const target = (cur && cur.type === 'character') ? cur : chars[0];
    const cam = addEntity('camera', {});
    cam.pov = target.id;
    cam.name = 'C' + cam.num + ' POV';
    cam.fov = 70;
    afterChange();
  };
  document.getElementById('btn-add-prop').onclick = () => { addEntity('prop', spawnPoint()); afterChange(); };

  document.getElementById('btn-paths').onclick = () => {
    State.project.showPaths = State.project.showPaths === false ? true : false;
    afterChange();
  };
  const labelsBtn = document.getElementById('btn-labels');
  labelsBtn.onclick = () => {
    State.project.showLabels = State.project.showLabels === false ? true : false;
    afterChange();
  };

  /* background upload */
  const bgInput = document.getElementById('bg-file');
  document.getElementById('btn-bg').onclick = () => bgInput.click();
  bgInput.onchange = () => {
    const f = bgInput.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      State.project.background = { src: r.result, scale: 1, opacity: 1 };
      afterChange();
    };
    r.readAsDataURL(f);
    bgInput.value = '';
  };

  /* project buttons */
  document.getElementById('btn-export').onclick = exportJSON;
  const importInput = document.getElementById('import-file');
  document.getElementById('btn-import').onclick = () => importInput.click();
  importInput.onchange = () => {
    const f = importInput.files[0];
    if (f) importJSON(f, ok => {
      if (!ok) alert(T('Archivo invalido'));
      afterChange();
      document.getElementById('dur-input').value = State.project.duration;
    });
    importInput.value = '';
  };
  document.getElementById('btn-clear').onclick = () => {
    if (!confirm(T('Borrar toda la escena?'))) return;
    State.project = { duration: 15, background: null, entities: [], cuts: [] };
    State.counters = { character: 0, camera: 0, prop: 0 };
    State.selectedId = null; State.selectedKf = null; State.time = 0;
    document.getElementById('dur-input').value = 15;
    afterChange();
  };

  /* ---- camera switcher (live cutting) ---- */
  function renderSwitcher() {
    switcher.innerHTML = '';
    const cams = State.project.entities.filter(e => e.type === 'camera');
    const live = activeCameraAt(State.time);
    cams.forEach((cam, i) => {
      const b = document.createElement('button');
      b.className = 'cam-btn' + (live === cam ? ' live' : '');
      const pc = cam.pov ? getEntity(cam.pov) : null;
      b.innerHTML = '<span class="cam-num">' + (i + 1) + '</span> ' + cam.name + (pc ? ' <small>(POV ' + pc.name + ')</small>' : '');
      b.title = T('Cortar a') + ' ' + cam.name + ' — t=' + State.time.toFixed(1) + 's (' + T('tecla') + ' ' + (i + 1) + ')';
      b.onclick = () => cutTo(cam);
      switcher.appendChild(b);
    });
    if (live) {
      liveTag.textContent = 'LIVE: ' + live.name;
      liveTag.classList.add('on');
    } else {
      liveTag.textContent = T('SIN CAMARA');
      liveTag.classList.remove('on');
    }
  }
  UI.renderSwitcher = renderSwitcher;

  function cutTo(cam) {
    addCut(State.time, cam.id);
    Timeline.render();
    renderSwitcher();
    requestRender();
    scheduleSave();
  }
  UI.cutTo = cutTo;

  /* ---- inspector helpers ---- */
  function swatches(list, cur, onPick) {
    const div = document.createElement('div');
    div.className = 'swatches';
    list.forEach(c => {
      const s = document.createElement('button');
      s.className = 'swatch' + (c === cur ? ' sel' : '');
      s.style.background = c;
      s.onclick = () => onPick(c);
      div.appendChild(s);
    });
    return div;
  }

  function field(labelTxt, node) {
    const w = document.createElement('div');
    w.className = 'field';
    const l = document.createElement('label');
    l.textContent = labelTxt;
    w.appendChild(l); w.appendChild(node);
    return w;
  }
  UI._priv = { inspector, swatches, field };
})();

(() => {
  const { inspector, swatches, field } = UI._priv;
  const afterChange = UI.afterChange;

  function renderInspector() {
    inspector.innerHTML = '';
    const e = getEntity(State.selectedId);
    if (!e) {
      inspector.innerHTML = HINTS[LANG];
      return;
    }
    const title = document.createElement('h3');
    title.textContent = e.name;
    inspector.appendChild(title);

    const nameIn = document.createElement('input');
    nameIn.type = 'text'; nameIn.value = e.name;
    nameIn.oninput = () => { e.name = nameIn.value; Timeline.render(); UI.renderSwitcher(); requestRender(); scheduleSave(); };
    inspector.appendChild(field(T('Nombre'), nameIn));

    if (e.type === 'character') {
      const gWrap = document.createElement('div');
      gWrap.className = 'btn-group';
      [['m', 'Varon'], ['f', 'Mujer']].forEach(([v, txt]) => {
        const b = document.createElement('button');
        b.textContent = T(txt);
        b.className = e.gender === v ? 'sel' : '';
        b.onclick = () => { e.gender = v; afterChange(); };
        gWrap.appendChild(b);
      });
      inspector.appendChild(field(T('Genero'), gWrap));

      inspector.appendChild(field(T('Tono de piel'), swatches(SKIN_TONES, e.skin, c => { e.skin = c; afterChange(); })));

      const clothWrap = document.createElement('div');
      clothWrap.appendChild(swatches(CLOTH_COLORS, e.color, c => { e.color = c; afterChange(); }));
      const colIn = document.createElement('input');
      colIn.type = 'color'; colIn.value = e.color;
      colIn.oninput = () => { e.color = colIn.value; requestRender(); scheduleSave(); };
      clothWrap.appendChild(colIn);
      inspector.appendChild(field(T('Ropa / color'), clothWrap));

      const sc = document.createElement('input');
      sc.type = 'range'; sc.min = 0.6; sc.max = 1.8; sc.step = 0.05; sc.value = e.scale || 1;
      sc.oninput = () => { e.scale = +sc.value; requestRender(); scheduleSave(); };
      inspector.appendChild(field(T('Tamano'), sc));
    }

    if (e.type === 'camera') {
      const fovField = field(T('Angulo (FOV):') + ' ' + e.fov, document.createElement('span'));
      const fov = document.createElement('input');
      fov.type = 'range'; fov.min = 15; fov.max = 120; fov.value = e.fov;
      fov.oninput = () => {
        e.fov = +fov.value;
        fovField.querySelector('label').textContent = T('Angulo (FOV):') + ' ' + e.fov;
        requestRender(); scheduleSave();
      };
      fovField.appendChild(fov);
      inspector.appendChild(fovField);

      const rng = document.createElement('input');
      rng.type = 'range'; rng.min = 80; rng.max = 800; rng.value = e.range;
      rng.oninput = () => { e.range = +rng.value; requestRender(); scheduleSave(); };
      inspector.appendChild(field(T('Alcance'), rng));

      const hhField = field('Handheld: ' + Math.round((e.handheld || 0) * 100) + '%', document.createElement('span'));
      const hh = document.createElement('input');
      hh.type = 'range'; hh.min = 0; hh.max = 1; hh.step = 0.05; hh.value = e.handheld || 0;
      hh.oninput = () => {
        e.handheld = +hh.value;
        hhField.querySelector('label').textContent = 'Handheld: ' + Math.round(e.handheld * 100) + '%';
        requestRender(); scheduleSave();
      };
      hhField.appendChild(hh);
      inspector.appendChild(hhField);

      const sel = document.createElement('select');
      const optNone = document.createElement('option');
      optNone.value = ''; optNone.textContent = T('Camara libre (no POV)');
      sel.appendChild(optNone);
      State.project.entities.filter(x => x.type === 'character').forEach(ch => {
        const o = document.createElement('option');
        o.value = ch.id; o.textContent = T('POV de') + ' ' + ch.name;
        if (e.pov === ch.id) o.selected = true;
        sel.appendChild(o);
      });
      sel.onchange = () => { e.pov = sel.value || null; afterChange(); };
      inspector.appendChild(field(T('Punto de vista'), sel));
    }

    if (e.type === 'prop') {
      const shapeWrap = document.createElement('div');
      shapeWrap.className = 'btn-group';
      [['rect', 'Caja'], ['circle', 'Circulo']].forEach(([v, txt]) => {
        const b = document.createElement('button');
        b.textContent = T(txt);
        b.className = e.shape === v ? 'sel' : '';
        b.onclick = () => { e.shape = v; afterChange(); };
        shapeWrap.appendChild(b);
      });
      inspector.appendChild(field(T('Forma'), shapeWrap));

      const w = document.createElement('input');
      w.type = 'range'; w.min = 20; w.max = 500; w.value = e.w;
      w.oninput = () => { e.w = +w.value; requestRender(); scheduleSave(); };
      inspector.appendChild(field(T('Ancho'), w));
      const h = document.createElement('input');
      h.type = 'range'; h.min = 20; h.max = 500; h.value = e.h;
      h.oninput = () => { e.h = +h.value; requestRender(); scheduleSave(); };
      inspector.appendChild(field(T('Alto'), h));

      const colIn = document.createElement('input');
      colIn.type = 'color'; colIn.value = e.color;
      colIn.oninput = () => { e.color = colIn.value; requestRender(); scheduleSave(); };
      inspector.appendChild(field(T('Color'), colIn));
    }
    UI._renderInspectorTail(e);
  }
  UI._renderInspector = renderInspector;
})();

(() => {
  const { inspector, field } = UI._priv;
  const afterChange = UI.afterChange;

  UI._renderInspectorTail = function (e) {
    const togWrap = document.createElement('div');
    togWrap.className = 'btn-group';
    const vis = document.createElement('button');
    vis.textContent = e.visible ? T('Visible') : T('Oculto');
    vis.className = e.visible ? 'sel' : '';
    vis.onclick = () => { e.visible = !e.visible; afterChange(); };
    togWrap.appendChild(vis);
    if (e.type !== 'prop') {
      const pth = document.createElement('button');
      pth.textContent = T('Recorrido');
      pth.className = e.showPath ? 'sel' : '';
      pth.onclick = () => { e.showPath = !e.showPath; afterChange(); };
      togWrap.appendChild(pth);
    }
    inspector.appendChild(field(T('Mostrar'), togWrap));

    {
      const lblWrap = document.createElement('div');
      const btns = document.createElement('div');
      btns.className = 'btn-group';
      const bShow = document.createElement('button');
      bShow.textContent = T('Nombre');
      bShow.className = e.showLabel !== false ? 'sel' : '';
      bShow.title = T('Mostrar/ocultar el nombre de este elemento');
      bShow.onclick = () => { e.showLabel = e.showLabel === false ? true : false; afterChange(); };
      btns.appendChild(bShow);
      const bBg = document.createElement('button');
      bBg.textContent = T('Fondo');
      bBg.className = e.labelBg !== '' ? 'sel' : '';
      bBg.title = T('Con o sin recuadro de fondo');
      bBg.onclick = () => { e.labelBg = e.labelBg === '' ? undefined : ''; afterChange(); };
      btns.appendChild(bBg);
      lblWrap.appendChild(btns);

      const row = document.createElement('div');
      row.className = 'label-row';
      const ct = document.createElement('input');
      ct.type = 'color'; ct.value = e.labelColor || '#ffffff';
      ct.title = T('Color del texto');
      ct.oninput = () => { e.labelColor = ct.value; requestRender(); scheduleSave(); };
      const cb = document.createElement('input');
      cb.type = 'color'; cb.value = (e.labelBg && e.labelBg !== '') ? e.labelBg : '#101318';
      cb.title = T('Color del fondo del nombre');
      cb.oninput = () => { e.labelBg = cb.value; requestRender(); scheduleSave(); UI._renderInspector(); };
      const sz = document.createElement('input');
      sz.type = 'range'; sz.min = 8; sz.max = 30; sz.step = 1; sz.value = e.labelSize || 12;
      sz.title = T('Tamano del nombre');
      sz.oninput = () => { e.labelSize = +sz.value; requestRender(); scheduleSave(); };
      row.appendChild(ct); row.appendChild(cb); row.appendChild(sz);
      lblWrap.appendChild(row);

      inspector.appendChild(field(T('Etiqueta (texto · fondo · tamano)'), lblWrap));
    }

    if (e.type === 'character' || (e.type === 'camera' && !e.pov)) {
      const orWrap = document.createElement('div');
      orWrap.className = 'btn-group';
      const auto = isAutoOrient(e);
      [[true, 'Recorrido (auto)'], [false, 'Manual']].forEach(([v, txt]) => {
        const b = document.createElement('button');
        b.textContent = T(txt);
        b.className = auto === v ? 'sel' : '';
        b.title = v ? T('Mira hacia donde avanza el recorrido (tangente de la curva)')
                    : T('La rotacion la controlas vos con keyframes');
        b.onclick = () => { e.orient = v ? 'auto' : 'manual'; afterChange(); };
        orWrap.appendChild(b);
      });
      inspector.appendChild(field(T('Mirada / rotacion'), orWrap));
    }

    if (e.type === 'character' || (e.type === 'camera' && !e.pov)) {
      const spWrap = document.createElement('div');
      spWrap.className = 'btn-group';
      const spBtn = document.createElement('button');
      spBtn.textContent = e.split ? T('Separados') : T('Juntos');
      spBtn.className = e.split ? 'sel' : '';
      spBtn.title = T('Separados: al mover se graba solo posicion, al rotar solo rotacion (keyframes independientes)');
      spBtn.onclick = () => { e.split = !e.split; afterChange(); };
      spWrap.appendChild(spBtn);
      inspector.appendChild(field(T('Keyframes pos/rot'), spWrap));
    }

    const kfWrap = document.createElement('div');
    kfWrap.className = 'btn-group vert';
    if (!(e.type === 'camera' && e.pov)) {
      const addKf = document.createElement('button');
      addKf.textContent = T('+ Keyframe en') + ' ' + State.time.toFixed(1) + 's';
      addKf.onclick = () => { setKeyframe(e, State.time, {}); afterChange(); };
      kfWrap.appendChild(addKf);
    }
    if (e.keyframes.length > 1 && !(e.type === 'camera' && e.pov)) {
      const skf = (State.selectedKf && State.selectedKf.entityId === e.id &&
                   State.selectedKf.index < e.keyframes.length - 1)
        ? e.keyframes[State.selectedKf.index] : null;
      const easeWrap = document.createElement('div');
      easeWrap.className = 'btn-group';
      const cur = skf ? (skf.ease || 'linear') : null;
      [['linear', 'Lineal'], ['in', 'Ease in'], ['out', 'Ease out'], ['inout', 'In-Out']].forEach(([v, txt]) => {
        const b = document.createElement('button');
        b.textContent = T(txt);
        b.className = cur === v ? 'sel' : '';
        b.onclick = () => {
          const val = v === 'linear' ? undefined : v;
          if (skf) { if (val) skf.ease = val; else delete skf.ease; }
          else e.keyframes.forEach(k => { if (val) k.ease = val; else delete k.ease; });
          afterChange();
        };
        easeWrap.appendChild(b);
      });
      const easeLbl = skf
        ? T('Suavizado tramo') + ' ' + skf.t + 's → ' + e.keyframes[State.selectedKf.index + 1].t + 's'
        : T('Suavizado (todos los tramos)');
      inspector.appendChild(field(easeLbl, easeWrap));
    }

    if (e.type !== 'prop' && e.keyframes.length > 1 && !(e.type === 'camera' && e.pov)) {
      const straighten = document.createElement('button');
      straighten.textContent = T('Enderezar recorrido');
      straighten.title = T('Quitar la curvatura de todos los tramos');
      straighten.onclick = () => { e.keyframes.forEach(k => { delete k.bx; delete k.by; }); afterChange(); };
      kfWrap.appendChild(straighten);
    }
    const del = document.createElement('button');
    del.className = 'danger';
    del.textContent = T('Eliminar') + ' ' + e.name;
    del.onclick = () => { removeEntity(e.id); afterChange(); };
    kfWrap.appendChild(del);
    inspector.appendChild(kfWrap);
  };

  function renderBgControls() {
    const wrap = document.getElementById('bg-controls');
    const bg = State.project.background;
    if (!bg) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'flex';
    document.getElementById('bg-scale').value = bg.scale;
    document.getElementById('bg-opacity').value = bg.opacity;
  }
  document.getElementById('bg-scale').oninput = ev => {
    if (State.project.background) { State.project.background.scale = +ev.target.value; requestRender(); scheduleSave(); }
  };
  document.getElementById('bg-opacity').oninput = ev => {
    if (State.project.background) { State.project.background.opacity = +ev.target.value; requestRender(); scheduleSave(); }
  };
  document.getElementById('bg-remove').onclick = () => {
    State.project.background = null;
    renderBgControls(); requestRender(); scheduleSave();
  };

  UI.refresh = function () {
    UI._renderInspector();
    UI.renderSwitcher();
    renderBgControls();
    document.getElementById('btn-labels').classList.toggle('on', State.project.showLabels !== false);
    document.getElementById('btn-paths').classList.toggle('on', State.project.showPaths !== false);
  };
})();
