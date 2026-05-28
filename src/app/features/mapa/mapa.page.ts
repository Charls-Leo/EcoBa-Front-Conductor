import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { IonicModule, AlertController } from '@ionic/angular';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';
import * as L from 'leaflet';
import { RutaService } from 'src/app/core/services/ruta.service';
import { Ruta, GeoJSONGeometry, LocationData } from 'src/app/core/models';
import { LocationService } from 'src/app/core/services/location.service';
import { TrackingStateService } from 'src/app/core/services/tracking-state.service';
import { TrackingService } from 'src/app/core/services/tracking.service';
import { RecorridoService } from 'src/app/core/services/recorrido.service';
import { CameraService } from 'src/app/core/services/camera.service';
import { ConnectivityService } from 'src/app/core/services/connectivity.service';
import { OfflineQueueService } from 'src/app/core/services/offline-queue.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { WebSocketService } from 'src/app/core/services/websocket.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './mapa.page.html',
  styleUrls: ['./mapa.page.scss']
})
export class MapaPage implements OnDestroy, OnInit {
  private map: L.Map | undefined;
  private tileLayer: L.TileLayer | undefined;
  private mapReady = false;
  private isDrawingRoute = false;
  private resizeListener: (() => void) | null = null; // Para limpiar el listener de window.resize
  private rutasLayer: L.FeatureGroup = L.featureGroup();
  private destroy$ = new Subject<void>();
  private pendingLocation: LocationData | null = null;

  rutas: Ruta[] = [];
  selectedRutaId: string | number | null = null;
  private truckMarker: L.Marker | null = null;
  public isEnRuta = false;
  private officialRouteCoords: L.LatLng[] = [];

  // Marcadores de fotos
  private photoMarkers: { [posicionId: string]: L.Marker } = {};

  // Ruta de acercamiento (OSRM)
  private approachRouteLayer: L.Polyline | null = null;
  private lastLocation: {lat: number, lng: number} | null = null;
  private isFetchingApproachRoute = false;
  private startPointCoords: {lat: number, lng: number} | null = null;
  private lastApproachUpdate = 0;

  // ── Estado de visualización de recorrido externo (colega) ──
  // NO usa trackingState para no bloquear las pantallas de Rutas/Recorridos
  private viewingRecorridoId: string | null = null;
  private viewingPlaca = '';
  private viewingNombreRuta = '';

  // ═══ Estados de los controles del mapa ═══
  isTakingPhoto = false;
  isSendingPhoto = false;
  isFinishing = false;
  isPanelExpanded = false;

  togglePanel() {
    this.isPanelExpanded = !this.isPanelExpanded;
    // El panel inferior cambia la altura del mapa: recalibramos Leaflet
    if (this.map && this.mapReady) {
      setTimeout(() => this.map!.invalidateSize({ animate: false }), 350);
    }
  }

  // ═══ Preview de foto ═══
  photoPreview: string | null = null;
  private photoBase64: string | null = null;
  photoStatusMsg: string | null = null;
  photoStatusSuccess = false;

  constructor(
    private location: Location,
    private router: Router,
    private route: ActivatedRoute,
    private rutaService: RutaService,
    private locationService: LocationService,
    public trackingState: TrackingStateService,
    private trackingService: TrackingService,
    private recorridoService: RecorridoService,
    private cameraService: CameraService,
    private alertCtrl: AlertController,
    public connectivity: ConnectivityService,
    public offlineQueue: OfflineQueueService,
    private authService: AuthService,
    private webSocketService: WebSocketService
  ) {}

  ngOnInit() {
    // Escuchar parámetros para saber si queremos ver una ruta específica
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const rutaId      = params['ruta_id'];
        const recorridoId = params['recorrido_id'];
        const placa       = params['placa'];
        const nombreRuta  = params['nombre_ruta'];

        if (this.trackingState.recorridoActivo) {
          // El conductor tiene su PROPIO recorrido activo — usar ese, ignorar params
          this.selectedRutaId = this.trackingState.rutaActiva || null;
          this.viewingRecorridoId = null; // No estamos viendo a otro
        } else if (recorridoId) {
          // Recorrido externo (colega) — guardar solo en estado LOCAL para no bloquear pantallas
          this.viewingRecorridoId = String(recorridoId);
          this.viewingPlaca       = placa       || '';
          this.viewingNombreRuta  = nombreRuta  || '';
          this.selectedRutaId     = rutaId;
        } else {
          // Solo vista de ruta sin recorrido activo
          this.viewingRecorridoId = null;
          this.selectedRutaId     = rutaId || this.trackingState.rutaActiva || null;
        }
        this.cargarRutas();
      });

    // Escuchar si el recorrido se detiene globalmente para limpiar el mapa al instante
    let lastActiveRecorridoId = this.trackingState.recorridoActivo;
    this.trackingState.recorridoId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(id => {
        // Solo limpiar el mapa si realmente pasó de estar activo a detenerse/finalizar
        if (!id && lastActiveRecorridoId) {
          this.selectedRutaId = null;
          if (this.map) {
            this.rutasLayer.clearLayers();
            if (this.truckMarker) {
              this.truckMarker.remove();
              this.truckMarker = null;
            }
            // Limpiar marcadores de fotos
            Object.keys(this.photoMarkers).forEach(pid => {
              this.photoMarkers[pid].remove();
              delete this.photoMarkers[pid];
            });
          }
        }
        lastActiveRecorridoId = id;
      });

    // Escuchar fotos en tiempo real tomadas por el conductor en recorrido activo
    this.webSocketService.messages$
      .pipe(
        takeUntil(this.destroy$),
        filter(msg => msg.event === 'location:photo')
      )
      .subscribe((msg: any) => {
        const foto = msg.data;
        const recActivo = this.trackingState.recorridoActivo || this.viewingRecorridoId;
        if (foto && this.map && String(foto.recorrido_id) === String(recActivo)) {
          console.log('[MAPA] 📸 Nueva foto recibida por WebSocket:', foto);
          this.agregarMarcadorFoto(
            foto.posicion_id,
            foto.lat,
            foto.lon,
            foto.capturado_ts,
            String(foto.recorrido_id)
          );
        }
      });

    // Escuchar si el recorrido es finalizado por el conductor para limpiar el mapa
    this.webSocketService.messages$
      .pipe(
        takeUntil(this.destroy$),
        filter(msg => msg.event === 'recorrido:finalizado')
      )
      .subscribe((msg: any) => {
        const data = msg.data;
        const recActivo = this.trackingState.recorridoActivo || this.viewingRecorridoId;
        if (data && String(data.recorrido_id) === String(recActivo)) {
          console.log('[MAPA] 🏁 Recorrido finalizado recibido por WebSocket');
          // Limpiar según si era propio o externo
          if (this.trackingState.recorridoActivo) {
            this.trackingState.clear();
          }
          this.viewingRecorridoId = null;
          this.lastLocation = null;
          // Limpiar marcadores del mapa
          if (this.map) {
            this.rutasLayer.clearLayers();
            if (this.truckMarker) { this.truckMarker.remove(); this.truckMarker = null; }
            Object.keys(this.photoMarkers).forEach(pid => {
              this.photoMarkers[pid].remove();
              delete this.photoMarkers[pid];
            });
          }
        }
      });
  }

  ionViewDidEnter() {
    console.log('[MAPA] ionViewDidEnter — map exists?', !!this.map);
    this.mapReady = false;

    // Conectar WebSocket para recibir ubicaciones en tiempo real
    const token = this.authService.getToken();
    if (token) {
      this.webSocketService.connect(token);
    }

    if (!this.map) {
      this.initMap();
      this.escucharUbicacionEnTiempoReal();

      this.resizeListener = () => {
        if (this.map && this.mapReady) {
          setTimeout(() => this.map!.invalidateSize({ animate: false }), 200);
        }
      };
      window.addEventListener('resize', this.resizeListener);
    }

    setTimeout(() => {
      if (!this.map) {
        console.error('[MAPA] ERROR: map is null after 400ms timeout!');
        return;
      }
      const size = this.map.getSize();
      console.log('[MAPA] Before invalidateSize — container size:', size.x, 'x', size.y);
      this.map.invalidateSize({ animate: false });
      const sizeAfter = this.map.getSize();
      console.log('[MAPA] After invalidateSize — container size:', sizeAfter.x, 'x', sizeAfter.y);

      // Si el tamaño antes era 0x0 (Leaflet creó el mapa sin dimensiones),
      // los tiles están posicionados fuera de la vista. Forzamos setView
      // para que Leaflet recalcule posiciones y recargue tiles en el lugar correcto.
      if (size.x === 0 || size.y === 0) {
        console.warn('[MAPA] ⚠️ Tamaño era 0 — forzando setView para reposicionar tiles');
        this.map.setView([3.8801, -77.03116], 14, { animate: false });
      }

      this.mapReady = true;
      console.log('[MAPA] mapReady = true');

      if (this.pendingLocation) {
        const loc = this.pendingLocation;
        this.pendingLocation = null;
        this.procesarUbicacionEnTiempoReal(loc);
      }

      requestAnimationFrame(() => this.dibujarRutas());
    }, 400);
  }

  ionViewWillLeave() {
    this.mapReady = false;
    // Al salir del mapa, limpiar el marcador y estado de visualización externa
    this.viewingRecorridoId = null;
    if (this.truckMarker && !this.trackingState.recorridoActivo) {
      this.truckMarker.remove();
      this.truckMarker = null;
    }
  }

  ngOnDestroy() {
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      this.resizeListener = null;
    }
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════
  // CÁMARA — Tomar foto y enviar a la API
  // ═══════════════════════════════════════════

  async tomarFoto(): Promise<void> {
    if (this.isTakingPhoto) return;
    this.isTakingPhoto = true;
    this.photoStatusMsg = null;

    try {
      const base64 = await this.cameraService.tomarFoto();

      if (base64) {
        // Guardar la foto para preview
        this.photoBase64 = base64;
        // Mostrar preview (asegurar que tenga prefijo para el <img>)
        this.photoPreview = base64.startsWith('data:')
          ? base64
          : `data:image/jpeg;base64,${base64}`;
      }
    } catch (err) {
      console.error('[MapaPage] Error al tomar foto:', err);
      this.photoStatusMsg = 'Error al acceder a la cámara';
      this.photoStatusSuccess = false;
    } finally {
      this.isTakingPhoto = false;
    }
  }

  async enviarFoto(): Promise<void> {
    if (!this.photoBase64 || this.isSendingPhoto) return;

    const recorridoId = this.trackingState.recorridoActivo;
    if (!recorridoId) {
      this.photoStatusMsg = 'No hay recorrido activo';
      this.photoStatusSuccess = false;
      return;
    }

    this.isSendingPhoto = true;
    this.photoStatusMsg = null;

    try {
      // 1. Priorizar la última ubicación del tracking activo (evita esperar 10s de GPS timeout)
      let lat: number | null = null;
      let lon: number | null = null;

      if (this.lastLocation) {
        // Tracking activo: usamos la última posición conocida directamente
        lat = this.lastLocation.lat;
        lon = this.lastLocation.lng;
      } else {
        // No hay tracking activo: intentar GPS en tiempo real (con timeout corto)
        try {
          const ubicacion = await this.locationService.getCurrentPosition();
          if (ubicacion) {
            lat = ubicacion.latitude;
            lon = ubicacion.longitude;
          }
        } catch { /* silencioso */ }
      }

      if (lat === null || lon === null) {
        this.photoStatusMsg = 'No se pudo obtener la ubicación GPS';
        this.photoStatusSuccess = false;
        this.isSendingPhoto = false;
        return;
      }

      // FALLBACK MODO OFFLINE: Si no hay conexión, se guarda la foto localmente en SQLite
      if (!this.connectivity.isOnline) {
        const usuario = this.authService.getUser();
        const perfilId = usuario?.id_usuario || environment.PERFIL_ID;

        await this.offlineQueue.enqueuePhoto({
          recorrido_id: String(recorridoId),
          lat,
          lon,
          perfil_id: String(perfilId),
          imagen_base64: this.photoBase64,
          timestamp: Date.now()
        });

        this.photoStatusMsg = '¡Foto guardada localmente (Modo Offline)! 💾';
        this.photoStatusSuccess = true;

        setTimeout(() => {
          this.cerrarPreview();
        }, 1500);
        return;
      }

      // 2. Registrar posición y obtener posicion_id
      const posResponse = await this.recorridoService
        .registrarPosicion(recorridoId, lat, lon)
        .toPromise();

      const posicionId = posResponse?.data?.id_posiciones ||
                         posResponse?.id_posiciones ||
                         posResponse?.data?.id_posicion || 
                         posResponse?.id_posicion || 
                         posResponse?.data?.id || 
                         posResponse?.id || 
                         posResponse?.data?.posicion_id || 
                         posResponse?.posicion_id;

      if (!posicionId) {
        this.photoStatusMsg = 'No se obtuvo ID de posición';
        this.photoStatusSuccess = false;
        this.isSendingPhoto = false;
        return;
      }

      // 3. Subir imagen asociada a esa posición
      await this.recorridoService
        .subirImagenPosicion(posicionId, this.photoBase64)
        .toPromise();

      this.photoStatusMsg = '¡Foto enviada correctamente!';
      this.photoStatusSuccess = true;

      // Pintar el marcador de la foto localmente de inmediato para feedback instantáneo
      this.agregarMarcadorFoto(posicionId, lat, lon, new Date().toISOString(), String(recorridoId));

      // Cerrar preview después de 1.5s
      setTimeout(() => {
        this.cerrarPreview();
      }, 1500);

    } catch (err: any) {
      console.error('[MapaPage] Error al enviar foto:', err);
      const detailedMsg = err?.error?.message || err?.message || 'Error desconocido';
      const detailJson = err?.error ? JSON.stringify(err.error) : JSON.stringify(err);
      this.photoStatusMsg = `Error: ${detailedMsg} | JSON: ${detailJson}`;
      this.photoStatusSuccess = false;
    } finally {
      this.isSendingPhoto = false;
    }
  }

  descartarFoto(): void {
    this.cerrarPreview();
  }

  cerrarPreview(): void {
    this.photoPreview = null;
    this.photoBase64 = null;
    this.photoStatusMsg = null;
  }

  // ═══════════════════════════════════════════
  // FINALIZAR RECORRIDO desde el mapa
  // ═══════════════════════════════════════════

  async confirmarFinalizarRecorrido(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Finalizar recorrido',
      message: '¿Estás seguro de que deseas finalizar el recorrido actual?',
      cssClass: 'eco-custom-alert',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'eco-btn-cancel'
        },
        {
          text: 'Finalizar',
          role: 'destructive',
          cssClass: 'eco-btn-confirm',
          handler: () => {
            this.finalizarRecorrido();
          }
        }
      ]
    });
    await alert.present();
  }

  private finalizarRecorrido(): void {
    const recId = this.trackingState.recorridoActivo;
    if (!recId || this.isFinishing) return;

    this.isFinishing = true;

    // 1. Finalizar en la BD
    this.recorridoService.finalizarRecorrido(recId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log('[MapaPage] Recorrido finalizado en BD');
          
          // 2. Detener GPS y limpiar estado global
          this.trackingService.stopTracking();
          this.trackingState.clear();

          this.isFinishing = false;

          // 3. Navegar de vuelta a recorridos
          this.router.navigate(['/tabs/recorridos']);
        },
        error: (err) => {
          console.error('[MapaPage] Error al finalizar en BD', err);
          this.isFinishing = false;
        }
      });
  }

  // ═══════════════════════════════════════════
  // MAPA — Inicialización y dibujo
  // ═══════════════════════════════════════════

  private initMap(): void {
    const mapElement = document.getElementById('map');
    console.log('[MAPA] initMap — #map element found?', !!mapElement);
    if (!mapElement) return;

    const rect = mapElement.getBoundingClientRect();
    console.log('[MAPA] initMap — #map rect:', rect.width, 'x', rect.height);

    // Límites geográficos para la ciudad de Buenaventura
    const southWest = L.latLng(3.75, -77.18);
    const northEast = L.latLng(3.98, -76.90);
    const bounds = L.latLngBounds(southWest, northEast);

    this.map = L.map('map', {
      attributionControl: false,
      zoomControl: false,
      minZoom: 12
    }).setView([3.8801, -77.03116], 14);

    // LOG CLAVE: tamaño interno de Leaflet en el momento de creación
    // Si es 0x0, los tiles se posicionan fuera de la vista y no se ven aunque carguen.
    const leafletSize = this.map.getSize();
    console.log('[MAPA] initMap — Leaflet internal size at creation:', leafletSize.x, 'x', leafletSize.y);
    console.log('[MAPA] initMap — Leaflet map created');

    // Evitar que el usuario arrastre el mapa fuera de Buenaventura usando eventos
    this.map.on('drag', () => {
      if (this.map) {
        const center = this.map.getCenter();
        if (!bounds.contains(center)) {
          const lat = Math.max(bounds.getSouth(), Math.min(bounds.getNorth(), center.lat));
          const lng = Math.max(bounds.getWest(), Math.min(bounds.getEast(), center.lng));
          this.map.panTo([lat, lng], { animate: false });
        }
      }
    });

    // Mapa Estándar de Google Maps con logs de eventos de tile
    this.tileLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      minZoom: 12,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '© Google Maps'
    });

    // Eventos de diagnóstico del tile layer
    this.tileLayer.on('loading', () => console.log('[MAPA] tileLayer: descargando tiles...'));
    this.tileLayer.on('load',    () => console.log('[MAPA] tileLayer: TODOS los tiles cargados ✅'));
    this.tileLayer.on('tileload', (e: any) => console.log('[MAPA] tile cargado OK:', e.coords?.z, e.coords?.x, e.coords?.y));
    this.tileLayer.on('tileerror', (e: any) => console.error('[MAPA] ERROR en tile:', e.coords, e.error));
    this.tileLayer.on('remove', () => console.warn('[MAPA] ⚠️ tileLayer fue REMOVIDO del mapa! Stack:', new Error().stack));

    this.tileLayer.addTo(this.map);
    console.log('[MAPA] initMap — tileLayer added to map');

    this.rutasLayer.addTo(this.map);
    console.log('[MAPA] initMap — rutasLayer added to map');
  }

  escucharUbicacionEnTiempoReal() {
    // ── Canal 1: GPS propio del conductor (solo cuando él tiene recorrido activo) ──
    this.locationService.location$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loc => {
        if (!this.map) return;
        // Solo procesar si el conductor ES el dueño del recorrido activo (no visualización externa)
        if (!this.trackingState.recorridoActivo) return;

        if (!this.mapReady) {
          this.pendingLocation = loc;
          return;
        }
        this.procesarUbicacionEnTiempoReal(loc);
      });

    // ── Canal 2: Ubicación en tiempo real de otro conductor vía WebSocket ──
    this.webSocketService.messages$
      .pipe(
        takeUntil(this.destroy$),
        filter(msg => msg.event === 'location:update')
      )
      .subscribe((msg: any) => {
        const data = msg.data;
        // Procesar si coincide con recorrido PROPIO o con recorrido EXTERNO que estamos viendo
        const recObjetivo = this.trackingState.recorridoActivo || this.viewingRecorridoId;
        if (data && data.recorrido_id && String(data.recorrido_id) === String(recObjetivo)) {
          console.log('[MAPA] 📍 Ubicación de conductor recibida por WebSocket:', data);

          if (data.porcentaje_progreso !== undefined && this.trackingState.recorridoActivo) {
            this.trackingState.setProgreso(data.porcentaje_progreso);
          }

          if (data.location) {
            const loc: LocationData = {
              latitude:  Number(data.location.latitude),
              longitude: Number(data.location.longitude),
              timestamp: Number(data.location.timestamp),
              accuracy:  Number(data.location.accuracy  || 0),
              speed:     Number(data.location.speed     || 0),
              heading:   Number(data.location.heading   || 0)
            };

            if (!this.mapReady) {
              this.pendingLocation = loc;
              return;
            }
            this.procesarUbicacionEnTiempoReal(loc);
          }
        }
      });
  }

  private procesarUbicacionEnTiempoReal(loc: LocationData) {
    if (!this.map) return;

    const latlng = L.latLng(loc.latitude, loc.longitude);

    if (!this.truckMarker) {
      const placa      = this.trackingState.vehiculoPlaca || this.viewingPlaca      || undefined;
      const rutaNombre = this.trackingState.nombreRuta    || this.viewingNombreRuta || undefined;

      const truckIcon = L.divIcon({
        html: this.makeTruckPinHtml(placa, rutaNombre, loc.heading || 0),
        className: 'truck-marker-wrapper',
        iconSize: [52, 52],
        iconAnchor: [26, 26]
      });
      this.truckMarker = L.marker(latlng, { 
        icon: truckIcon, 
        zIndexOffset: 1000, 
        interactive: false 
      }).addTo(this.map);
      
      // Si es la primera vez que recibimos la ubicación, centramos el mapa en el conductor (solo si está dentro de Buenaventura)
      const southWest = L.latLng(3.75, -77.18);
      const northEast = L.latLng(3.98, -76.90);
      const bounds = L.latLngBounds(southWest, northEast);

      if (bounds.contains(latlng)) {
        this.map.setView(latlng, 16);
      } else {
        console.warn('[MapaPage] Ubicación inicial de tracking fuera de Buenaventura. Se mantiene vista centrada.');
      }
    } else {
      // Actualizar posición y rotación
      const placa      = this.trackingState.vehiculoPlaca || this.viewingPlaca      || undefined;
      const rutaNombre = this.trackingState.nombreRuta    || this.viewingNombreRuta || undefined;
      
      this.truckMarker.setLatLng(latlng);
      this.truckMarker.setIcon(L.divIcon({
        html: this.makeTruckPinHtml(placa, rutaNombre, loc.heading || 0),
        className: 'truck-marker-wrapper',
        iconSize: [52, 52],
        iconAnchor: [26, 26]
      }));
    }

    this.lastLocation = { lat: loc.latitude, lng: loc.longitude };
    this.isEnRuta = this.checkIfOnRoute(latlng);
    this.verificarRutaDeAcercamiento();
  }

  // ═══════════════════════════════════════════
  // Comprobar si está sobre la ruta oficial
  // ═══════════════════════════════════════════
  private checkIfOnRoute(currentPos: L.LatLng): boolean {
    if (!this.officialRouteCoords || this.officialRouteCoords.length === 0 || !this.map) {
      return false;
    }

    let minDistance = Infinity;
    // Aproximación rápida calculando distancia a cada vértice de la ruta
    for (const point of this.officialRouteCoords) {
      const dist = this.map.distance(currentPos, point);
      if (dist < minDistance) {
        minDistance = dist;
      }
    }
    
    // Si está a menos de 80 metros de la calle oficial, está "En ruta"
    return minDistance <= 80;
  }

  // ═══════════════════════════════════════════
  // Ruta de Acercamiento Automática (OSRM)
  // ═══════════════════════════════════════════
  private async verificarRutaDeAcercamiento() {
    if (!this.map || !this.lastLocation || !this.startPointCoords || (!this.trackingState.recorridoActivo && !this.viewingRecorridoId)) {
      if (this.approachRouteLayer) {
        this.approachRouteLayer.remove();
        this.approachRouteLayer = null;
      }
      return;
    }

    // Distancia directa desde el camión hasta el punto de inicio de la ruta oficial
    const distToStart = this.map.distance(
      L.latLng(this.lastLocation.lat, this.lastLocation.lng), 
      L.latLng(this.startPointCoords.lat, this.startPointCoords.lng)
    );

    // Si está en la ruta oficial o muy cerca del punto de inicio
    if (this.isEnRuta || distToStart < 100) {
      if (this.approachRouteLayer) {
        this.approachRouteLayer.remove();
        this.approachRouteLayer = null;
      }
      return;
    }

    // Para no saturar OSRM y la red, calculamos la ruta cada 15 segundos máximo
    const now = Date.now();
    if (now - this.lastApproachUpdate < 15000 || this.isFetchingApproachRoute) return;

    this.isFetchingApproachRoute = true;
    this.lastApproachUpdate = now;

    try {
      const lon1 = this.lastLocation.lng;
      const lat1 = this.lastLocation.lat;
      const lon2 = this.startPointCoords.lng;
      const lat2 = this.startPointCoords.lat;

      const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const data = await response.json();

      if (data && data.routes && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates; // [lon, lat]
        const latlngs = coords.map((c: [number, number]) => L.latLng(c[1], c[0]));

        if (this.approachRouteLayer) {
          this.approachRouteLayer.remove();
        }

        // Dibujar ruta de acercamiento en color naranja punteado para diferenciarla
        this.approachRouteLayer = L.polyline(latlngs, {
          color: '#f59e0b', // Naranja/Ambar
          weight: 6,
          opacity: 0.8,
          dashArray: '10, 10',
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(this.map);
      }
    } catch (err) {
      console.error('Error calculando ruta de acercamiento con OSRM:', err);
    } finally {
      this.isFetchingApproachRoute = false;
    }
  }

  cargarRutas() {
    this.rutaService.getRutas()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.rutas = Array.isArray(data) ? data : [];
          if (this.mapReady) {
            this.dibujarRutas();
          }
          // Si el mapa aún no está listo, el ionViewDidEnter llama
          // dibujarRutas() después del timeout — la ruta se dibuja sola
        },
        error: (err) => console.error('Error al cargar rutas', err)
      });
  }

  dibujarRutas() {
    console.log('[MAPA] dibujarRutas — map?', !!this.map, '| rutas?', this.rutas.length, '| selectedRutaId?', this.selectedRutaId, '| mapReady?', this.mapReady);
    if (!this.map || !this.rutas.length) return;

    this.rutasLayer.clearLayers();
    console.log('[MAPA] dibujarRutas — rutasLayer cleared');

    // Limpiar marcadores de fotos anteriores
    Object.keys(this.photoMarkers).forEach(pid => {
      this.photoMarkers[pid].remove();
      delete this.photoMarkers[pid];
    });

    // Cargar fotos guardadas del recorrido activo o del externo que se está visualizando
    const recorridoId = this.trackingState.recorridoActivo || this.viewingRecorridoId;
    if (recorridoId) {
      this.recorridoService.obtenerFotosRecorrido(recorridoId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res: any) => {
            const fotos = res?.data || res || [];
            console.log('[MAPA] 📸 Cargadas fotos existentes del recorrido:', fotos.length);
            fotos.forEach((f: any) => {
              this.agregarMarcadorFoto(
                f.id || f.id_posiciones || f.posicion_id, 
                f.lat, 
                f.lon, 
                f.capturado_ts || f.timestamp || f.created_at, 
                String(recorridoId)
              );
            });
          },
          error: (err) => console.error('[MAPA] Error al cargar fotos del recorrido:', err)
        });
    }

    if (this.approachRouteLayer) {
      this.approachRouteLayer.remove();
      this.approachRouteLayer = null;
    }
    this.startPointCoords = null;
    this.officialRouteCoords = [];

    const rutasADibujar = this.selectedRutaId
      ? this.rutas.filter(r => String(r.id) === String(this.selectedRutaId))
      : [];

    const isTracking = !!this.trackingState.recorridoActivo || !!this.viewingRecorridoId;

    rutasADibujar.forEach((ruta) => {
      if (ruta.shape) {
        let shapeData: GeoJSONGeometry;
        if (typeof ruta.shape === 'string') {
          try {
            shapeData = JSON.parse(ruta.shape) as GeoJSONGeometry;
          } catch (e) {
            console.error('Error parsing route shape');
            return;
          }
        } else {
          shapeData = ruta.shape;
        }

        let allCoords: number[][] = [];
        if (shapeData.type === 'MultiLineString' && shapeData.coordinates) {
          (shapeData.coordinates as number[][][]).forEach((line: number[][]) => {
            allCoords.push(...line);
          });
        } else if (shapeData.coordinates) {
          allCoords = shapeData.coordinates as number[][];
        } else {
          return;
        }

        // L.latLng expects (lat, lng), GeoJSON has [lng, lat]
        const latlngs = allCoords
          .map((c: number[]) => {
            if (!c || c.length < 2) return null;
            const lat = Number(c[1]);
            const lng = Number(c[0]);
            if (isNaN(lat) || isNaN(lng)) return null;
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
            return L.latLng(lat, lng);
          })
          .filter((loc): loc is L.LatLng => loc !== null);

        if (latlngs.length === 0) return;

        this.officialRouteCoords = latlngs;

        // ═══ ESTILO PREMIUM ═══

        // Color azul vibrante si está en recorrido activo, verde si es solo vista
        const mainColor = isTracking ? '#4A90FF' : '#3aad6f';
        const borderColor = isTracking ? '#1a3a7a' : '#1a5c3a';
        const glowColor = isTracking ? 'rgba(74, 144, 255, 0.35)' : 'rgba(58, 173, 111, 0.25)';

        // Capa 1: Resplandor (glow) — da profundidad
        const glowLine = L.polyline(latlngs, {
          color: glowColor,
          weight: 18,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round'
        });

        // Capa 2: Borde oscuro — da contraste
        const borderLine = L.polyline(latlngs, {
          color: borderColor,
          weight: 10,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round'
        });

        // Capa 3: Línea principal — el color vibrante
        const mainLine = L.polyline(latlngs, {
          color: mainColor,
          weight: 6,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round'
        });

        this.rutasLayer.addLayer(glowLine);
        this.rutasLayer.addLayer(borderLine);
        this.rutasLayer.addLayer(mainLine);

        // ═══ MARCADORES DE INICIO Y FIN ═══
        if (latlngs.length > 0) {
          this.startPointCoords = { lat: latlngs[0].lat, lng: latlngs[0].lng };

          // Marcador de INICIO (verde)
          const startIcon = L.divIcon({
            html: this.makeRoutePointHtml('start', isTracking),
            className: 'route-point-wrapper',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });
          this.rutasLayer.addLayer(L.marker(latlngs[0], { icon: startIcon }));

          // Marcador de FIN (rojo)
          if (latlngs.length > 1) {
            const endIcon = L.divIcon({
              html: this.makeRoutePointHtml('end', isTracking),
              className: 'route-point-wrapper',
              iconSize: [28, 28],
              iconAnchor: [14, 14]
            });
            this.rutasLayer.addLayer(L.marker(latlngs[latlngs.length - 1], { icon: endIcon }));
          }
        }
      }
    });

    if (this.rutasLayer.getLayers().length > 0) {
      if (this.mapReady) {
        const isTracking = !!(this.trackingState.recorridoActivo || this.viewingRecorridoId);
        
        if (isTracking && this.truckMarker) {
          const truckLatLng = this.truckMarker.getLatLng();
          console.log('[MAPA] dibujarRutas — enfocar en la ubicación actual del conductor:', truckLatLng);
          this.map!.setView(truckLatLng, 16, { animate: false });
        } else if (isTracking && this.pendingLocation) {
          const pendingLatLng = L.latLng(this.pendingLocation.latitude, this.pendingLocation.longitude);
          console.log('[MAPA] dibujarRutas — enfocar en la ubicación pendiente del conductor:', pendingLatLng);
          this.map!.setView(pendingLatLng, 16, { animate: false });
        } else if (this.startPointCoords) {
          const sp = this.startPointCoords as {lat: number, lng: number};
          const startLatLng: [number, number] = [sp.lat, sp.lng];
          console.log('[MAPA] dibujarRutas — enfocar al inicio de ruta:', startLatLng);
          this.map!.setView(startLatLng, 15, { animate: false });
        }
      }
    } else {
      if (this.mapReady) {
        this.map!.panTo([3.8801, -77.03116], { animate: false });
      }
    }

    // Forzar re-cálculo de ruta de acercamiento porque las capas se limpiaron
    if (this.lastLocation && this.startPointCoords && this.trackingState.recorridoActivo) {
      // Reiniciamos el timer para forzar a OSRM a calcular inmediatamente
      this.lastApproachUpdate = 0; 
      this.verificarRutaDeAcercamiento();
    }
  }

  // ═══════════════════════════════════════════
  // Marcador del punto de inicio/fin de ruta
  // ═══════════════════════════════════════════
  private makeRoutePointHtml(type: 'start' | 'end', isActive: boolean): string {
    const colors = {
      start: { bg: '#22c55e', border: '#16a34a', icon: '▶' },
      end: { bg: '#ef4444', border: '#dc2626', icon: '■' }
    };
    const c = colors[type];

    return `
      <div style="
        width: 28px; height: 28px;
        background: ${c.bg};
        border: 3px solid ${c.border};
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 0 0 3px rgba(255,255,255,0.3);
        position: relative;
      ">
        <span style="color: white; font-size: 10px; font-weight: 900; line-height: 1;">${c.icon}</span>
      </div>
      ${isActive ? `<div class="route-point-pulse" style="
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 28px; height: 28px;
        border-radius: 50%;
        background: ${c.bg};
        opacity: 0;
        animation: pointPulse 2s ease-out infinite;
        pointer-events: none;
      "></div>` : ''}
    `;
  }

  // ═══════════════════════════════════════════
  // Marcador del camión (conductor en movimiento)
  // ═══════════════════════════════════════════
  private makeTruckPinHtml(placa?: string, rutaNombre?: string, heading?: number): string {
    const rotacion = heading ? `rotate(${heading}deg)` : 'rotate(0deg)';
    
    const tooltipHtml = (placa || rutaNombre) ? `
      <div style="
        position: absolute;
        bottom: 55px;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        padding: 6px 12px;
        border-radius: 10px;
        box-shadow: 0 4px 14px rgba(0,0,0,0.2);
        font-family: 'Nunito', sans-serif;
        white-space: nowrap;
        display: flex;
        flex-direction: column;
        align-items: center;
        border: 1px solid rgba(0,0,0,0.05);
      ">
        ${rutaNombre ? `<span style="font-size: 11px; font-weight: 800; color: #4A90FF; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">${rutaNombre}</span>` : ''}
        ${placa ? `<span style="font-size: 12px; font-weight: 700; color: #1e293b;">🚛 ${placa}</span>` : ''}
        <div style="position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 10px; height: 10px; background: white; border-right: 1px solid rgba(0,0,0,0.05); border-bottom: 1px solid rgba(0,0,0,0.05);"></div>
      </div>
    ` : '';

    return `
      ${tooltipHtml}
      <!-- Contenedor rotatorio del camión -->
      <div style="
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%) ${rotacion};
        width: 40px; height: 40px;
        transition: transform 0.3s ease-out;
      ">
        <!-- Pulso GPS exterior -->
        <div class="gps-pulse-ring" style="position: absolute; top: -6px; left: -6px; right: -6px; bottom: -6px; border-radius: 50%;"></div>
        
        <!-- Círculo principal -->
        <div style="
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(135deg, #4A90FF 0%, #357ABD 100%);
          border: 3px solid #ffffff;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 14px rgba(74, 144, 255, 0.5), 0 2px 4px rgba(0,0,0,0.2);
          z-index: 10;
        ">
          <!-- Icono de flecha de navegación (en lugar del camión estático) -->
          <svg viewBox="0 0 24 24" width="22" height="22" fill="white" style="transform: rotate(-45deg); margin-top: 2px; margin-right: 2px;">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </div>
      </div>
      <!-- Punto de dirección -->
      <div style="
        position: absolute; bottom: -2px; left: 50%;
        transform: translateX(-50%);
        width: 8px; height: 8px;
        background: #4A90FF;
        border-radius: 50%;
        box-shadow: 0 0 6px rgba(74, 144, 255, 0.8);
        z-index: 5;
      "></div>
    `;
  }

  // ═══════════════════════════════════════════
  // Métodos de Renderizado de Fotos en el Mapa
  // ═══════════════════════════════════════════

  private agregarMarcadorFoto(posicionId: string | number, lat: number, lon: number, timestamp: string, recorridoId: string): void {
    if (!this.map || this.photoMarkers[String(posicionId)]) return;

    const icon = L.divIcon({
      html: this.makePhotoPinHtml(timestamp),
      className: 'photo-marker-wrapper',
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });

    const marker = L.marker([lat, lon], { icon, zIndexOffset: 900 }).addTo(this.map);
    (marker as any).recorridoId = recorridoId;

    // Elevación dinámica de Z-Index al pasar el cursor (Hover)
    marker.on('mouseover', () => {
      marker.setZIndexOffset(2000);
    });
    marker.on('mouseout', () => {
      marker.setZIndexOffset(900);
    });

    // Cargar imagen de forma dinámica al hacer click
    const token = this.authService.getToken();
    
    marker.on('click', () => {
      if (marker.getPopup()?.isOpen()) return;

      const tempContent = `
        <div style="display:flex; align-items:center; justify-content:center; width:220px; height:150px; background:#0f172a; border-radius:12px; color:#ffffff; font-family:'Inter',sans-serif; font-size:12px; font-weight:500;">
          <span style="display:flex; align-items:center; gap:8px;">Cargando imagen... ⏳</span>
        </div>`;
      marker.bindPopup(tempContent, { className: 'custom-leaflet-photo-popup', minWidth: 220 }).openPopup();

      fetch(`${environment.API_BASE_URL}/recorridos/posiciones/${posicionId}/imagen`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(r => r.blob())
      .then(blob => {
        const imageUrl = URL.createObjectURL(blob);
        const fechaStr = new Date(timestamp).toLocaleString('es-CO', { 
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        
        const popupHtml = `
          <div style="position:relative; background:#000000; border-radius:12px; overflow:hidden; font-family:'Inter',sans-serif; display:flex; flex-direction:column; box-shadow:0 10px 25px rgba(0,0,0,0.5); width:240px;">
            <img src="${imageUrl}" style="width:240px; height:auto; display:block; object-fit:cover; border-radius:12px 12px 0 0;" alt="Foto del Conductor">
            <div style="background:#0f172a; padding:8px 12px; color:#ffffff; font-size:11px; font-weight:600; border-radius:0 0 12px 12px; border-top:1px solid rgba(255,255,255,0.1); display:flex; align-items:center; gap:6px;">
              🗓️ ${fechaStr}
            </div>
          </div>`;
        
        marker.bindPopup(popupHtml, { className: 'custom-leaflet-photo-popup', minWidth: 240 }).openPopup();
      })
      .catch(() => {
        marker.bindPopup(`<div style="padding:10px; color:#ef4444; font-family:'Inter',sans-serif; font-weight:600;">⚠️ Error al cargar la imagen</div>`).openPopup();
      });
    });

    this.photoMarkers[String(posicionId)] = marker;
  }

  private makePhotoPinHtml(timestamp: string): string {
    const hora = new Date(timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="photo-pin-inner" style="
        position: relative; width: 36px; height: 36px; cursor: pointer;
        filter: drop-shadow(0 3px 8px rgba(0,0,0,0.4));
      ">
        <div style="
          width: 36px; height: 36px;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          border: 3px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 8px rgba(245,158,11,0.6);
        ">
          <span style="transform: rotate(45deg); font-size: 16px; line-height: 1;">📷</span>
        </div>
        <div style="
          position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%);
          background: rgba(0,0,0,0.7); color: white;
          font-size: 9px; font-weight: 700; white-space: nowrap;
          padding: 2px 5px; border-radius: 4px;
          font-family: 'Inter', sans-serif;
        ">${hora}</div>
      </div>`;
  }

  goBack(): void {
    this.location.back();
  }

  centerOnLocation(): void {
    if (this.map && this.lastLocation) {
      const latlng = L.latLng(this.lastLocation.lat, this.lastLocation.lng);
      
      const southWest = L.latLng(3.75, -77.18);
      const northEast = L.latLng(3.98, -76.90);
      const bounds = L.latLngBounds(southWest, northEast);

      if (bounds.contains(latlng)) {
        this.map.setView(
          [this.lastLocation.lat, this.lastLocation.lng], 
          16, 
          { animate: true, duration: 0.5 }
        );
      } else {
        console.warn('[MapaPage] Ubicación fuera de los límites de Buenaventura. Centrando en Buenaventura por defecto.');
        this.map.setView([3.8801, -77.03116], 14, { animate: true, duration: 0.5 });
      }
    }
  }
}