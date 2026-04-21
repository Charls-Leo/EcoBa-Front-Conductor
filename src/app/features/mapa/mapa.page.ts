import { Component, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, ActivatedRoute } from '@angular/router';
import * as L from 'leaflet';
import { ApiService } from 'src/app/core/services/api.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './mapa.page.html',
  styleUrls: ['./mapa.page.scss']
})
export class MapaPage implements OnDestroy {
  private map: L.Map | undefined;
  private rutasLayer: L.FeatureGroup = L.featureGroup();
  private querySub: Subscription | undefined;
  
  rutas: any[] = [];
  selectedRutaId: string | number | null = null;

  constructor(
    private location: Location, 
    private router: Router,
    private route: ActivatedRoute,
    private apiService: ApiService
  ) {}

  ionViewDidEnter() {
    if (!this.map) {
      this.initMap();
    }
    
    // Escuchar parámetros para saber si queremos ver una ruta específica
    if (!this.querySub) {
      this.querySub = this.route.queryParams.subscribe(params => {
        this.selectedRutaId = params['ruta_id'] || null;
        this.cargarRutas();
      });
    } else {
        // En caso de que ya estuviera suscrito, puede que los paramétros hayan cambiado por navegación
        // El subscribe ya reacciona a los cambios automáticamente en Angular.
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

  ionViewDidLeave() {
    // Optionally clean up
  }

  ngOnDestroy() {
    if (this.querySub) {
      this.querySub.unsubscribe();
    }
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

  cargarRutas() {
    this.apiService.getRutas().subscribe({
      next: (data) => {
        this.rutas = Array.isArray(data) ? data : (data?.data || data?.rutas || []);
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
        let shapeData = ruta.shape;
        if (typeof shapeData === 'string') {
          try {
            shapeData = JSON.parse(shapeData);
          } catch(e) {
            console.error('Error parsing route shape');
            return;
          }
        }
        
        let allCoords: [number, number][] = [];
        if (shapeData.type === 'MultiLineString' && shapeData.coordinates) {
            shapeData.coordinates.forEach((line: [number, number][]) => {
              allCoords.push(...line);
            });
        } else if (shapeData.coordinates) {
            allCoords = shapeData.coordinates;
        } else {
            return;
        }

        const color = ruta.color_hex || colores[index % colores.length];

        // L.latLng expects (lat, lng), GeoJSON has [lng, lat]
        const latlngs = allCoords.map((c: [number, number]) => L.latLng(c[1], c[0]));
        
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

  goBack(): void {
    this.location.back();
  }
}