import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import * as L from 'leaflet';
import { RutaService } from 'src/app/core/services/ruta.service';
import { Ruta, GeoJSONGeometry } from 'src/app/core/models';
import { LocationService } from 'src/app/core/services/location.service';
import { TrackingStateService } from 'src/app/core/services/tracking-state.service';

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './mapa.page.html',
  styleUrls: ['./mapa.page.scss']
})
export class MapaPage implements OnDestroy, OnInit {
  private map: L.Map | undefined;
  private rutasLayer: L.FeatureGroup = L.featureGroup();
  private destroy$ = new Subject<void>();

  rutas: Ruta[] = [];
  selectedRutaId: string | number | null = null;
  private truckMarker: L.Marker | null = null;

  constructor(
    private location: Location, 
    private router: Router,
    private route: ActivatedRoute,
    private rutaService: RutaService,
    private locationService: LocationService,
    public trackingState: TrackingStateService
  ) {}

  ngOnInit() {
    // Escuchar parámetros para saber si queremos ver una ruta específica
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        // Usar params, o si no hay, la ruta que esté siendo trackeada actualmente
        this.selectedRutaId = params['ruta_id'] || this.trackingState.rutaActiva || null;
        this.cargarRutas();
      });

    // Escuchar si el recorrido se detiene globalmente para limpiar el mapa al instante
    this.trackingState.recorridoId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(id => {
        if (!id) {
          this.selectedRutaId = null;
          if (this.map) {
            this.rutasLayer.clearLayers();
            if (this.truckMarker) {
              this.truckMarker.remove();
              this.truckMarker = null;
            }
          }
        }
      });
  }

  ionViewDidEnter() {
    if (!this.map) {
      this.initMap();
      this.escucharUbicacionEnTiempoReal();
    }
    
    // Forzar renderizado completo del mapa
    setTimeout(() => {
      if(this.map) {
        this.map.invalidateSize();
        window.dispatchEvent(new Event('resize'));
        if (this.rutasLayer.getLayers().length > 0) {
            this.map.fitBounds(this.rutasLayer.getBounds(), { padding: [40, 40] });
        }
      }
    }, 300);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initMap(): void {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    this.map = L.map('map', { attributionControl: false, zoomControl: false }).setView([ 3.8801, -77.03116 ], 14);

    // Mapa Estándar de Google Maps (Roadmap)
    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '© Google Maps'
    }).addTo(this.map);
    
    this.rutasLayer.addTo(this.map);

    setTimeout(() => {
        if(this.map) {
          this.map.invalidateSize();
        }
    }, 500);
  }

  escucharUbicacionEnTiempoReal() {
    this.locationService.location$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loc => {
        if (!this.map) return;
        
        const latlng = L.latLng(loc.latitude, loc.longitude);
        
        if (!this.truckMarker) {
          const placa = this.trackingState.vehiculoPlaca || undefined;
          const rutaNombre = this.trackingState.nombreRuta || undefined;

          const truckIcon = L.divIcon({
            html: this.makeTruckPinHtml(placa, rutaNombre),
            className: 'truck-marker-wrapper',
            iconSize: [52, 52],
            iconAnchor: [26, 26]
          });
          this.truckMarker = L.marker(latlng, { icon: truckIcon, zIndexOffset: 1000 }).addTo(this.map);
          // Si es la primera vez que recibimos la ubicación, centramos el mapa en el conductor
          this.map.setView(latlng, 16);
        } else {
          this.truckMarker.setLatLng(latlng);
        }
      });
  }

  cargarRutas() {
    this.rutaService.getRutas()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.rutas = Array.isArray(data) ? data : [];
          this.dibujarRutas();
        },
        error: (err) => console.error('Error al cargar rutas', err)
      });
  }

  dibujarRutas() {
    if (!this.map || !this.rutas.length) return;
    
    this.rutasLayer.clearLayers();

    const rutasADibujar = this.selectedRutaId 
        ? this.rutas.filter(r => String(r.id) === String(this.selectedRutaId))
        : [];

    const isTracking = !!this.trackingState.recorridoActivo;

    rutasADibujar.forEach((ruta) => {
      if (ruta.shape) {
        let shapeData: GeoJSONGeometry;
        if (typeof ruta.shape === 'string') {
          try {
            shapeData = JSON.parse(ruta.shape) as GeoJSONGeometry;
          } catch(e) {
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
        const latlngs = allCoords.map((c: number[]) => L.latLng(c[1], c[0]));

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
        this.map.fitBounds(this.rutasLayer.getBounds(), { padding: [50, 50] });
    } else {
        // Fallback Buenaventura si no hay ruta seleccionada
        this.map.setView([ 3.8801, -77.03116 ], 14);
    }
  }

  // ═══════════════════════════════════════════
  // Marcador del punto de inicio/fin de ruta
  // ═══════════════════════════════════════════
  private makeRoutePointHtml(type: 'start' | 'end', isActive: boolean): string {
    const colors = {
      start: { bg: '#22c55e', border: '#16a34a', icon: '▶' },
      end:   { bg: '#ef4444', border: '#dc2626', icon: '■' }
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
  private makeTruckPinHtml(placa?: string, rutaNombre?: string): string {
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
      <!-- Pulso GPS exterior -->
      <div class="gps-pulse-ring"></div>
      <!-- Círculo principal -->
      <div style="
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 40px; height: 40px;
        background: linear-gradient(135deg, #4A90FF 0%, #357ABD 100%);
        border: 3px solid #ffffff;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 14px rgba(74, 144, 255, 0.5), 0 2px 4px rgba(0,0,0,0.2);
        z-index: 10;
      ">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
          <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
        </svg>
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

  goBack(): void {
    this.location.back();
  }
}