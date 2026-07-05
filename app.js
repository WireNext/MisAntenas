/**
 * app.js — AntenaMap
 * Lógica completa de la SPA: mapa Leaflet, formulario, multiselect,
 * gestión de antenas en memoria y exportación/importación de JSON.
 * Ahora con edición de antenas y colores por tecnología.
 */

/* ================================================
   VARIABLES GLOBALES
================================================ */

/** Array en memoria con todos los objetos antena */
let listaAntenas = [];

/**
 * Cada elemento del array de capas del mapa se guarda aquí
 * para poder limpiarlos al cargar un JSON nuevo.
 * Estructura: { marcador: L.Marker, circulo: L.Circle, indice: number }
 */
let capasEnMapa = [];

/** Referencia al objeto mapa de Leaflet */
let mapa;

/** Índice de la antena en edición (-1 si no hay ninguna en edición) */
let indiceEnEdicion = -1;

let grupoMarcadores;

/* ================================================
   FUNCIÓN AUXILIAR: DETERMINAR COLOR POR TECNOLOGÍA
================================================ */

/**
 * Determina el color del círculo de cobertura basándose en la mejor tecnología disponible.
 * Prioridad: 5G mmW > 5G n78 > 5G > 4G > 3G > 2G
 * @param {Array<string>} bandas - Array de bandas/frecuencias seleccionadas
 * @returns {Object} { color: string, fillColor: string, nombreTecnologia: string }
 */
function obtenerColorPorTecnologia(bandas) {
  // Mapeo de bandas a tecnologías
  const mapaBandas = {
    '700 MHz': '5G',
    '800 MHz': '4G',
    '900 MHz': '3G',      // Principalmente 3G (también 2G)
    '1800 MHz': '4G',     // Principalmente 4G (también 2G)
    '2100 MHz': '4G',     // Principalmente 4G (también 3G)
    '2600 MHz': '4G',
    '3500 MHz': '5G n78',
    '26 GHz': '5G mmW'
  };

  // Extrae las tecnologías de las bandas seleccionadas
  const tecnologias = new Set();
  bandas.forEach(banda => {
    const tecn = mapaBandas[banda];
    if (tecn) tecnologias.add(tecn);
  });

  // Determinar la mejor tecnología (prioridad descendente)
if (tecnologias.has('5G mmW')) {
    return {
      color: '#2d1b4e',           // Morado oscuro
      fillColor: '#2d1b4e',
      nombreTecnologia: '5G mmW',
      prioridad: 6,
      claseBlur: 'cobertura-blur-high'
    };
  }
  if (tecnologias.has('5G n78')) {
    return {
      color: '#7c3aed',           // Morado
      fillColor: '#7c3aed',
      nombreTecnologia: '5G n78',
      prioridad: 5,
      claseBlur: 'cobertura-blur-high'
    };
  }
  if (tecnologias.has('5G')) {
    return {
      color: '#ec4899',           // Rosa
      fillColor: '#ec4899',
      nombreTecnologia: '5G',
      prioridad: 4,
      claseBlur: 'cobertura-blur-high'
    };
  }
  if (tecnologias.has('4G')) {
    return {
      color: '#22c55e',           // Verde
      fillColor: '#22c55e',
      nombreTecnologia: '4G',
      prioridad: 3,
      claseBlur: 'cobertura-blur-mid'
    };
  }
  if (tecnologias.has('3G')) {
    return {
      color: '#f59e0b',           // Naranja
      fillColor: '#f59e0b',
      nombreTecnologia: '3G',
      prioridad: 2,
      claseBlur: 'cobertura-blur-low'
    };
  }
  // Si solo hay 2G o ninguna banda seleccionada
  return {
    color: '#6b7280',             // Gris
    fillColor: '#6b7280',
    nombreTecnologia: '2G',
    prioridad: 1,
    claseBlur: 'cobertura-blur-low'
  };
}

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
  grupoMarcadores = L.layerGroup().addTo(mapa);

  // Crear el panel de control de capas (arriba a la derecha)
  const capasSuperpuestas = {
    "📌 Mostrar Marcadores": grupoMarcadores
  };
  
  // Añadir el selector al mapa de forma compacta
  L.control.layers(null, capasSuperpuestas, { collapsed: false }).addTo(mapa);
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
 * @param {number} indice - Índice de la antena en el array listaAntenas
 */
function dibujarAntenaEnMapa(antena, indice) {
  // 1. Crear el marcador con el icono SVG personalizado
  const marcador = L.marker([antena.lat, antena.lng], {
    icon: crearIconoAntena(),
    title: antena.nombre
  });

  // 2. Obtener color, prioridad y metadatos basados en la tecnología
  const infoColor = obtenerColorPorTecnologia(antena.bandas);

  // ID único para el degradado de esta antena en concreto
  const idDegradado = `degradado-antena-${indice}-${Date.now()}`;

  // 3. Crear el círculo de cobertura
  const circulo = L.circle([antena.lat, antena.lng], {
    radius:      antena.radioAlcance,
    color:       'transparent', // Quitamos el borde sólido exterior
    fillColor:   infoColor.fillColor,
    fillOpacity: 0.6,          // Opacidad máxima en el centro del degradado
    weight:      0
  });

  // Guardamos la prioridad en la capa para la ordenación posterior
  circulo.prioridadTecnologica = infoColor.prioridad;

  // 4. Inyectar el degradado radial cuando el círculo se añade al mapa
  circulo.on('add', function () {
    // Leaflet genera un elemento SVG por cada capa. Obtenemos su contenedor <svg>
    const svg = circulo._renderer._container;
    
    // Comprobar si ya existe una sección <defs> en el SVG del mapa, si no, crearla
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      svg.insertBefore(defs, svg.firstChild);
    }

    // Crear el elemento radialGradient personalizado para esta cobertura
    const radialGradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
    radialGradient.setAttribute('id', idDegradado);
    radialGradient.setAttribute('cx', '50%');
    radialGradient.setAttribute('cy', '50%');
    radialGradient.setAttribute('r', '50%'); // El degradado se extiende hasta el borde exacto

    // Parada 0% (Centro del círculo): Color sólido con la opacidad configurada
    const stopCentro = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stopCentro.setAttribute('offset', '0%');
    stopCentro.setAttribute('stop-color', infoColor.fillColor);
    stopCentro.setAttribute('stop-opacity', '1');

    // Parada 70% (Donde empieza a desvanecerse con más fuerza)
    const stopMedio = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stopMedio.setAttribute('offset', '60%');
    stopMedio.setAttribute('stop-color', infoColor.fillColor);
    stopMedio.setAttribute('stop-opacity', '0.7');

    // Parada 100% (Borde exterior): Totalmente transparente
    const stopBorde = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stopBorde.setAttribute('offset', '100%');
    stopBorde.setAttribute('stop-color', infoColor.fillColor);
    stopBorde.setAttribute('stop-opacity', '0');

    // Unir las paradas al degradado y guardarlo en <defs>
    radialGradient.appendChild(stopCentro);
    radialGradient.appendChild(stopMedio);
    radialGradient.appendChild(stopBorde);
    defs.appendChild(radialGradient);

    // Aplicar el degradado generado al relleno del círculo de Leaflet
    if (circulo._path) {
      circulo._path.setAttribute('fill', `url(#${idDegradado})`);
    }
  });

  // 5. Configurar el Popup (Igual que lo tenías)
  const bandasHtml = antena.bandas.length > 0
    ? antena.bandas.map(b => `<span class="popup-badge">${b}</span>`).join(' ')
    : '<span style="color:var(--text-muted);font-size:11px">Sin especificar</span>';

  const popupHtml = `
    <div class="popup-antena">
      <h3>📡 ${antena.nombre}</h3>
      <p><strong>Tecnología:</strong> ${infoColor.nombreTecnologia}</p>
      <p><strong>Radio:</strong> ${antena.radioAlcance.toLocaleString('es-ES')} m</p>
      <div class="popup-bandas">${bandasHtml}</div>
      <div class="popup-acciones">
        <button class="popup-btn popup-btn-editar" data-indice="${indice}" onclick="abrirEdicion(event)">✏ Editar</button>
        <button class="popup-btn popup-btn-eliminar" data-indice="${indice}" onclick="eliminarAntena(event)">🗑 Eliminar</button>
      </div>
    </div>`;

  marcador.bindPopup(popupHtml, { maxWidth: 300 });

  // 6. Añadir al mapa
  circulo.addTo(mapa);
  marcador.addTo(mapa);

  // Registrar las capas para mantener el control de memoria
  capasEnMapa.push({ marcador, circulo, indice });

  // 7. --- CONTROL DE SOLAPAMIENTO (La mejor cobertura encima) ---
  // Ordenamos el array de capas de menor a mayor prioridad tecnológica
  // y llamamos a bringToFront() consecutivamente.
  capasEnMapa
    .sort((a, b) => (a.circulo.prioridadTecnologica || 0) - (b.circulo.prioridadTecnologica || 0))
    .forEach(capa => {
      if (capa.circulo && typeof capa.circulo.bringToFront === 'function') {
        capa.circulo.bringToFront();
      }
    });
    
  // Asegurar que los pines de las antenas queden siempre por encima de las áreas difuminadas
  capasEnMapa.forEach(capa => {
    if (capa.marcador && typeof capa.marcador.bringToFront === 'function') {
      capa.marcador.bringToFront();
    }
  });
  circulo.addTo(mapa);                 // La cobertura se queda fija en el mapa base
  marcador.addTo(grupoMarcadores);     // El marcador va al grupo conmutable

  // Registrar las capas para mantener el control de memoria y edición
  capasEnMapa.push({ marcador, circulo, indice });

  // 7. --- CONTROL DE SOLAPAMIENTO (La mejor cobertura encima) ---
  capasEnMapa
    .sort((a, b) => (a.circulo.prioridadTecnologica || 0) - (b.circulo.prioridadTecnologica || 0))
    .forEach(capa => {
      if (capa.circulo && typeof capa.circulo.bringToFront === 'function') {
        capa.circulo.bringToFront();
      }
    });
    
  // Asegurar que los pines queden por encima de las coberturas (solo si el grupo está visible)
  if (mapa.hasLayer(grupoMarcadores)) {
    capasEnMapa.forEach(capa => {
      if (capa.marcador && typeof capa.marcador.bringToFront === 'function') {
        capa.marcador.bringToFront();
      }
    });
  }
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

  // Resetear el estado de edición
  indiceEnEdicion = -1;
  actualizarBotonesPrincipales();
}

/**
 * Actualiza los botones principales según si estamos en modo edición o no.
 */
function actualizarBotonesPrincipales() {
  const btnAgregar = document.getElementById('btn-agregar');
  const panelTitle = document.querySelector('.panel-title');

  if (indiceEnEdicion !== -1) {
    btnAgregar.textContent = '✓ Actualizar Antena';
    btnAgregar.classList.add('editing');
    panelTitle.textContent = 'Editar Antena';
  } else {
    btnAgregar.textContent = '＋ Añadir Antena al Mapa';
    btnAgregar.classList.remove('editing');
    panelTitle.textContent = 'Nueva Antena';
  }
}

/**
 * Abre el formulario para editar una antena.
 * Se dispara desde el botón de editar en el popup de la antena.
 */
function abrirEdicion(evento) {
  evento.preventDefault();
  evento.stopPropagation();

  const indice = parseInt(evento.target.getAttribute('data-indice'));
  const antena = listaAntenas[indice];

  if (!antena) return;

  indiceEnEdicion = indice;

  // Rellenar el formulario con los datos de la antena
  document.getElementById('nombre').value = antena.nombre;
  document.getElementById('lat').value = antena.lat;
  document.getElementById('lng').value = antena.lng;
  document.getElementById('radio').value = antena.radioAlcance;

  // Marcar las bandas correspondientes
  document.querySelectorAll('.banda-check').forEach(cb => {
    cb.checked = antena.bandas.includes(cb.value);
  });

  actualizarTextoMultiselect();
  actualizarBotonesPrincipales();

  // Cerrar el popup
  mapa.closePopup();

  // Scroll al panel (opcional, para destacar que está en edición)
  document.getElementById('panel-lateral').scrollTop = 0;

  mostrarToast(`✏ Editando antena: "${antena.nombre}"`, 'info');
}

/**
 * Elimina una antena del mapa y del array.
 * Se dispara desde el botón de eliminar en el popup de la antena.
 */
function eliminarAntena(evento) {
  evento.preventDefault();
  evento.stopPropagation();

  const indice = parseInt(evento.target.getAttribute('data-indice'));
  const antena = listaAntenas[indice];

  if (!antena) return;

  // Buscar y remover las capas del mapa
  const capaIndex = capasEnMapa.findIndex(c => c.indice === indice);
  if (capaIndex !== -1) {
    const { marcador, circulo } = capasEnMapa[capaIndex];
    mapa.removeLayer(marcador);
    mapa.removeLayer(circulo);
    capasEnMapa.splice(capaIndex, 1);
  }

  // Remover del array de antenas
  listaAntenas.splice(indice, 1);

  // Recalcular índices en capasEnMapa
  capasEnMapa.forEach((capa, i) => {
    if (capa.indice > indice) {
      capa.indice--;
    }
  });

  // Cerrar el popup
  mapa.closePopup();

  actualizarContador();
  mostrarToast(`🗑 Antena "${antena.nombre}" eliminada`, 'success');
}

/* ================================================
   AÑADIR O ACTUALIZAR ANTENA AL MAPA
================================================ */

/**
 * Manejador del botón "Añadir Antena al Mapa" o "Actualizar Antena".
 * Lee el formulario, valida, dibuja/actualiza la antena y limpia el formulario.
 */
function agregarOActualizarAntena() {
  const antena = leerFormulario();
  if (!antena) return;                // Validación fallida → salir

  if (indiceEnEdicion !== -1) {
    // MODO EDICIÓN: actualizar antena existente
    const antenaPrevio = listaAntenas[indiceEnEdicion];
    listaAntenas[indiceEnEdicion] = antena;

    // Encontrar y remover las capas antiguas del mapa
    const capaIndex = capasEnMapa.findIndex(c => c.indice === indiceEnEdicion);
    if (capaIndex !== -1) {
      const { marcador, circulo } = capasEnMapa[capaIndex];
      mapa.removeLayer(marcador);
      mapa.removeLayer(circulo);
      capasEnMapa.splice(capaIndex, 1);
    }

    // Dibujar las capas nuevas con los datos actualizados
    dibujarAntenaEnMapa(antena, indiceEnEdicion);
    mostrarToast(`✓ Antena "${antena.nombre}" actualizada`, 'success');
  } else {
    // MODO CREACIÓN: agregar nueva antena
    const nuevoIndice = listaAntenas.length;
    listaAntenas.push(antena);
    dibujarAntenaEnMapa(antena, nuevoIndice);
    mostrarToast(`✓ Antena "${antena.nombre}" añadida`, 'success');
  }

  limpiarFormulario();
  actualizarContador();
}

/* ================================================
   EXPORTAR A JSON
================================================ */

/**
 * Exporta el array de antenas actual a un archivo JSON descargable.
 */
function exportarJSON() {
  if (listaAntenas.length === 0) {
    mostrarToast('⚠ No hay antenas para exportar', 'warning');
    return;
  }

  // Crear el objeto JSON (stringificado con indentación)
  const contenido = JSON.stringify(listaAntenas, null, 2);
  const blob = new Blob([contenido], { type: 'application/json' });

  // Crear un enlace temporal de descarga
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `antenas_${new Date().toISOString().split('T')[0]}.json`;

  // Disparar la descarga y liberar recursos
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);

  mostrarToast(`✓ ${listaAntenas.length} antenas exportadas`, 'success');
}

/* ================================================
   CARGAR DESDE JSON
================================================ */

/**
 * Lee un archivo JSON de antenas y lo carga en el mapa.
 * @param {Event} evento - El evento change del input de archivo
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
      datos.forEach((antena, indice) => {
        listaAntenas.push(antena);
        dibujarAntenaEnMapa(antena, indice);
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
 * @param {'success'|'error'|'info'|'warning'} tipo - Variante visual
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
  // Botón "Añadir/Actualizar Antena al Mapa"
  document.getElementById('btn-agregar').addEventListener('click', agregarOActualizarAntena);

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