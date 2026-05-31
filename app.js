/**
 * app.js — AntenaMap
 * Lógica completa de la SPA: mapa Leaflet, formulario, multiselect,
 * gestión de antenas en memoria y exportación/importación de JSON.
 */

/* ================================================
   VARIABLES GLOBALES
================================================ */

/** Array en memoria con todos los objetos antena */
let listaAntenas = [];

/**
 * Cada elemento del array de capas del mapa se guarda aquí
 * para poder limpiarlos al cargar un JSON nuevo.
 * Estructura: { marcador: L.Marker, circulo: L.Circle }
 */
let capasEnMapa = [];

/** Referencia al objeto mapa de Leaflet */
let mapa;

/* ================================================
   INICIALIZACIÓN DEL MAPA
================================================ */

/**
 * Crea y configura el mapa centrado en Madrid con la capa de OpenStreetMap.
 * También registra el listener de clic para capturar coordenadas.
 */
function inicializarMapa() {
  // Coordenadas de Madrid, zoom inicial
  mapa = L.map('mapa').setView([40.4168, -3.7038], 12);

  // Capa de teselas gratuita de OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(mapa);

  // Al hacer clic en el mapa → rellenar coordenadas en el formulario
  mapa.on('click', function (evento) {
    const { lat, lng } = evento.latlng;
    document.getElementById('lat').value = lat.toFixed(6);
    document.getElementById('lng').value  = lng.toFixed(6);
    mostrarToast('Coordenadas capturadas del mapa', 'info');
  });
}

/* ================================================
   CREACIÓN DEL ICONO SVG PERSONALIZADO PARA EL MARCADOR
================================================ */

/**
 * Devuelve un L.DivIcon con un SVG que representa una antena de telecomunicaciones.
 * @returns {L.DivIcon}
 */
function crearIconoAntena() {
  const svgHtml = `
    <svg class="icono-antena" xmlns="http://www.w3.org/2000/svg"
         width="32" height="42" viewBox="0 0 32 42">
      <!-- Base y mástil -->
      <rect x="14" y="20" width="4" height="18" fill="#00d4ff" rx="2"/>
      <!-- Cuerpo de la antena -->
      <rect x="10" y="8" width="12" height="14" fill="#0b0f18" stroke="#00d4ff"
            stroke-width="1.5" rx="2"/>
      <!-- Líneas decorativas de la antena -->
      <line x1="13" y1="12" x2="19" y2="12" stroke="#00d4ff" stroke-width="1" opacity="0.7"/>
      <line x1="13" y1="15" x2="19" y2="15" stroke="#00d4ff" stroke-width="1" opacity="0.7"/>
      <!-- Señal: arcos radiantes -->
      <path d="M 6 6 A 12 12 0 0 1 16 2" stroke="#00d4ff" stroke-width="1.5"
            fill="none" opacity="0.9" stroke-linecap="round"/>
      <path d="M 4 10 A 16 16 0 0 1 16 0" stroke="#00d4ff" stroke-width="1"
            fill="none" opacity="0.5" stroke-linecap="round"/>
      <path d="M 26 6 A 12 12 0 0 0 16 2" stroke="#00d4ff" stroke-width="1.5"
            fill="none" opacity="0.9" stroke-linecap="round"/>
      <path d="M 28 10 A 16 16 0 0 0 16 0" stroke="#00d4ff" stroke-width="1"
            fill="none" opacity="0.5" stroke-linecap="round"/>
      <!-- Punto de anclaje -->
      <circle cx="16" cy="38" r="3" fill="#00d4ff" opacity="0.7"/>
    </svg>`;

  return L.divIcon({
    html: svgHtml,
    className: '',           // Sin clase extra para evitar estilos por defecto de Leaflet
    iconSize:   [32, 42],
    iconAnchor: [16, 38],    // El punto de anclaje es el pie del mástil
    popupAnchor: [0, -40]    // El popup aparece por encima del icono
  });
}

/* ================================================
   DIBUJADO DE UNA ANTENA EN EL MAPA
================================================ */

/**
 * Dibuja el marcador y el círculo de cobertura de una antena en el mapa
 * y los registra en el array capasEnMapa.
 * @param {Object} antena - Objeto antena con { nombre, lat, lng, radioAlcance, bandas }
 */
function dibujarAntenaEnMapa(antena) {
  // Crear el marcador con el icono SVG personalizado
  const marcador = L.marker([antena.lat, antena.lng], {
    icon: crearIconoAntena(),
    title: antena.nombre
  });

  // Crear el círculo de cobertura semitransparente
  const circulo = L.circle([antena.lat, antena.lng], {
    radius:      antena.radioAlcance,
    color:       '#00d4ff',      // Borde cian
    fillColor:   '#00d4ff',
    fillOpacity: 0.06,
    weight:      1.5,
    dashArray:   '6, 4'          // Línea discontinua para aspecto técnico
  });

  // Construir el contenido del popup con HTML estilizado
  const bandasHtml = antena.bandas.length > 0
    ? antena.bandas.map(b => `<span class="popup-badge">${b}</span>`).join(' ')
    : '<span style="color:var(--text-muted);font-size:11px">Sin especificar</span>';

  const popupHtml = `
    <div class="popup-antena">
      <h3>📡 ${antena.nombre}</h3>
      <p><strong>Radio de cobertura:</strong> ${antena.radioAlcance.toLocaleString('es-ES')} m</p>
      <p><strong>Coordenadas:</strong> ${antena.lat.toFixed(5)}, ${antena.lng.toFixed(5)}</p>
      <p><strong>Bandas:</strong></p>
      <div class="popup-bandas">${bandasHtml}</div>
    </div>`;

  marcador.bindPopup(popupHtml, { maxWidth: 280 });

  // Añadir ambas capas al mapa
  marcador.addTo(mapa);
  circulo.addTo(mapa);

  // Registrar las capas para poder eliminarlas luego
  capasEnMapa.push({ marcador, circulo });
}

/* ================================================
   LIMPIAR TODAS LAS CAPAS DEL MAPA
================================================ */

/**
 * Elimina todos los marcadores y círculos del mapa
 * y vacía el array de capas y el array de antenas.
 */
function limpiarMapa() {
  capasEnMapa.forEach(({ marcador, circulo }) => {
    mapa.removeLayer(marcador);
    mapa.removeLayer(circulo);
  });
  capasEnMapa = [];
  listaAntenas = [];
  actualizarContador();
}

/* ================================================
   GESTIÓN DEL FORMULARIO
================================================ */

/**
 * Lee los valores del formulario y devuelve un objeto antena.
 * Devuelve null si algún campo obligatorio falta.
 * @returns {Object|null}
 */
function leerFormulario() {
  const nombre      = document.getElementById('nombre').value.trim();
  const lat         = parseFloat(document.getElementById('lat').value);
  const lng         = parseFloat(document.getElementById('lng').value);
  const radioAlcance = parseFloat(document.getElementById('radio').value);

  // Validación básica
  if (!nombre) {
    mostrarToast('⚠ Introduce un nombre para la antena', 'error');
    return null;
  }
  if (isNaN(lat) || isNaN(lng)) {
    mostrarToast('⚠ Coordenadas inválidas. Haz clic en el mapa o escríbelas', 'error');
    return null;
  }
  if (isNaN(radioAlcance) || radioAlcance <= 0) {
    mostrarToast('⚠ Introduce un radio de alcance válido (metros)', 'error');
    return null;
  }

  // Recoger las bandas seleccionadas en el multiselect
  const checkboxes = document.querySelectorAll('.banda-check:checked');
  const bandas = Array.from(checkboxes).map(cb => cb.value);

  return { nombre, lat, lng, radioAlcance, bandas };
}

/**
 * Limpia todos los campos del formulario, incluyendo los checkboxes del multiselect.
 */
function limpiarFormulario() {
  document.getElementById('form-antena').reset();

  // Desmarcar todos los checkboxes del multiselect manualmente
  document.querySelectorAll('.banda-check').forEach(cb => { cb.checked = false; });

  // Actualizar el texto del trigger del multiselect
  actualizarTextoMultiselect();

  // Asegurarse de que el dropdown queda cerrado
  cerrarMultiselect();
}

/* ================================================
   AÑADIR ANTENA AL MAPA
================================================ */

/**
 * Manejador del botón "Añadir Antena al Mapa".
 * Lee el formulario, valida, dibuja la antena y limpia el formulario.
 */
function agregarAntena() {
  const antena = leerFormulario();
  if (!antena) return;                // Validación fallida → salir

  listaAntenas.push(antena);          // Guardar en el array global
  dibujarAntenaEnMapa(antena);        // Dibujar en el mapa
  limpiarFormulario();                // Resetear el formulario
  actualizarContador();               // Actualizar contador del panel

  mostrarToast(`✓ Antena "${antena.nombre}" añadida`, 'success');
}

/* ================================================
   EXPORTAR A JSON
================================================ */

/**
 * Genera un archivo antenas.json con la lista actual y lo descarga.
 */
function exportarJSON() {
  if (listaAntenas.length === 0) {
    mostrarToast('⚠ No hay antenas para exportar', 'error');
    return;
  }

  // Crear el JSON formateado con indentación de 2 espacios
  const jsonString = JSON.stringify(listaAntenas, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url  = URL.createObjectURL(blob);

  // Crear un enlace temporal, hacer clic en él y eliminarlo
  const enlace = document.createElement('a');
  enlace.href     = url;
  enlace.download = 'antenas.json';
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);

  // Liberar el objeto URL de la memoria
  URL.revokeObjectURL(url);

  mostrarToast(`✓ Exportadas ${listaAntenas.length} antenas`, 'success');
}

/* ================================================
   CARGAR JSON EXISTENTE
================================================ */

/**
 * Manejador del input de tipo file para cargar un JSON previo.
 * Lee el archivo, valida la estructura, limpia el mapa y vuelve a dibujarlo todo.
 * @param {Event} evento
 */
function cargarJSON(evento) {
  const archivo = evento.target.files[0];
  if (!archivo) return;

  // Verificar que es un archivo JSON
  if (!archivo.name.endsWith('.json')) {
    mostrarToast('⚠ El archivo debe ser .json', 'error');
    return;
  }

  const lector = new FileReader();

  lector.onload = function (e) {
    try {
      const datos = JSON.parse(e.target.result);

      // Validar que el JSON es un array
      if (!Array.isArray(datos)) {
        throw new Error('El JSON debe ser un array de antenas');
      }

      // Validar que cada objeto tiene las propiedades mínimas necesarias
      datos.forEach((antena, indice) => {
        if (
          typeof antena.nombre      !== 'string' ||
          typeof antena.lat         !== 'number' ||
          typeof antena.lng         !== 'number' ||
          typeof antena.radioAlcance !== 'number'
        ) {
          throw new Error(`Antena en posición ${indice} tiene estructura inválida`);
        }
        // Asegurar que bandas es siempre un array (compatibilidad)
        if (!Array.isArray(antena.bandas)) {
          antena.bandas = [];
        }
      });

      // Limpiar el mapa actual y cargar las nuevas antenas
      limpiarMapa();
      datos.forEach(antena => {
        listaAntenas.push(antena);
        dibujarAntenaEnMapa(antena);
      });

      actualizarContador();

      // Si hay antenas, centrar el mapa en la primera
      if (listaAntenas.length > 0) {
        const primera = listaAntenas[0];
        mapa.setView([primera.lat, primera.lng], 12);
      }

      mostrarToast(`✓ ${datos.length} antenas cargadas desde el JSON`, 'success');

    } catch (error) {
      mostrarToast(`✗ Error al parsear el JSON: ${error.message}`, 'error');
      console.error('Error al cargar JSON:', error);
    }

    // Limpiar el input para permitir cargar el mismo archivo otra vez
    evento.target.value = '';
  };

  lector.onerror = function () {
    mostrarToast('✗ Error al leer el archivo', 'error');
  };

  lector.readAsText(archivo);
}

/* ================================================
   DESPLEGABLE MULTIOPCIÓN (Multiselect)
================================================ */

/** Estado abierto/cerrado del multiselect */
let multiselectAbierto = false;

/**
 * Abre o cierra el menú del multiselect.
 */
function toggleMultiselect() {
  multiselectAbierto ? cerrarMultiselect() : abrirMultiselect();
}

function abrirMultiselect() {
  const trigger  = document.getElementById('multiselect-trigger');
  const dropdown = document.getElementById('multiselect-dropdown');
  trigger.classList.add('open');
  trigger.setAttribute('aria-expanded', 'true');
  dropdown.classList.add('open');
  multiselectAbierto = true;
}

function cerrarMultiselect() {
  const trigger  = document.getElementById('multiselect-trigger');
  const dropdown = document.getElementById('multiselect-dropdown');
  trigger.classList.remove('open');
  trigger.setAttribute('aria-expanded', 'false');
  dropdown.classList.remove('open');
  multiselectAbierto = false;
}

/**
 * Actualiza el texto resumen en el trigger del multiselect
 * según cuántos checkboxes estén marcados.
 */
function actualizarTextoMultiselect() {
  const checkboxesMarcados = document.querySelectorAll('.banda-check:checked');
  const textoSpan = document.getElementById('multiselect-text');
  const cantidad  = checkboxesMarcados.length;

  if (cantidad === 0) {
    textoSpan.textContent = 'Seleccionar bandas...';
    textoSpan.classList.remove('has-selection');
  } else if (cantidad === 1) {
    textoSpan.textContent = checkboxesMarcados[0].value;
    textoSpan.classList.add('has-selection');
  } else {
    textoSpan.textContent = `${cantidad} bandas seleccionadas`;
    textoSpan.classList.add('has-selection');
  }
}

/**
 * Configura todos los event listeners del multiselect.
 */
function inicializarMultiselect() {
  const trigger  = document.getElementById('multiselect-trigger');
  const contenedor = document.getElementById('multiselect-bandas');

  // Abrir/cerrar al hacer clic en el trigger
  trigger.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleMultiselect();
  });

  // Soporte de teclado: Enter y Espacio abren/cierran; Escape cierra
  trigger.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleMultiselect();
    }
    if (e.key === 'Escape') {
      cerrarMultiselect();
    }
  });

  // Actualizar el texto resumen cuando cambia algún checkbox
  document.querySelectorAll('.banda-check').forEach(cb => {
    cb.addEventListener('change', actualizarTextoMultiselect);
  });

  // Evitar que los clics dentro del dropdown cierren el menú
  contenedor.addEventListener('click', function (e) {
    e.stopPropagation();
  });

  // Cerrar el dropdown si el usuario hace clic fuera
  document.addEventListener('click', function (e) {
    if (!contenedor.contains(e.target)) {
      cerrarMultiselect();
    }
  });
}

/* ================================================
   CONTADOR DE ANTENAS
================================================ */

/**
 * Actualiza el contador visual en el pie del panel.
 */
function actualizarContador() {
  document.getElementById('contador').textContent = listaAntenas.length;
}

/* ================================================
   TOAST / NOTIFICACIÓN
================================================ */

/** Temporizador para autoocultar el toast */
let toastTimer = null;

/**
 * Muestra una notificación temporal en la parte inferior de la pantalla.
 * @param {string} mensaje - Texto a mostrar
 * @param {'success'|'error'|'info'} tipo - Variante visual
 */
function mostrarToast(mensaje, tipo = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = mensaje;
  toast.className = `toast ${tipo} show`;

  // Limpiar el temporizador anterior si existía
  if (toastTimer) clearTimeout(toastTimer);

  // Ocultar automáticamente tras 3 segundos
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

/* ================================================
   REGISTRO DE EVENTOS DE BOTONES
================================================ */

/**
 * Asocia los botones de la cabecera y el formulario con sus funciones.
 */
function registrarEventos() {
  // Botón "Añadir Antena al Mapa"
  document.getElementById('btn-agregar').addEventListener('click', agregarAntena);

  // Botón "Exportar a JSON"
  document.getElementById('btn-exportar').addEventListener('click', exportarJSON);

  // Input "Cargar JSON"
  document.getElementById('input-cargar').addEventListener('change', cargarJSON);
}

/* ================================================
   PUNTO DE ENTRADA: ARRANQUE DE LA APLICACIÓN
================================================ */

/**
 * Se ejecuta cuando el DOM está completamente cargado.
 * Inicializa el mapa, el multiselect y registra todos los eventos.
 */
document.addEventListener('DOMContentLoaded', function () {
  inicializarMapa();
  inicializarMultiselect();
  registrarEventos();
  actualizarContador();

  console.log('%cAntenaMap iniciado ✓', 'color:#00d4ff;font-family:monospace;font-size:14px');
});
