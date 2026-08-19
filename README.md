# Shot Designer — Blocking Top-Down

App de navegador para planear blocking de escenas (estilo Hollywood Camera Work Shot Designer).
Sin dependencias: abrir `index.html` o servir la carpeta con cualquier server estatico.

## Funciones
- **Vista ortografica desde arriba** con zoom (rueda) y paneo (arrastrar vacio / boton derecho).
- **Fondo propio**: boton "Fondo" carga tu imagen (plano del set); escala y opacidad ajustables.
- **Personajes top-down**: varon / mujer distinguibles (pelo), tono de piel (6 tonos), color de ropa libre, tamano.
- **Keyframes faciles**: con AUTO-KEY activado, move el playhead al segundo deseado y arrastra el personaje — el keyframe se graba solo. Tambien "+ Keyframe" en el inspector. Arrastrar rombos en el timeline los mueve; clic derecho los borra.
- **Duracion ajustable** 1–30 s.
- **Prender/apagar**: ojo por fila en el timeline (o "Visible" en inspector) oculta cualquier elemento; la flecha ➜ oculta/muestra el recorrido.
- **Recorridos con flechas**: linea punteada + flechas + tiempos por cada keyframe.
- **Camaras + edicion en vivo**: cada camara muestra su cono (FOV/alcance). La barra de arriba corta a una camara en el tiempo actual (clic o teclas 1-9); la activa se ve ROJA con etiqueta LIVE, las demas grises. Los cortes quedan en la pista CORTES (arrastrables, clic derecho borra).
- **Curvas bezier en recorridos**: con el elemento seleccionado, arrastra el cuadrado naranja del medio de cada tramo para curvarlo (clic derecho sobre el cuadrado = enderezar; boton "Enderezar recorrido" quita todas las curvas). Las flechas siguen la tangente y el personaje camina por la curva. Doble clic sobre el recorrido inserta un keyframe en ese punto sin deformar la curva (subdivision exacta), para encadenar varias curvas tipo S/vibora dentro de un mismo trayecto.
- **Ease in / ease out**: seleccionando un keyframe (rombo) en el timeline, en el inspector aparece el suavizado del tramo que sale de el (Lineal / Ease in / Ease out / In-Out); sin keyframe seleccionado, se aplica a todos los tramos. Los keyframes con suavizado se ven redondos.
- **Handheld**: cada camara tiene un slider Handheld (0-100%) que agrega vibracion organica de camara en mano (deterministica: al re-reproducir se ve igual).
- **Mirada automatica**: por defecto los personajes miran hacia donde avanza su recorrido (siguen la tangente de la curva, tambien en tramos bezier). En el inspector, "Mirada / rotacion" permite pasar a Manual (rotacion por keyframes); agarrar el manguito celeste de rotacion tambien pasa a Manual automaticamente. Las camaras libres pueden activar el modo auto si se quiere que miren hacia donde se desplazan.
- **Keyframes pos/rot separados**: en personajes y camaras libres, el boton "Keyframes pos/rot: Separados" hace que mover grabe solo posicion y rotar solo rotacion (rombos celestes = posicion, verdes = rotacion, con canales independientes al interpolar).
- **POV de personaje**: boton "POV" o en el inspector de una camara elegir "POV de <personaje>"; la camara sigue posicion y mirada del personaje.
- **Objetos** (cajas/circulos) para marcar muebles o zonas.
- **Etiquetas de nombre configurables**: boton "Nombres" en la barra superior oculta/muestra todos; por elemento, el inspector permite ocultar su nombre, quitar o colorear el fondo, cambiar el color del texto y el tamano (8-30).
- **Historial**: deshacer/rehacer con Ctrl+Z y Ctrl+Shift+Z (hasta 60 pasos; cada arrastre o accion es un paso).
- **Render**: el boton "Render" abre un menu con dos salidas. (a) Video: graba la animacion completa (0 a duracion, 60 fps, sin grilla ni selecciones) y descarga un MP4 (o WebM si el navegador no muxea MP4). Lo que se ve es lo que se graba: podes apagar nombres/recorridos antes de renderizar. (b) Secuencia de imagenes: un PNG cada 3 segundos (0s, 3s, 6s... + el frame final), descargados en un unico ZIP.
- **Toggle global de recorridos**: boton "Recorridos" en la barra superior oculta/muestra todas las lineas de recorrido de una vez (tambien desactiva los handles de curvatura mientras esta apagado).
- **Guardar / Abrir**: boton Guardar (o Ctrl+S) descarga la escena como JSON directamente; Abrir la carga. Ademas hay autoguardado continuo en localStorage.

## Atajos
| Tecla | Accion |
|---|---|
| Espacio | Play / Pausa |
| Ctrl+Z / Ctrl+Shift+Z (o Ctrl+Y) | Deshacer / Rehacer |
| Ctrl+S | Guardar (descarga el JSON) |
| 1–9 | Cortar a esa camara (en vivo) |
| ← / → | Mover playhead 0.1s (Shift: 1s) |
| Supr | Borrar keyframe seleccionado o elemento |
| Esc | Deseleccionar |
| Shift al rotar | Snap de 15 grados |
