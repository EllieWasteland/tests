// Importa las funciones del gestor de datos unificado.
import { getUnifiedData, saveUnifiedData } from './data-manager.js';

document.addEventListener('DOMContentLoaded', () => {

    // --- Selectores de Elementos DOM ---
    const getEl = (id) => document.getElementById(id);
    const DOMElements = {
        body: document.body,
        map: getEl('map'),
        statusOverlay: getEl('status-overlay'),
        statusText: getEl('status-text'),
        recordBtn: getEl('record-btn'),
        recordIcon: getEl('record-icon'),
        statsDisplay: getEl('stats-display'),
        statDistance: getEl('stat-distance'),
        statTime: getEl('stat-time'),
        recenterBtn: getEl('recenter-btn'),
        menuBtn: getEl('menu-btn'),
        sidePanel: getEl('side-panel'),
        closePanelBtn: getEl('close-panel-btn'),
        savedRoutesList: getEl('saved-routes-list'),
        saveModal: getEl('save-modal'),
        routeNameInput: getEl('route-name-input'),
        discardBtn: getEl('discard-btn'),
        saveRouteBtn: getEl('save-route-btn'),
        backToTrackingBtn: getEl('back-to-tracking-btn'),
        routeStatsPanel: getEl('route-stats-panel'),
        statsPanelName: getEl('stats-panel-name'),
        statsPanelDist: getEl('stats-panel-dist'),
        statsPanelTime: getEl('stats-panel-time'),
        statsPanelDate: getEl('stats-panel-date'),
        themeSelector: getEl('theme-selector'),
        clockDisplay: getEl('clock-display'),
        exportRoutesBtn: getEl('export-routes-btn'),
        importRoutesBtn: getEl('import-routes-btn'),
        downloadMapBtn: getEl('download-map-btn'),
        importFileInput: getEl('import-file-input'),
        offlineModeIndicator: getEl('offline-mode-indicator'),
    };

    // --- Estado de la Aplicación ---
    let map;
    let userMarker;
    let watchId;
    let lastKnownPosition = null;
    let isRecording = false;
    let currentPath = [];
    let recordingStartTime;
    let statsInterval;
    let wakeLock = null;
    let db; // Variable para la base de datos IndexedDB

    // --- MEJORA: Estilos de mapa dedicados para claro y oscuro ---
    const lightStyle = {
        'version': 8,
        'sources': {
            'osm': {
                'type': 'raster',
                'tiles': ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
                'tileSize': 256,
                'attribution': '&copy; OpenStreetMap'
            }
        },
        'layers': [{ 'id': 'osm', 'type': 'raster', 'source': 'osm' }]
    };

    const darkStyle = {
        'version': 8,
        'sources': {
            'carto-dark': {
                'type': 'raster',
                'tiles': [
                    'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                    'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                    'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
                ],
                'tileSize': 256,
                'attribution': '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            }
        },
        'layers': [{
            'id': 'carto-dark-layer',
            'type': 'raster',
            'source': 'carto-dark'
        }]
    };

    const mapStyles = {
        dark: darkStyle,
        light: lightStyle,
        black: darkStyle // El tema 'Negro' también usará el mapa oscuro
    };

    // --- Módulo de Gestión de Datos ---
    const appDataManager = {
        getRoutes: () => getUnifiedData().myRoute.routes || [],
        getSettings: () => getUnifiedData().myRoute.settings || { mapStyle: 'dark', isOfflineMode: false },
        saveAllRoutes: (routes) => {
            const unifiedData = getUnifiedData();
            if (!unifiedData.myRoute) unifiedData.myRoute = {};
            unifiedData.myRoute.routes = routes;
            saveUnifiedData(unifiedData);
        },
        saveRoute: (name, path, startTime) => {
            const unifiedData = getUnifiedData();
            if (!unifiedData.myRoute) unifiedData.myRoute = { routes: [], settings: { mapStyle: 'dark', isOfflineMode: false }};
            const routeData = { id: Date.now(), name, date: new Date().toISOString(), path, distance: util.calculateDistance(path), durationMs: Date.now() - startTime };
            if (!unifiedData.myRoute.routes) unifiedData.myRoute.routes = [];
            unifiedData.myRoute.routes.unshift(routeData);
            saveUnifiedData(unifiedData);
        },
        deleteRoute: (id) => {
            const unifiedData = getUnifiedData();
            if (!unifiedData.myRoute || !unifiedData.myRoute.routes) return;
            unifiedData.myRoute.routes = unifiedData.myRoute.routes.filter(r => r.id != id);
            saveUnifiedData(unifiedData);
        },
        saveSettings: (settings) => {
            const unifiedData = getUnifiedData();
            if (!unifiedData.myRoute) unifiedData.myRoute = { routes: [], settings: {} };
            unifiedData.myRoute.settings = settings;
            saveUnifiedData(unifiedData);
        }
    };
    
    // --- Lógica para mantener la pantalla despierta (Wake Lock) ---
    const screenWakeLock = {
        request: async () => {
            if ('wakeLock' in navigator) {
                try {
                    wakeLock = await navigator.wakeLock.request('screen');
                    console.log('Wake Lock está activo.');
                    wakeLock.addEventListener('release', () => console.log('Wake Lock fue liberado.'));
                } catch (err) {
                    console.error(`${err.name}, ${err.message}`);
                }
            } else {
                console.warn('Wake Lock API no es soportada en este navegador.');
            }
        },
        handleVisibilityChange: () => {
            if (wakeLock !== null && document.visibilityState === 'visible') {
                screenWakeLock.request();
            }
        }
    };

    // --- Módulo Controlador del Mapa ---
    const mapController = {
        init: (theme) => {
            if (map) return;
            map = new maplibregl.Map({ container: 'map', style: mapStyles[theme], center: [-79.0045, -2.9001], zoom: 13, pitch: 30 });
            map.on('load', () => { mapController.createArrowImage(); mapController.setupLayers(); geolocation.start(); });
            map.on('error', (e) => console.error("Error del mapa:", e));
        },
        createArrowImage: () => {
             const width = 16, height = 16;
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const context = canvas.getContext('2d');
            context.fillStyle = 'white';
            context.beginPath();
            context.moveTo(2, height / 2);
            context.lineTo(width - 2, height / 2);
            context.lineTo(width / 2, 2);
            context.closePath();
            context.fill();
            if (map && !map.hasImage('arrow')) {
                map.addImage('arrow', context.getImageData(0, 0, width, height), { sdf: true });
            }
        },
        setupLayers: () => {
            // --- MEJORA: El color de la línea ahora se adapta al tema ---
            const liveRouteColor = getComputedStyle(document.body).getPropertyValue('--brand-color').trim();
            const brandColor = getComputedStyle(document.body).getPropertyValue('--brand-color').trim();
            const secondaryColor = getComputedStyle(document.body).getPropertyValue('--secondary-color').trim();
            const bgColor = getComputedStyle(document.body).getPropertyValue('--bg-primary').trim();
            
            ['live-route-layer', 'saved-route-arrows', 'saved-route-line', 'saved-route-casing'].forEach(l => map.getLayer(l) && map.removeLayer(l));
            ['live-route-source', 'saved-route-source'].forEach(s => map.getSource(s) && map.removeSource(s));

            map.addSource('live-route-source', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } });
            map.addLayer({ 
                id: 'live-route-layer', 
                type: 'line', 
                source: 'live-route-source', 
                layout: { 'line-join': 'round', 'line-cap': 'round' }, 
                paint: { 
                    'line-color': liveRouteColor, // Usar color dinámico (blanco en oscuro, negro en claro)
                    'line-width': 4 
                } 
            });
            
            map.addSource('saved-route-source', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } });
            map.addLayer({ id: 'saved-route-casing', type: 'line', source: 'saved-route-source', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': bgColor, 'line-width': 7 } });
            map.addLayer({ id: 'saved-route-line', type: 'line', source: 'saved-route-source', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': secondaryColor, 'line-width': 4 } });
            map.addLayer({ id: 'saved-route-arrows', type: 'symbol', source: 'saved-route-source', layout: { 'symbol-placement': 'line', 'symbol-spacing': 100, 'icon-image': 'arrow', 'icon-size': 0.5, 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-rotate': 90, 'icon-rotation-alignment': 'map' }, paint: { 'icon-color': brandColor } });
        },
        drawRoute: (sourceId, path) => {
            if (map && map.getSource(sourceId)) {
                map.getSource(sourceId).setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: path } });
            }
        },
        fitBounds: (path) => {
            if (!path || path.length < 2) return;
            const bounds = path.reduce((b, coord) => b.extend(coord), new maplibregl.LngLatBounds(path[0], path[0]));
            map.fitBounds(bounds, { padding: { top: 120, bottom: 40, left: 40, right: 40 }, duration: 1000 });
        },
        recenter: () => {
            if (lastKnownPosition) {
                map.easeTo({ center: [lastKnownPosition.coords.longitude, lastKnownPosition.coords.latitude], zoom: 16 });
            }
        }
    };

    // --- Módulo de Geolocalización ---
    const geolocation = {
        start: () => {
            if (!navigator.geolocation) {
                ui.updateStatus("Geolocalización no soportada.");
                return;
            }
            if (userMarker) userMarker.remove();
            const markerEl = document.createElement('div');
            markerEl.className = 'user-marker';
            userMarker = new maplibregl.Marker({ element: markerEl }).setLngLat([-79.0045, -2.9001]).addTo(map);
            if (watchId) navigator.geolocation.clearWatch(watchId);
            watchId = navigator.geolocation.watchPosition(geolocation.onSuccess, geolocation.onError, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
        },
        onSuccess: (position) => {
            lastKnownPosition = position;
            const coords = [position.coords.longitude, position.coords.latitude];
            if(userMarker) userMarker.setLngLat(coords);

            if (DOMElements.statusOverlay.style.display !== 'none') {
                DOMElements.statusOverlay.style.display = 'none';
                mapController.recenter();
            }
            if (isRecording) {
                currentPath.push(coords);
                mapController.drawRoute('live-route-source', currentPath);
                map.panTo(coords);
            }
        },
        onError: (error) => {
            ui.updateStatus(`Error de GPS: ${error.message}`);
        }
    };

    // --- Módulo Controlador de UI ---
    const ui = {
        init: () => {
            const settings = appDataManager.getSettings();
            ui.applyTheme(settings.mapStyle);
            if (settings.isOfflineMode) {
                DOMElements.offlineModeIndicator.classList.remove('hidden');
            }
            ui.renderSavedRoutes();
            ui.addEventListeners();
        },
        addEventListeners: () => {
            DOMElements.recordBtn.addEventListener('click', () => { isRecording ? ui.stopRecording() : ui.startRecording(); });
            DOMElements.recenterBtn.addEventListener('click', mapController.recenter);
            DOMElements.menuBtn.addEventListener('click', () => DOMElements.sidePanel.classList.remove('hidden'));
            DOMElements.closePanelBtn.addEventListener('click', () => DOMElements.sidePanel.classList.add('hidden'));
            DOMElements.saveRouteBtn.addEventListener('click', ui.handleSaveRoute);
            DOMElements.discardBtn.addEventListener('click', () => { DOMElements.saveModal.classList.remove('active'); ui.resetRecordingState(); });
            DOMElements.backToTrackingBtn.addEventListener('click', ui.backToTrackingView);
            DOMElements.savedRoutesList.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;
                const id = btn.dataset.id;
                if (btn.classList.contains('view-route-btn')) ui.viewRoute(id);
                if (btn.classList.contains('delete-route-btn')) ui.handleDeleteRoute(id);
            });
            DOMElements.themeSelector.addEventListener('click', (e) => {
                const btn = e.target.closest('button.theme-btn');
                if (btn) ui.applyTheme(btn.dataset.theme);
            });
            DOMElements.exportRoutesBtn.addEventListener('click', dataManagement.exportRoutes);
            DOMElements.importRoutesBtn.addEventListener('click', () => DOMElements.importFileInput.click());
            DOMElements.downloadMapBtn.addEventListener('click', dataManagement.downloadOfflineMapPackage);
            DOMElements.importFileInput.addEventListener('change', dataManagement.importHandler);
        },
        startRecording: () => {
            if (!lastKnownPosition) { alert("Espera a tener una señal de GPS estable."); return; }
            isRecording = true;
            currentPath = [[lastKnownPosition.coords.longitude, lastKnownPosition.coords.latitude]];
            recordingStartTime = Date.now();
            DOMElements.recordIcon.className = 'ph ph-stop text-4xl';
            DOMElements.recordBtn.classList.add('recording-pulse');
            DOMElements.statsDisplay.classList.remove('hidden');
            DOMElements.statsDisplay.classList.add('flex', 'fade-in');
            statsInterval = setInterval(ui.updateStats, 1000);
        },
        stopRecording: () => {
            isRecording = false;
            clearInterval(statsInterval);
            DOMElements.recordIcon.className = 'ph ph-play text-4xl';
            DOMElements.recordBtn.classList.remove('recording-pulse');
            if (currentPath.length < 2) { ui.resetRecordingState(); return; }
            DOMElements.saveModal.classList.add('active');
            DOMElements.routeNameInput.value = `Ruta - ${new Date().toLocaleString('es-ES')}`;
            DOMElements.routeNameInput.focus();
        },
        resetRecordingState: () => {
            currentPath = [];
            mapController.drawRoute('live-route-source', []);
            DOMElements.statsDisplay.classList.add('hidden');
            DOMElements.statsDisplay.classList.remove('flex', 'fade-in');
            DOMElements.statDistance.textContent = "0.00";
            DOMElements.statTime.textContent = "00:00";
        },
        updateStats: () => {
            if (!isRecording) return;
            const elapsedSeconds = Math.floor((Date.now() - recordingStartTime) / 1000);
            const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
            const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
            DOMElements.statTime.textContent = `${minutes}:${seconds}`;
            DOMElements.statDistance.textContent = util.calculateDistance(currentPath).toFixed(2);
        },
        handleSaveRoute: () => {
            const name = DOMElements.routeNameInput.value.trim();
            if (!name) { alert("Por favor, introduce un nombre para la ruta."); return; }
            appDataManager.saveRoute(name, currentPath, recordingStartTime);
            DOMElements.saveModal.classList.remove('active');
            ui.resetRecordingState();
            ui.renderSavedRoutes();
        },
        renderSavedRoutes: () => {
            const routes = appDataManager.getRoutes();
            const listEl = DOMElements.savedRoutesList;
            listEl.innerHTML = '';
            if (routes.length === 0) {
                listEl.innerHTML = `<p class="text-center mt-8" style="color: var(--text-secondary);">No tienes rutas guardadas.</p>`;
                return;
            }
            routes.forEach(route => {
                const el = document.createElement('div');
                el.className = 'p-4 rounded-lg mb-3 fade-in';
                el.style.backgroundColor = 'var(--light-bg)';
                const date = new Date(route.date);
                el.innerHTML = `
                    <p class="font-bold truncate">${route.name}</p>
                    <p class="text-sm" style="color: var(--text-secondary);">${route.distance.toFixed(2)} km - ${date.toLocaleDateString('es-ES')}</p>
                    <div class="mt-3 flex gap-2">
                        <button data-id="${route.id}" class="view-route-btn flex-1 text-sm py-1 px-2 rounded" style="background-color: var(--bg-primary); color: var(--text-primary);">Ver</button>
                        <button data-id="${route.id}" class="delete-route-btn flex-1 text-sm py-1 px-2 rounded" style="background-color: var(--bg-primary); color: var(--text-primary);">Borrar</button>
                    </div>
                `;
                listEl.appendChild(el);
            });
        },
        viewRoute: (id) => {
            const route = appDataManager.getRoutes().find(r => r.id == id);
            if (!route) return;
            DOMElements.sidePanel.classList.add('hidden');
            DOMElements.backToTrackingBtn.classList.remove('hidden');
            DOMElements.statsPanelName.textContent = route.name;
            DOMElements.statsPanelDist.textContent = route.distance.toFixed(2);
            DOMElements.statsPanelTime.textContent = util.formatDuration(route.durationMs);
            DOMElements.statsPanelDate.textContent = new Date(route.date).toLocaleDateString('es-ES');
            DOMElements.routeStatsPanel.classList.remove('hidden');
            DOMElements.routeStatsPanel.classList.add('fade-in');
            mapController.drawRoute('saved-route-source', route.path);
            mapController.fitBounds(route.path);
        },
        handleDeleteRoute: (id) => {
            if (!confirm("¿Estás seguro de que quieres borrar esta ruta?")) return;
            appDataManager.deleteRoute(id);
            ui.renderSavedRoutes();
        },
        backToTrackingView: () => {
            DOMElements.backToTrackingBtn.classList.add('hidden');
            DOMElements.routeStatsPanel.classList.add('hidden');
            DOMElements.routeStatsPanel.classList.remove('fade-in');
            mapController.drawRoute('saved-route-source', []);
            mapController.recenter();
        },
        applyTheme: (theme) => {
            const settings = appDataManager.getSettings();
            settings.mapStyle = theme;
            appDataManager.saveSettings(settings);

            DOMElements.body.className = `theme-${theme} overflow-hidden h-screen flex flex-col`;
            DOMElements.themeSelector.querySelectorAll('.theme-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.theme === theme);
            });

            // --- MEJORA: Cambiar el estilo del mapa dinámicamente ---
            if (map) {
                const newStyle = mapStyles[theme];
                map.setStyle(newStyle);
                
                // 'load' se dispara después de que el nuevo estilo se haya cargado completamente.
                // Es crucial para re-añadir las capas y fuentes personalizadas.
                map.once('load', () => {
                    // Re-inicializar capas y redibujar las rutas existentes
                    mapController.createArrowImage();
                    mapController.setupLayers();
                    
                    if (userMarker) {
                        userMarker.addTo(map);
                    }
                    
                    mapController.drawRoute('live-route-source', currentPath);

                    // Volver a dibujar la ruta guardada si se estaba viendo una
                    const activeRoute = appDataManager.getRoutes().find(r => r.name === DOMElements.statsPanelName.textContent && !DOMElements.routeStatsPanel.classList.contains('hidden'));
                    if (activeRoute) {
                       mapController.drawRoute('saved-route-source', activeRoute.path);
                    }
                });
            }
        },
        updateStatus: (text) => {
            DOMElements.statusText.textContent = text;
            DOMElements.statusOverlay.style.display = 'flex';
        }
    };
    
    // --- Módulo de Gestión de Datos (Exportar/Importar/Descargar Mapa) ---
    const dataManagement = {
        initDB: () => {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open('OfflineMapsDB', 1);
                request.onerror = (event) => reject("Error al abrir IndexedDB");
                request.onsuccess = (event) => {
                    db = event.target.result;
                    resolve(db);
                };
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    db.createObjectStore('map-tiles', { keyPath: 'url' });
                };
            });
        },
        exportRoutes: () => {
            const routes = appDataManager.getRoutes();
            if (routes.length === 0) {
                alert("No hay rutas para exportar.");
                return;
            }
            const data = { type: 'MyRouteRoutes', version: 1, data: routes };
            const dataStr = JSON.stringify(data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mysoul_routes_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },
        importHandler: (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = JSON.parse(e.target.result);
                    if (content.type === 'MyRouteRoutes') {
                        dataManagement.importRoutes(content.data);
                    } else if (content.type === 'MyRouteMapPackage') {
                        dataManagement.importOfflineMapPackage(content);
                    } else {
                        throw new Error("Tipo de archivo no reconocido.");
                    }
                } catch (error) {
                    alert("Error al procesar el archivo: " + error.message);
                    console.error("Error de importación:", error);
                } finally {
                    event.target.value = '';
                }
            };
            reader.readAsText(file);
        },
        importRoutes: (importedRoutes) => {
            if (!Array.isArray(importedRoutes)) throw new Error("El archivo de rutas no es válido.");
            
            const currentRoutes = appDataManager.getRoutes();
            const currentIds = new Set(currentRoutes.map(r => r.id));
            const newRoutes = importedRoutes.filter(r => r && r.id && !currentIds.has(r.id));
            
            if (newRoutes.length === 0) {
                alert("No se encontraron rutas nuevas para importar.");
                return;
            }

            const combinedRoutes = [...currentRoutes, ...newRoutes];
            appDataManager.saveAllRoutes(combinedRoutes);
            ui.renderSavedRoutes();
            alert(`${newRoutes.length} ruta(s) importada(s) con éxito.`);
        },
        downloadOfflineMapPackage: async () => {
            if (!lastKnownPosition) {
                alert("Se necesita tu ubicación actual para descargar el mapa.");
                return;
            }
            ui.updateStatus("Preparando paquete de mapa...");

            const lat = lastKnownPosition.coords.latitude;
            const lon = lastKnownPosition.coords.longitude;
            const sizeKm = 50, minZoom = 10, maxZoom = 15;
            const lat_change = sizeKm / 111.0, lon_change = sizeKm / (111.0 * Math.cos(lat * Math.PI / 180));
            const bounds = { north: lat + lat_change / 2, south: lat - lat_change / 2, east: lon + lon_change / 2, west: lon - lon_change / 2 };

            const tilesToFetch = [];
            for (let z = minZoom; z <= maxZoom; z++) {
                const topLeft = util.deg2num(bounds.north, bounds.west, z);
                const bottomRight = util.deg2num(bounds.south, bounds.east, z);
                for (let x = topLeft.x; x <= bottomRight.x; x++) {
                    for (let y = topLeft.y; y <= bottomRight.y; y++) {
                        tilesToFetch.push(`https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`);
                    }
                }
            }
            
            const uniqueTiles = [...new Set(tilesToFetch)];
            const totalTiles = uniqueTiles.length;
            const mapPackage = { type: 'MyRouteMapPackage', version: 1, tiles: {} };
            let fetchedCount = 0;

            await Promise.all(uniqueTiles.map(async (url) => {
                try {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    mapPackage.tiles[url] = await util.blobToBase64(blob);
                } catch (e) {
                    console.warn(`No se pudo obtener el tile: ${url}`);
                }
                fetchedCount++;
                const progress = Math.round((fetchedCount / totalTiles) * 100);
                ui.updateStatus(`Descargando tiles... ${progress}%`);
            }));

            const dataStr = JSON.stringify(mapPackage);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const fileUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = fileUrl;
            a.download = `mysoul_map_package_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(fileUrl);
            ui.updateStatus("Paquete de mapa descargado.");
            setTimeout(() => DOMElements.statusOverlay.style.display = 'none', 2000);
        },
        importOfflineMapPackage: async (mapPackage) => {
            if (!db) {
                alert("La base de datos no está lista. Intenta de nuevo.");
                return;
            }
            ui.updateStatus("Importando paquete de mapa...");
            const tx = db.transaction('map-tiles', 'readwrite');
            const store = tx.objectStore('map-tiles');
            const tileUrls = Object.keys(mapPackage.tiles);
            let importedCount = 0;

            for (const url of tileUrls) {
                await store.put({ url: url, data: mapPackage.tiles[url] });
                importedCount++;
                const progress = Math.round((importedCount / tileUrls.length) * 100);
                ui.updateStatus(`Guardando tiles... ${progress}%`);
            }

            return new Promise((resolve, reject) => {
                tx.oncomplete = () => {
                    const settings = appDataManager.getSettings();
                    settings.isOfflineMode = true;
                    appDataManager.saveSettings(settings);
                    DOMElements.offlineModeIndicator.classList.remove('hidden');
                    ui.updateStatus("¡Modo Offline Activado!");
                    setTimeout(() => DOMElements.statusOverlay.style.display = 'none', 2000);
                    resolve();
                };
                tx.onerror = (event) => {
                    ui.updateStatus("Error al guardar el mapa.");
                    setTimeout(() => DOMElements.statusOverlay.style.display = 'none', 2000);
                    reject(event.target.error);
                };
            });
        }
    };

    // --- Módulo del Reloj ---
    const clock = {
        init: () => {
            clock.update();
            setInterval(clock.update, 1000);
        },
        update: () => {
            if (DOMElements.clockDisplay) {
                const now = new Date();
                const hours = now.getHours().toString().padStart(2, '0');
                const minutes = now.getMinutes().toString().padStart(2, '0');
                const seconds = now.getSeconds().toString().padStart(2, '0');
                DOMElements.clockDisplay.textContent = `${hours}:${minutes}:${seconds}`;
            }
        }
    };

    // --- Módulo de Funciones de Utilidad ---
    const util = {
        formatDuration: (ms) => {
            if (!ms || ms < 0) return "00:00:00";
            const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        },
        calculateDistance: (coords) => {
            let d = 0; for (let i = 0; i < coords.length - 1; i++) d += util.haversineDistance(coords[i], coords[i + 1]); return d;
        },
        haversineDistance: (c1, c2) => {
            const r = (x) => x * Math.PI / 180, R = 6371, dLat = r(c2[1] - c1[1]), dLon = r(c2[0] - c1[0]);
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(r(c1[1])) * Math.cos(r(c2[1])) * Math.sin(dLon / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        },
        deg2num: (lat_deg, lon_deg, zoom) => {
            const lat_rad = lat_deg * (Math.PI / 180);
            const n = Math.pow(2, zoom);
            const xtile = Math.floor((lon_deg + 180) / 360 * n);
            const ytile = Math.floor((1 - Math.log(Math.tan(lat_rad) + 1 / Math.cos(lat_rad)) / Math.PI) / 2 * n);
            return { x: xtile, y: ytile };
        },
        blobToBase64: (blob) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }
    };

    // --- Inicialización de la Aplicación ---
    async function initializeApp() {
        await dataManagement.initDB();
        ui.init();
        clock.init();
        mapController.init(appDataManager.getSettings().mapStyle);
        screenWakeLock.request();
        document.addEventListener('visibilitychange', screenWakeLock.handleVisibilityChange);
    }

    initializeApp();
});
