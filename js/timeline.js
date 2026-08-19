/* ============ Timeline (DOM-based) ============ */
const Timeline = (() => {
  const rowsEl = document.getElementById('tl-rows');
  const labelsEl = document.getElementById('tl-labels');
  const rulerEl = document.getElementById('tl-ruler');
  const playheadEl = document.getElementById('tl-playhead');
  const areaEl = document.getElementById('tl-area');
  const timeEl = document.getElementById('tl-time');

  function pct(t) { return (t / State.project.duration * 100) + '%'; }

  function typeIcon(e) {
    if (e.type === 'camera') return e.pov ? '👁' : '🎥';
    if (e.type === 'character') return e.gender === 'f' ? '♀' : '♂';
    return '▢';
  }

  function render() {
    const P = State.project;
    /* ruler ticks */
    rulerEl.innerHTML = '';
    const step = P.duration > 20 ? 2 : 1;
    for (let s = 0; s <= P.duration; s += step) {
      const tick = document.createElement('div');
      tick.className = 'tick';
      tick.style.left = pct(s);
      tick.textContent = s;
      rulerEl.appendChild(tick);
    }

    /* labels + rows */
    labelsEl.innerHTML = '';
    rowsEl.innerHTML = '';

    /* cut track */
    const cutLabel = document.createElement('div');
    cutLabel.className = 'tl-label cut-label';
    cutLabel.innerHTML = '<span class="lbl-name">🔴 ' + T('CORTES') + '</span>';
    labelsEl.appendChild(cutLabel);
    const cutRow = document.createElement('div');
    cutRow.className = 'tl-row cut-row';
    P.cuts.forEach((c, i) => {
      const cam = getEntity(c.cameraId);
      if (!cam) return;
      const m = document.createElement('div');
      m.className = 'cut-marker';
      m.style.left = pct(c.t);
      m.textContent = cam.name;
      m.title = cam.name + ' @ ' + c.t + 's ' + T('(arrastrar = mover, clic derecho = borrar)');
      m.addEventListener('pointerdown', ev => {
        ev.stopPropagation();
        if (ev.button === 2) return;
        startDragMarker(ev, nt => { c.t = nt; P.cuts.sort((a, b) => a.t - b.t); render(); requestRender(); scheduleSave(); });
      });
      m.addEventListener('contextmenu', ev => {
        ev.preventDefault(); ev.stopPropagation();
        deleteCut(P.cuts.indexOf(c));
        render(); requestRender(); scheduleSave();
      });
      cutRow.appendChild(m);
    });
    rowsEl.appendChild(cutRow);

    /* entity rows */
    P.entities.forEach(e => {
      const lab = document.createElement('div');
      lab.className = 'tl-label' + (State.selectedId === e.id ? ' sel' : '');
      const eye = e.visible ? '👁' : '🚫';
      const path = e.showPath ? '➜' : '·';
      lab.innerHTML =
        '<button class="mini eye" title="' + T('mostrar/ocultar (prender-apagar)') + '">' + eye + '</button>' +
        (e.type !== 'prop' ? '<button class="mini path" title="' + T('mostrar/ocultar recorrido') + '">' + path + '</button>' : '<span class="mini-sp"></span>') +
        '<span class="lbl-name">' + typeIcon(e) + ' ' + e.name + '</span>';
      lab.querySelector('.eye').addEventListener('click', ev => {
        ev.stopPropagation(); e.visible = !e.visible; render(); requestRender(); UI.refresh(); scheduleSave();
      });
      const pbtn = lab.querySelector('.path');
      if (pbtn) pbtn.addEventListener('click', ev => {
        ev.stopPropagation(); e.showPath = !e.showPath; render(); requestRender(); UI.refresh(); scheduleSave();
      });
      lab.addEventListener('click', () => { State.selectedId = e.id; UI.refresh(); render(); requestRender(); });
      labelsEl.appendChild(lab);

      const row = document.createElement('div');
      row.className = 'tl-row' + (State.selectedId === e.id ? ' sel' : '');
      if (!(e.type === 'camera' && e.pov)) {
        e.keyframes.forEach((k, i) => {
          const d = document.createElement('div');
          d.className = 'kf';
          if (State.selectedKf && State.selectedKf.entityId === e.id && State.selectedKf.index === i) d.classList.add('sel');
          if (k.ease) d.classList.add('eased');
          const hasPos = k.x !== undefined, hasRot = k.rot !== undefined;
          if (hasPos && !hasRot) d.classList.add('pos-only');
          if (!hasPos && hasRot) d.classList.add('rot-only');
          d.style.left = pct(k.t);
          const chTxt = hasPos && hasRot ? '' : (' · ' + (hasPos ? T('posicion') : T('rotacion')));
          d.title = k.t + 's' + chTxt + (k.ease ? ' · ' + k.ease : '') + ' ' + T('(arrastrar = mover, clic derecho = borrar)');
          d.addEventListener('pointerdown', ev => {
            ev.stopPropagation();
            if (ev.button === 2) return;
            State.selectedId = e.id;
            State.selectedKf = { entityId: e.id, index: i };
            UI.refresh();
            startDragMarker(ev, nt => {
              k.t = nt;
              e.keyframes.sort((a, b) => a.t - b.t);
              State.selectedKf = { entityId: e.id, index: e.keyframes.indexOf(k) };
              render(); requestRender(); scheduleSave();
            });
            render();
          });
          d.addEventListener('contextmenu', ev => {
            ev.preventDefault(); ev.stopPropagation();
            deleteKeyframe(e, e.keyframes.indexOf(k));
            State.selectedKf = null;
            render(); requestRender(); scheduleSave();
          });
          row.appendChild(d);
        });
      } else {
        const note = document.createElement('div');
        note.className = 'pov-note';
        const ch = getEntity(e.pov);
        note.textContent = T('sigue a') + ' ' + (ch ? ch.name : '?');
        row.appendChild(note);
      }
      rowsEl.appendChild(row);
    });

    updatePlayhead();
  }

  function startDragMarker(ev, onMove) {
    const rect = areaEl.getBoundingClientRect();
    const move = mv => {
      const f = Math.max(0, Math.min(1, (mv.clientX - rect.left) / rect.width));
      onMove(snapT(f * State.project.duration));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function updatePlayhead() {
    playheadEl.style.left = pct(State.time);
    timeEl.textContent = State.time.toFixed(1) + 's / ' + State.project.duration + 's';
  }

  /* scrub by clicking/dragging on the track area or ruler */
  function scrubFrom(ev) {
    const rect = areaEl.getBoundingClientRect();
    const setT = mv => {
      const f = Math.max(0, Math.min(1, (mv.clientX - rect.left) / rect.width));
      Main.setTime(snapT(f * State.project.duration));
    };
    setT(ev);
    const move = mv => setT(mv);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
  areaEl.addEventListener('pointerdown', ev => { if (ev.button === 0) scrubFrom(ev); });

  return { render, updatePlayhead };
})();
