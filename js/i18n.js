/* ============ i18n: ES (source) / EN ============ */
const LANG_KEY = 'shotdesigner_lang';
let LANG = 'es';
try { LANG = localStorage.getItem(LANG_KEY) || 'es'; } catch (e) {}

const I18N_EN = {
  'Nombre': 'Name', 'Genero': 'Gender', 'Varon': 'Male', 'Mujer': 'Female',
  'Tono de piel': 'Skin tone', 'Ropa / color': 'Clothes / color', 'Tamano': 'Size',
  'Alcance': 'Range', 'Angulo (FOV):': 'Angle (FOV):',
  'Punto de vista': 'Point of view', 'Camara libre (no POV)': 'Free camera (no POV)',
  'POV de': 'POV of', 'Forma': 'Shape', 'Caja': 'Box', 'Circulo': 'Circle',
  'Ancho': 'Width', 'Alto': 'Height', 'Color': 'Color',
  'Mostrar': 'Show', 'Visible': 'Visible', 'Oculto': 'Hidden', 'Recorrido': 'Path',
  'Etiqueta (texto \u00b7 fondo \u00b7 tamano)': 'Label (text \u00b7 bg \u00b7 size)',
  'Fondo': 'Bg', 'Mirada / rotacion': 'Facing / rotation',
  'Recorrido (auto)': 'Follow path (auto)', 'Manual': 'Manual',
  'Keyframes pos/rot': 'Pos/rot keyframes', 'Juntos': 'Combined', 'Separados': 'Separate',
  'Suavizado (todos los tramos)': 'Easing (all segments)', 'Suavizado tramo': 'Easing segment',
  'Lineal': 'Linear', '+ Keyframe en': '+ Keyframe at',
  'Enderezar recorrido': 'Straighten path',
  'Quitar la curvatura de todos los tramos': 'Remove curvature from all segments',
  'Eliminar': 'Delete', 'CORTES': 'CUTS', 'SIN CAMARA': 'NO CAMERA',
  'Cortar a': 'Cut to', 'tecla': 'key', 'sigue a': 'follows',
  'posicion': 'position', 'rotacion': 'rotation',
  '(arrastrar = mover, clic derecho = borrar)': '(drag = move, right-click = delete)',
  'mostrar/ocultar (prender-apagar)': 'show/hide (on-off)',
  'mostrar/ocultar recorrido': 'show/hide path',
  'Mostrar/ocultar el nombre de este elemento': "Show/hide this element's name",
  'Con o sin recuadro de fondo': 'With or without background box',
  'Color del texto': 'Text color', 'Color del fondo del nombre': 'Name background color',
  'Tamano del nombre': 'Name size',
  'Mira hacia donde avanza el recorrido (tangente de la curva)': 'Faces where the path is heading (curve tangent)',
  'La rotacion la controlas vos con keyframes': 'You control rotation with keyframes',
  'Separados: al mover se graba solo posicion, al rotar solo rotacion (keyframes independientes)':
    'Separate: moving records only position, rotating only rotation (independent keyframes)',
  'Primero agrega un personaje.': 'Add a character first.',
  'Archivo invalido': 'Invalid file',
  'Borrar toda la escena?': 'Clear the whole scene?',
  'Tu navegador no soporta grabacion de video.': 'Your browser does not support video recording.',
  'Tu navegador no muxea MP4 nativo: se descargo WebM (Chrome/Edge actual descarga MP4 directo). El WebM se convierte facil con cualquier conversor.':
    'Your browser cannot mux native MP4: a WebM was downloaded (current Chrome/Edge downloads MP4 directly). WebM converts easily with any converter.'
};

function T(s) { return LANG === 'es' ? s : (I18N_EN[s] || s); }

const HINTS = {
  es: '<div class="hint">Selecciona un elemento del plano.<br><br>' +
    '<b>Atajos:</b><br>Espacio: play/pausa<br>1-9: cortar a esa camara<br>' +
    'Ctrl+Z: deshacer / Ctrl+Shift+Z o Ctrl+Y: rehacer<br>' +
    'Supr: borrar keyframe o elemento<br>Rueda: zoom / arrastrar vacio: mover vista<br>' +
    'Punto celeste: rotar<br>' +
    'Cuadrado naranja del recorrido: arrastrar = curva bezier, clic derecho = enderezar<br>' +
    'Doble clic sobre el recorrido: insertar keyframe ahi (para curvas tipo S / vibora)<br><br>' +
    '<b>Keyframes:</b> con AUTO-KEY activado, mueve el playhead a un segundo y arrastra el personaje: se graba solo.</div>',
  en: '<div class="hint">Select an element on the stage.<br><br>' +
    '<b>Shortcuts:</b><br>Space: play/pause<br>1-9: cut to that camera<br>' +
    'Ctrl+Z: undo / Ctrl+Shift+Z or Ctrl+Y: redo<br>' +
    'Del: delete keyframe or element<br>Wheel: zoom / drag empty space: pan view<br>' +
    'Blue dot: rotate<br>' +
    'Orange square on the path: drag = bezier curve, right-click = straighten<br>' +
    'Double-click on the path: insert a keyframe there (for S / snake curves)<br><br>' +
    '<b>Keyframes:</b> with AUTO-KEY on, move the playhead to a second and drag the character: it records itself.</div>'
};

/* static DOM texts: [text, title] per language (null = keep) */
const STATIC_TEXT = {
  'btn-add-m':   { es: ['\u2642 Varon', 'Agregar personaje varon'], en: ['\u2642 Male', 'Add male character'] },
  'btn-add-f':   { es: ['\u2640 Mujer', 'Agregar personaje mujer'], en: ['\u2640 Female', 'Add female character'] },
  'btn-add-cam': { es: ['\ud83c\udfa5 Camara', 'Agregar camara'], en: ['\ud83c\udfa5 Camera', 'Add camera'] },
  'btn-add-pov': { es: ['\ud83d\udc41 POV', 'Agregar camara POV del personaje seleccionado'], en: ['\ud83d\udc41 POV', 'Add a POV camera for the selected character'] },
  'btn-add-prop':{ es: ['\u25a2 Objeto', 'Agregar objeto'], en: ['\u25a2 Prop', 'Add prop'] },
  'btn-bg':      { es: ['\ud83d\uddbc Fondo', 'Cargar imagen de fondo (tu plano)'], en: ['\ud83d\uddbc Backdrop', 'Load a background image (your floor plan)'] },
  'btn-labels':  { es: ['\ud83c\udff7 Nombres', 'Mostrar/ocultar todos los nombres'], en: ['\ud83c\udff7 Names', 'Show/hide all names'] },
  'btn-paths':   { es: ['\u279c Recorridos', 'Mostrar/ocultar todas las lineas de recorrido'], en: ['\u279c Paths', 'Show/hide all path lines'] },
  'btn-render':  { es: ['\ud83c\udfac Render \u25be', 'Renderizar: video o secuencia de imagenes'], en: ['\ud83c\udfac Render \u25be', 'Render: video or image sequence'] },
  'btn-render-video': { es: ['\ud83c\udfac Video (MP4, max 30 MB)', null], en: ['\ud83c\udfac Video (MP4, max 30 MB)', null] },
  'btn-render-seq': { es: ['\ud83d\uddbc Imagenes (1 cada 3 s, ZIP)', null], en: ['\ud83d\uddbc Images (1 every 3 s, ZIP)', null] },
  'btn-export':  { es: ['\ud83d\udcbe Guardar', 'Guardar la escena: descarga el archivo JSON (Ctrl+S)'], en: ['\ud83d\udcbe Save', 'Save the scene: downloads the JSON file (Ctrl+S)'] },
  'btn-import':  { es: ['\ud83d\udcc2 Abrir', 'Abrir una escena guardada (JSON)'], en: ['\ud83d\udcc2 Open', 'Open a saved scene (JSON)'] },
  'btn-clear':   { es: ['\ud83d\uddd1 Nueva', 'Escena nueva'], en: ['\ud83d\uddd1 New', 'New scene'] },
  'btn-stop':    { es: [null, 'Volver al inicio'], en: [null, 'Back to start'] },
  'btn-play':    { es: [null, 'Play / Pausa (espacio)'], en: [null, 'Play / Pause (space)'] },
  'btn-end':     { es: [null, 'Ir al final'], en: [null, 'Go to the end'] },
  'btn-loop':    { es: [null, 'Repetir'], en: [null, 'Loop'] },
  'btn-autokey': { es: [null, 'AUTO-KEY: al mover algo, graba keyframe en el tiempo actual'], en: [null, 'AUTO-KEY: moving something records a keyframe at the current time'] },
  'bg-remove':   { es: [null, 'Quitar fondo'], en: [null, 'Remove background'] },
  'switcher-hint': { es: ['clic o teclas 1-9 = cortar a esa camara en el tiempo actual (edicion en vivo)', null], en: ['click or keys 1-9 = cut to that camera at the current time (live editing)', null] },
  'dur-pre':  { es: ['Duracion', null], en: ['Duration', null] },
  'dur-post': { es: ['s (max 30)', null], en: ['s (max 30)', null] },
  'bg-scale-lbl':   { es: ['escala', null], en: ['scale', null] },
  'bg-opacity-lbl': { es: ['opacidad', null], en: ['opacity', null] }
};

function applyStaticLang() {
  for (const id in STATIC_TEXT) {
    const el = document.getElementById(id);
    if (!el) continue;
    const pair = STATIC_TEXT[id][LANG];
    if (pair[0] != null) el.textContent = pair[0];
    if (pair[1] != null) el.title = pair[1];
  }
  const be = document.getElementById('lang-en'), bs = document.getElementById('lang-es');
  if (be) be.classList.toggle('sel', LANG === 'en');
  if (bs) bs.classList.toggle('sel', LANG === 'es');
}

function setLang(l) {
  LANG = l;
  try { localStorage.setItem(LANG_KEY, l); } catch (e) {}
  applyStaticLang();
  if (window.UI && UI.refresh) { UI.refresh(); Timeline.render(); requestRender(); }
}
