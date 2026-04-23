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

    this.map = L.map('map', { attributionControl: false }).setView([ 3.8801, -77.03116 ], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
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
          const iconHtml = this.makeTruckPinHtml();
          const truckIcon = L.divIcon({ html: iconHtml, className: '', iconSize: [40, 40], iconAnchor: [20, 20] });
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
    
    const colores = ['#3aad6f', '#f9a03f', '#4ac2e8', '#9b7fe8', '#e87070'];

    const rutasADibujar = this.selectedRutaId 
        ? this.rutas.filter(r => String(r.id) === String(this.selectedRutaId))
        : [];

    rutasADibujar.forEach((ruta, index) => {
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

        const color = ruta.color_hex || colores[index % colores.length];

        // L.latLng expects (lat, lng), GeoJSON has [lng, lat]
        const latlngs = allCoords.map((c: number[]) => L.latLng(c[1], c[0]));
        
        const layer = L.polyline(latlngs, {
          color: color,
          weight: 7,
          opacity: 1
        });
        
        this.rutasLayer.addLayer(layer);

        // -- Dibujar pines de inicio y fin --
        if (latlngs.length > 0) {
          const pinHtml = this.makePinHtml(color, 32);
          const icon = L.divIcon({ html: pinHtml, className: '', iconSize: [32, 32], iconAnchor: [16, 32] });
          
          this.rutasLayer.addLayer(L.marker(latlngs[0], { icon }));
          
          if (latlngs.length > 1) {
            this.rutasLayer.addLayer(L.marker(latlngs[latlngs.length - 1], { icon }));
          }
        }
      }
    });

    if (this.rutasLayer.getLayers().length > 0) {
        this.map.fitBounds(this.rutasLayer.getBounds(), { padding: [40, 40] });
    } else {
        // Fallback Buenaventura si no hay ruta seleccionada
        this.map.setView([ 3.8801, -77.03116 ], 14);
    }
  }

  // Genera HTML SVG para el pin de ruta. Color en formato HEX y tamaño en px.
  private makePinHtml(color: string, size = 36): string {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" style="background:transparent;">
        <defs>
          <linearGradient id="g_${color.replace('#', '')}" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="1" />
            <stop offset="100%" stop-color="#7af3bf" stop-opacity="0.95" />
          </linearGradient>
          <filter id="f_${color.replace('#', '')}" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="${color}" flood-opacity="0.5" />
          </filter>
        </defs>
        <!-- pin shape -->
        <path d="M12 2C8.686 2 6 4.686 6 8c0 4.667 6 12 6 12s6-7.333 6-12c0-3.314-2.686-6-6-6z" fill="url(#g_${color.replace('#', '')})" filter="url(#f_${color.replace('#', '')})"/>
        <!-- inner circle -->
        <circle cx="12" cy="8" r="2.6" fill="#ffffff" />
      </svg>
    `;
  }

  // Genera HTML SVG para el pin del camión
  private makeTruckPinHtml(): string {
    return `
      <div style="background-color: #4CAF50; border: 2px solid white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="white">
          <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
        </svg>
      </div>
    `;
  }

  goBack(): void {
    this.location.back();
  }
}