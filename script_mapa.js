document.addEventListener('DOMContentLoaded', function () {
    const initialCoordinates = [-62.7588, -37.1789]; // Carhué [LONGITUD, LATITUD] para MapLibre
    const initialZoom = 14;
    let activeMarker = null;
    let map;

    // --- ELEMENTOS DEL DOM (CACHEADOS) ---
    const searchPanel = document.querySelector('.search-panel');
    const searchInput = document.getElementById('search-input');
    const searchResultsEl = document.getElementById('search-results');
    const infoPanel = document.getElementById('info-panel');
    const siteNameEl = document.getElementById('site-name');
    const siteImageEl = document.getElementById('site-image');
    const siteTypeEl = document.getElementById('site-type');
    const siteContactEl = document.getElementById('site-contact');
    const siteHoursEl = document.getElementById('site-hours');
    const siteDescriptionEl = document.getElementById('site-description');
    const reviewsListEl = document.getElementById('reviews-list');
    const reviewForm = document.getElementById('review-form');
    const currentSiteIdInput = document.getElementById('current-site-id');
    const closePanelBtn = document.getElementById('close-panel-btn');
    const locateMeButton = document.getElementById('fab-locate-me');
    const toggleSearchBtn = document.getElementById('toggle-search-btn');
    const estadoRutaEl = document.getElementById('estadoRuta');
    const rutaAutoBtn = document.getElementById('rutaAuto');

    // --- DATOS Y ESTADO ---
    let sitesData = [];
    let allReviews = {};
    let markers = {}; // Objeto para guardar los marcadores de MapLibre
    let selectedDestinationCoords = null;
    let userCurrentCoords = null; // Guardará [lon, lat]
    let myLocationMarker = null;
    let locationWatchId = null;
    let marcadorDeRutaVisible = null;
    let directionsControl = null;
    let isFollowing = false;
    // --- VARIABLES Y FUNCIONES PARA SÍNTESIS DE VOZ ---
    let speechSynth = null;
    let spanishVoice = null;
    let routeInstructions = [];

    function inicializarVoz() {
        if (!('speechSynthesis' in window)) {
            console.warn("API de Síntesis de Voz no disponible.");
            return;
        };
        speechSynth = window.speechSynthesis;
        // Precarga de voces para algunos navegadores
        const dummy = new SpeechSynthesisUtterance('');
        dummy.lang = 'es-ES';
        speechSynth.speak(dummy);
    }

    function speakInstruction(text) {
        if (!speechSynth) {
            console.warn("Síntesis de Voz no inicializada.");
            return;
        }
        if (speechSynth.speaking) {
            speechSynth.cancel();
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        if (spanishVoice) {
            utterance.voice = spanishVoice;
        }
        utterance.onerror = (event) => console.error('Error en la síntesis de voz:', event.error);
        speechSynth.speak(utterance);
    }

    function traducirInstruccion(texto) {
        if (!texto || typeof texto !== 'string') return texto;
        return texto
            .replace(/^Head northwest\b/i, "Dirígete hacia el noroeste")
            .replace(/^Head northeast\b/i, "Dirígete hacia el noreste")
            .replace(/^Head southwest\b/i, "Dirígete hacia el suroeste")
            .replace(/^Head southeast\b/i, "Dirígete hacia el sureste")
            .replace(/^Head north\b/i, "Dirígete hacia el norte")
            .replace(/^Head south\b/i, "Dirígete hacia el sur")
            .replace(/^Head east\b/i, "Dirígete hacia el este")
            .replace(/^Head west\b/i, "Dirígete hacia el oeste")
            .replace(/^Turn right onto (.+)/i, "Gira a la derecha hacia $1")
            .replace(/^Turn left onto (.+)/i, "Gira a la izquierda hacia $1")
            .replace(/^Turn right\b/i, "Gira a la derecha")
            .replace(/^Turn left\b/i, "Gira a la izquierda")
            .replace(/^Make a sharp right\b/i, "Gira cerradamente a la derecha")
            .replace(/^Make a sharp left\b/i, "Gira cerradamente a la izquierda")
            .replace(/^Make a slight right\b/i, "Gira levemente a la derecha")
            .replace(/^Make a slight left\b/i, "Gira levemente a la izquierda")
            .replace(/^Continue straight\b/i, "Continúa recto")
            .replace(/^Continue on (.+)/i, "Continúa por $1")
            .replace(/^Continue\b/i, "Continúa")
            .replace(/^Keep right\b/i, "Mantente a la derecha")
            .replace(/^Keep left\b/i, "Mantente a la izquierda")
            .replace(/^You have arrived at your destination\b/i, "Has llegado a tu destino")
            .replace(/^Make a U-turn\b/i, "Haz un giro en U");
    }

    window.speechSynthesis.onvoiceschanged = () => {
        speechSynth = window.speechSynthesis;
        const voices = speechSynth.getVoices();
        spanishVoice = voices.find(v => v.lang === 'es-ES' && v.name.includes('Google')) ||
                       voices.find(v => v.lang === 'es-ES' && v.name.includes('Microsoft')) ||
                       voices.find(v => v.lang === 'es-ES') ||
                       voices.find(v => v.lang.startsWith('es'));
        if (spanishVoice) {
            console.log("Voz en español seleccionada:", spanishVoice.name);
        } else {
            console.warn("No se encontró una voz en español.");
        }
    };

    // --- INICIALIZACIÓN ---
    function init() {
        loadSitesData();
        loadReviews();
        initMap();
        setupEventListeners();
        renderSearchResults(sitesData);
        hideInfoPanel();
        hideSearchPanel();
        requestUserLocationOnce();
    }

    function loadSitesData() {
        sitesData = [
             { id: 'ruinasEpecuen', name: 'Ruinas de Villa Epecuén', type: 'Atracción Turística', coordinates: [-62.8080, -37.1335], description: 'Impresionantes ruinas...', image: 'imagenes/epecuen.jpg', contact: 'No aplica', hours: 'Abierto siempre' },
             { id: 'playaEcoSustentable', name: 'Playa Eco Sustentable', type: 'Atracción Turística', coordinates: [-62.795155, -37.139138], description: 'Espacio recreativo...', image: 'imagenes/ecoplaya.jpg', contact: 'Consultar', hours: 'Abierto siempre' },
             { id: 'museoRegionalCarhue', name: 'Museo Regional Adolfo Alsina', type: 'Cultura y Ocio', coordinates: [-62.761820, -37.180942], description: 'Conserva la historia...', image: 'imagenes/museo.jpg', contact: '(02936) 43-0660', hours: 'Ver horarios' },
             { id: 'cine', name: 'Cine Carhué', type: 'Cultura y Ocio', coordinates: [-62.760505, -37.178898], description: 'Cine local...', image: 'imagenes/cine.jpg', contact: 'Consultar', hours: 'Ver programación' },
             { id: 'panaderiaMiSueño', name: 'Panaderia Mi Sueño', type: 'Gastronomía', coordinates: [-62.756694, -37.176980], description: 'Panaderia tradicional...', image: 'imagenes/panaderia_misueno.jpg', contact: 'Consultar', hours: '7-13hs, 16-20hs' },
             { id: 'amoratacafe', name: 'Amorata Café', type: 'Gastronomía', coordinates: [-62.760814, -37.179045], description: 'Cafetería acogedora...', image: 'imagenes/amoratacarhue.webp', contact: 'Consultar', hours: 'Ver horarios' },
             { id: 'lataperacafe', name: 'La Taperacafé', type: 'Gastronomía', coordinates: [-62.757273, -37.178711], description: 'Cafetería relajada...', image: 'imagenes/latapera.jpg', contact: '(02923) 48-7502', hours: 'Ver horarios' },
             { id: 'hotelCarhue', name: 'Gran Hotel Carhué', type: 'Alojamiento', coordinates: [-62.758782, -37.180358], description: 'Alojamiento céntrico...', image: 'imagenes/granhotel.jpg', contact: '(02936) 43-0440', hours: 'Recepción 24hs' },
             { id: 'farmaciaDiaz', name: 'Farmacia Díaz', type: 'Salud y Servicios', coordinates: [-62.754341, -37.177378], description: 'Farmacia tradicional...', image: 'imagenes/farmaciadiaz.jpg', contact: '(02936) 41-0287', hours: 'Ver horarios de turno' },
             { id: 'farmaciasarsur', name: 'Farmacia Sar Sur', type: 'Salud y Servicios', coordinates: [-62.751857, -37.178973], description: 'Farmacia con atención...', image: 'imagenes/farmaciasarsur.jpeg', contact: '(02936) 41-2231', hours: 'Ver horarios de turno' },
             { id: 'farmaciadecarhue', name: 'Farmacia de Carhué', type: 'Salud y Servicios', coordinates: [-62.760849, -37.181812], description: 'Farmacia tradicional...', image: 'imagenes/farmaciacarhue.jpg', contact: '(02936) 43-2662', hours: 'Ver horarios de turno' },
             { id: 'farmaciaportela', name: 'Farmacia Portela', type: 'Salud y Servicios', coordinates: [-62.757621, -37.178410], description: 'Farmacia moderna...', image: 'imagenes/farmaciaportela.jpg', contact: 'Consultar', hours: 'Ver horarios de turno' },
             { id: 'hospital', name: 'Hospital Municipal San Martín', type: 'Salud y Servicios', coordinates: [-62.749849, -37.177169], description: 'Centro de salud...', image: 'imagenes/hospitalcarhue.jpg', contact: '(02936) 43-2222', hours: 'Emergencias 24hs' },
             { id: 'consultorio', name: 'Consultorio Médico Urquiza', type: 'Salud y Servicios', coordinates: [-62.763827, -37.175853], description: 'Consultorio médico...', image: 'imagenes/consultorioUrquiza.jpg', contact: '(02923) 69-8097', hours: 'Ver horarios' },
        ];
    }

    function loadReviews() {
        try {
            const storedReviews = localStorage.getItem('siteReviews');
            allReviews = storedReviews ? JSON.parse(storedReviews) : {};
        } catch (error) {
            console.error("Error al cargar reseñas:", error);
            allReviews = {};
        }
    }

    function saveReviews() {
        try {
            localStorage.setItem('siteReviews', JSON.stringify(allReviews));
        } catch (error) {
            console.error("Error al guardar reseñas:", error);
        }
    }

    function initMap() {
        const apiKey = '7kWbCoztWq2DGLp4Mwsm'; // Tu clave de API de MapTiler
        const styleUrl = `https://api.maptiler.com/maps/streets-v2/style.json?key=${apiKey}`;

        map = new maplibregl.Map({
            container: 'map',
            style: styleUrl,
            center: initialCoordinates,
            zoom: initialZoom,
            pitch: 0,
            bearing: 0
        });

        // ✅ Control de navegación sin opción de cambio de capa (satélite)
        map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
        const mapboxAccessToken = 'pk.eyJ1IjoiaXJyZWJlbGRlIiwiYSI6ImNtZGpnM2Z5dDBtNWcya3B3bGVmbXl5eTEifQ.C4cj0wOtX3bBCZLs5Opr4g';

    // CÓDIGO CORREGIDO
directionsControl = new MapboxDirections({
    accessToken: mapboxAccessToken,
    unit: 'metric',
    profile: 'mapbox/driving-traffic',
    language: 'es',
    interactive: false, // <-- LA CLAVE: Desactiva la detección del ratón.
    controls: {
        instructions: false, // Oculta las instrucciones de texto, ya que las manejas tú.
        profileSwitcher: false, // Oculta el selector de perfil (auto/bici/caminando).
        inputs: false // Oculta los campos de origen/destino.
    }
});

    map.addControl(directionsControl, 'top-left');
    
    directionsControl.on('route', (e) => {
    // Una vez que la ruta está lista, esperamos un instante.
    setTimeout(() => {
        if (userCurrentCoords) {
            
            // --- 1. Lógica de la cámara ---
            map.flyTo({
                center: userCurrentCoords,
                zoom: 17,
                pitch: 60,
                bearing: 0,
                duration: 2000
            });
            isFollowing = true;
            updateRouteStatus('Ruta lista. ¡En camino!', 'success');
            console.log("Modo seguimiento activado por el evento 'route'.");

            // --- 2. Lógica de voz ---
            if (e.route && e.route.length > 0) {
                const firstRoute = e.route[0];
                if (firstRoute.legs && firstRoute.legs[0].steps && firstRoute.legs[0].steps.length > 0) {
                    const primeraInstruccionEnIngles = firstRoute.legs[0].steps[0].maneuver.instruction;
                    const primeraInstruccionTraducida = traducirInstruccion(primeraInstruccionEnIngles);
                    console.log("Próxima instrucción (traducida):", primeraInstruccionTraducida);
                    speakInstruction(primeraInstruccionTraducida);
                }
            }

            // ✅ --- 3. OCULTAR PANEL DE INSTRUCCIONES (NUEVO) ---
            // Buscamos el panel de direcciones por su clase CSS.
            const directionsPanel = document.querySelector('.mapboxgl-ctrl-directions');
            if (directionsPanel) {
                // Si lo encontramos, lo ocultamos.
                directionsPanel.style.display = 'none';
                console.log('Panel de instrucciones de ruta oculto.');
            }
        }
    }, 100); 
});
        // Se añaden los marcadores al mapa
        sitesData.forEach(addMarkerForSite);
    }

    function setupEventListeners() {
        if (closePanelBtn) closePanelBtn.addEventListener('click', hideInfoPanel);
        if (reviewForm) reviewForm.addEventListener('submit', handleReviewSubmit);
        if (searchInput) searchInput.addEventListener('input', handleSearchInput);
        
        if (toggleSearchBtn) {
            toggleSearchBtn.addEventListener('click', () => {
                searchPanel.classList.toggle('active');
                if (searchPanel.classList.contains('active')) {
                    hideInfoPanel();
                }
            });
        }
        map.on('dragstart', () => {
        if (isFollowing) {
            isFollowing = false;
            console.log("Modo seguimiento desactivado por el usuario.");
            updateRouteStatus('Seguimiento manual. Presiona el botón de ubicación para volver a centrar.', 'info');
        }
    });
        if (locateMeButton) {
            locateMeButton.addEventListener('click', function() {
                hideInfoPanel();
                hideSearchPanel();
                startWatchingUserLocation();
            });
        }
        
        map.on('click', () => {
            hideInfoPanel();
            hideSearchPanel();
        });

        if (rutaAutoBtn) {
            rutaAutoBtn.addEventListener('click', () => {
                // ✅ NUEVO: Oculta el panel de información al hacer clic.
                hideInfoPanel();

                // Llama a las funciones que ya tenías para iniciar la ruta y la voz.
                inicializarVoz();
                mostrarRuta();
            });
        }
        
        window.addEventListener('beforeunload', () => {
            if (locationWatchId) {
                navigator.geolocation.clearWatch(locationWatchId);
            }
        });
    }

    // ✅ CORREGIDO: Añadir marcadores usando MapLibre
    // VERSIÓN CORRECTA (los marcadores se crean pero quedan ocultos)
function addMarkerForSite(site) {
    if (!site.coordinates || site.coordinates.length !== 2) {
        console.warn(`Sitio "${site.name}" no tiene coordenadas válidas.`);
        return;
    }

    // Se crea el marcador pero NO se añade al mapa.
    const marker = new maplibregl.Marker({ color: '#3FB1CE' })
        .setLngLat(site.coordinates);

    marker.getElement().addEventListener('click', (e) => {
        e.stopPropagation();
        selectSiteFromMarker(site);
    });

    // Solo lo guardamos en nuestro objeto de marcadores
    markers[site.id] = marker;
}

    function hideInfoPanel() {
        infoPanel.classList.add('hidden');
        infoPanel.setAttribute('aria-hidden', 'true');
        unhighlightActiveMarker();
        updateActiveSearchResult(null);

        if (marcadorDeRutaVisible) {
        marcadorDeRutaVisible.remove();
        marcadorDeRutaVisible = null;
    }
        map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
    }

    function showSearchPanel() { if (searchPanel) searchPanel.classList.add('active'); }
    function hideSearchPanel() { if (searchPanel) searchPanel.classList.remove('active'); }

    function displaySiteInfo(site) {
        siteNameEl.textContent = site.name;
        siteImageEl.src = site.image || 'imagenes/placeholder.png';
        siteImageEl.alt = `Imagen de ${site.name}`;
        siteTypeEl.textContent = site.type || 'No especificado';
        siteContactEl.textContent = site.contact || 'No disponible';
        siteHoursEl.textContent = site.hours || 'Consultar';
        siteDescriptionEl.innerHTML = site.description ? escapeHTML(site.description).replace(/\n/g, '<br>') : 'Descripción no disponible.';
        
        currentSiteIdInput.value = site.id;
        displayReviews(site.id);
        
        infoPanel.classList.remove('hidden');
        infoPanel.setAttribute('aria-hidden', 'false');

        selectedDestinationCoords = site.coordinates; // [lon, lat]
        updateRouteStatus('Destino seleccionado. Calcula la ruta o busca tu ubicación.', 'info');
        
        highlightMarker(site.id);
        updateActiveSearchResult(site.id);
    }

    // ✅ CORREGIDO: Resaltar marcador con MapLibre
    function highlightMarker(siteId) {
        unhighlightActiveMarker();
        if (markers[siteId]) {
            activeMarker = markers[siteId];
            activeMarker.remove(); // Quitar el marcador actual
            activeMarker = new maplibregl.Marker({ color: '#3498db' }) // Crear uno nuevo con color azul
                .setLngLat(markers[siteId].getLngLat())
                .addTo(map);
            activeMarker.getElement().addEventListener('click', (e) => {
                e.stopPropagation();
                selectSiteFromMarker(sitesData.find(s => s.id === siteId));
            });
        }
    }

    // ✅ CORREGIDO: Quitar resaltado del marcador
    function unhighlightActiveMarker() {
        if (activeMarker) {
            const siteId = currentSiteIdInput.value;
            const originalCoords = activeMarker.getLngLat();
            activeMarker.remove(); // Quita el marcador resaltado
            
            // Re-crea el marcador original
            if (markers[siteId]) {
                 const site = sitesData.find(s => s.id === siteId);
                 addMarkerForSite(site);
            }
            activeMarker = null;
        }
    }

    function handleSearchInput() {
        const searchTerm = quitarTildes(searchInput.value.toLowerCase().trim());
        const filteredSites = searchTerm === "" ? sitesData : sitesData.filter(site => 
            quitarTildes((site.name || '').toLowerCase()).includes(searchTerm) || 
            quitarTildes((site.type || '').toLowerCase()).includes(searchTerm)
        );
        renderSearchResults(filteredSites);
    }

    function renderSearchResults(results) {
        searchResultsEl.innerHTML = '';
        if (results.length === 0) {
            searchResultsEl.innerHTML = '<p class="no-results">No se encontraron resultados.</p>';
            return;
        }
        
        const sitesByCategory = results.reduce((acc, site) => {
            const category = site.type || 'Otros';
            if (!acc[category]) acc[category] = [];
            acc[category].push(site);
            return acc;
        }, {});

        const sortedCategories = Object.keys(sitesByCategory).sort();

        sortedCategories.forEach(category => {
            const details = document.createElement('details');
            details.className = 'category-group';
            details.open = true;
            const summary = document.createElement('summary');
            summary.textContent = category;
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'category-content';
            const ul = document.createElement('ul');
            sitesByCategory[category].forEach(site => {
                const li = document.createElement('li');
                li.textContent = site.name;
                li.dataset.siteId = site.id;
                li.setAttribute('role', 'button');
                li.tabIndex = 0;
                li.addEventListener('click', () => selectSiteFromSearch(site));
                li.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') selectSiteFromSearch(site);
                });
                ul.appendChild(li);
            });
            contentWrapper.appendChild(ul);
            details.appendChild(summary);
            details.appendChild(contentWrapper);
            searchResultsEl.appendChild(details);
        });
    }

    function selectSiteFromSearch(site) {
        hideSearchPanel();
        map.flyTo({
            center: site.coordinates,
            zoom: Math.max(map.getZoom(), 17)
        });
        displaySiteInfo(site);
    }

    function selectSiteFromMarker(site) {
        hideSearchPanel();
        displaySiteInfo(site);
    }

    function updateActiveSearchResult(activeSiteId) {
        document.querySelectorAll('#search-results li').forEach(li => {
            li.classList.toggle('active', li.dataset.siteId === activeSiteId);
        });
    }

    function handleReviewSubmit(event) {
        event.preventDefault();
        const siteId = currentSiteIdInput.value;
        const reviewerName = document.getElementById('reviewer-name').value.trim();
        const reviewRatingInput = document.getElementById('review-rating');
        const reviewRating = parseInt(reviewRatingInput.value);
        const reviewComment = document.getElementById('review-comment').value.trim();

        if (!siteId || !reviewerName || !reviewRatingInput.value || !reviewComment) {
            alert('Por favor, completa todos los campos de la reseña.');
            return;
        }
        const newReview = { name: reviewerName, rating: reviewRating, comment: reviewComment, timestamp: new Date().toISOString() };
        if (!allReviews[siteId]) allReviews[siteId] = [];
        allReviews[siteId].unshift(newReview);
        saveReviews();
        displayReviews(siteId);
        reviewForm.reset();
        reviewRatingInput.value = "";
    }

    function displayReviews(siteId) {
        reviewsListEl.innerHTML = '';
        const siteReviews = allReviews[siteId] || [];
        if (siteReviews.length === 0) {
            reviewsListEl.innerHTML = '<p class="no-reviews-message">Aún no hay reseñas. ¡Sé el primero!</p>';
            return;
        }
        siteReviews.forEach(review => {
            const reviewItem = document.createElement('div');
            reviewItem.classList.add('review-item');
            const ratingStars = '<span class="review-stars">' + '★'.repeat(review.rating) + '</span>' + '☆'.repeat(5 - review.rating);
            reviewItem.innerHTML = `<p><strong>${escapeHTML(review.name)}</strong> - ${ratingStars}</p><p>${escapeHTML(review.comment)}</p><small>${new Date(review.timestamp).toLocaleDateString('es-ES')}</small>`;
            reviewsListEl.appendChild(reviewItem);
        });
    }

    function requestUserLocationOnce() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                const err = new Error("Geolocalización no soportada.");
                handleLocationError({ code: -1, message: err.message });
                return reject(err);
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    updateUserPositionOnMap(position);
                    resolve(position);
                },
                (error) => {
                    handleLocationError(error);
                    reject(error);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        });
    }

    function startWatchingUserLocation() {
        if (locationWatchId) {
            navigator.geolocation.clearWatch(locationWatchId);
            locationWatchId = null;
            updateRouteStatus('Seguimiento detenido.', 'info');
            return;
        }
        if (!navigator.geolocation) {
            return handleLocationError({ code: -1, message: "Geolocalización no soportada." });
        }
        updateRouteStatus('Iniciando seguimiento...', 'loading');
        locationWatchId = navigator.geolocation.watchPosition(updateUserPositionOnMap, handleLocationError, {
            enableHighAccuracy: true, timeout: 10000, maximumAge: 0
        });
    }
    
    // ✅ CORREGIDO: Actualizar posición del usuario con MapLibre
    function updateUserPositionOnMap(position) {
        const { latitude: lat, longitude: lon } = position.coords;
        userCurrentCoords = [lon, lat]; // [lon, lat]

        if (!myLocationMarker) {
            const el = document.createElement('div');
            el.className = 'user-location-marker'; // Se necesita CSS para estilizarlo

            myLocationMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat(userCurrentCoords)
                .addTo(map);
            map.flyTo({ center: userCurrentCoords, zoom: 16 });
        } else {
            myLocationMarker.setLngLat(userCurrentCoords);
        }
        if (isFollowing) {
        map.panTo(userCurrentCoords);
    }
        updateRouteStatus('Ubicación actualizada.', 'success');
    }

    function handleLocationError(error) {
        let msg = "Error de ubicación: ";
        switch(error.code) {
            case error.PERMISSION_DENIED: msg += "Permiso denegado."; break;
            case error.POSITION_UNAVAILABLE: msg += "Ubicación no disponible."; break;
            case error.TIMEOUT: msg += "La solicitud ha caducado."; break;
            default: msg = error.message || "Un error desconocido ha ocurrido."; break;
        }
        alert(msg);
        console.error("Error de Geolocalización:", error);
        updateRouteStatus(msg, 'error');
        if (locationWatchId) {
            navigator.geolocation.clearWatch(locationWatchId);
            locationWatchId = null;
        }
    }

    async function mostrarRuta() {
    // Limpia marcadores anteriores y valida que haya un destino
    if (marcadorDeRutaVisible) { marcadorDeRutaVisible.remove(); }
    const destinationSiteId = currentSiteIdInput.value;
    if (!destinationSiteId) {
        alert("Primero selecciona un destino en el panel.");
        return;
    }
    const marcadorDestino = markers[destinationSiteId];
    if (marcadorDestino) {
        marcadorDestino.addTo(map);
        marcadorDeRutaVisible = marcadorDestino;
    }

    inicializarVoz();

    try {
        // Pide la ubicación actual del usuario si no la tenemos.
        if (!userCurrentCoords) {
            updateRouteStatus('Buscando tu ubicación...', 'loading');
            await requestUserLocationOnce();
        }
        if (!userCurrentCoords) {
            updateRouteStatus('No se pudo obtener tu ubicación.', 'error');
            return;
        }

        // Obtenemos las coordenadas del destino.
        const destinationSite = sitesData.find(site => site.id === destinationSiteId);
        const destinationCoords = destinationSite.coordinates;

        // ✅ SIMPLIFICADO: Solo establecemos el origen y el destino.
        // La animación ahora la maneja el evento 'route'.
        updateRouteStatus('Calculando ruta...', 'loading');
        directionsControl.removeRoutes();
        directionsControl.setOrigin(userCurrentCoords);
        directionsControl.setDestination(destinationCoords);

    } catch (error) {
        console.error("Error al preparar la ruta:", error);
        updateRouteStatus('Hubo un error al preparar la ruta.', 'error');
    }
}

    function updateRouteStatus(message, type = 'info') {
        if (!estadoRutaEl) return;
        estadoRutaEl.textContent = message;
        estadoRutaEl.className = 'route-status';
        if (type !== 'clear') estadoRutaEl.classList.add(type);
    }

    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"']/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match]));
    }

    function quitarTildes(texto) {
        if (!texto) return "";
        return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    // Llama a la función de inicialización del script
    init();
});

// Código para iOS sin cambios
const esIOS = /iP(hone|ad|od)/i.test(navigator.userAgent);
if (esIOS) {
    const activarVozBtn = document.getElementById('activarVozIOS');
    if (activarVozBtn) {
        activarVozBtn.style.display = 'block';
        activarVozBtn.addEventListener('click', () => {
            const utterance = new SpeechSynthesisUtterance("Instrucciones por voz activadas");
            utterance.lang = 'es-ES';
            window.speechSynthesis.speak(utterance);
            activarVozBtn.style.display = 'none';
        });
    }
}