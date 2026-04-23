import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { RecorridoService } from 'src/app/core/services/recorrido.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { TrackingService } from 'src/app/core/services/tracking.service';
import { TrackingStateService } from 'src/app/core/services/tracking-state.service';
import { Recorrido, Vehiculo, Ruta } from 'src/app/core/models';
import { addIcons } from 'ionicons';
import { playOutline, stopOutline } from 'ionicons/icons';
import { VehiculoService } from 'src/app/core/services/vehiculo.service';
import { RutaService } from 'src/app/core/services/ruta.service';

addIcons({ playOutline, stopOutline });

@Component({
  selector: 'app-recorridos',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './recorridos.page.html',
  styleUrls: ['./recorridos.page.scss']
})
export class RecorridosPage implements OnInit, OnDestroy {
  activeNav = 'recorridos';
  recorridos: Recorrido[] = [];
  vehiculos: Vehiculo[] = [];
  rutas: Ruta[] = [];
  isLoading = true;
  errorMsg = '';

  private destroy$ = new Subject<void>();

  constructor(
    private location: Location,
    private router: Router,
    private recorridoService: RecorridoService,
    private authService: AuthService,
    private trackingService: TrackingService,
    public trackingState: TrackingStateService,
    private vehiculoService: VehiculoService,
    private rutaService: RutaService
  ) {}

  ngOnInit(): void {
    this.cargarRecorridos();
    this.cargarVehiculosYRutas();
  }

  ionViewWillEnter(): void {
    this.cargarRecorridos();
  }

  cargarVehiculosYRutas(): void {
    this.vehiculoService.getVehiculos()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => this.vehiculos = data || [],
        error: (err) => console.error('Error vehiculos', err)
      });
      
    this.rutaService.getRutas()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => this.rutas = Array.isArray(data) ? data : [],
        error: (err) => console.error('Error rutas', err)
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargarRecorridos(): void {
    if (!this.authService.isLoggedIn()) {
      this.isLoading = false;
      this.errorMsg = 'Inicia sesión para ver tus recorridos';
      return;
    }

    this.isLoading = true;
    this.errorMsg = '';

    this.recorridoService.getRecorridosConductor()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.recorridos = data || [];
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error cargando recorridos:', err);
          this.errorMsg = 'No se pudieron cargar los recorridos';
          this.isLoading = false;
        }
      });
  }

  goBack(): void {
    this.location.back();
  }

  setActiveNav(nav: string): void {
    this.activeNav = nav;
    const routes: Record<string, string> = {
      inicio: '/home',
      mapa: '/mapa',
      recorridos: '/recorridos',
      rutas: '/rutas',
      perfil: '/perfil'
    };
    if (routes[nav]) {
      this.router.navigate([routes[nav]]);
    }
  }

  getNombreRuta(rutaId: string | number): string {
    if (!this.rutas || this.rutas.length === 0) return `Ruta: ${rutaId}`;
    const r = this.rutas.find(ru => String(ru.id) === String(rutaId));
    return r ? `Ruta: ${r.nombre_ruta || r.nombre || 'Desconocida'}` : `Ruta: ${rutaId}`;
  }

  getPlacaVehiculo(vehiculoId: string | number): string {
    if (!this.vehiculos || this.vehiculos.length === 0) return `Vehículo: ${vehiculoId}`;
    const v = this.vehiculos.find(ve => String(ve.id) === String(vehiculoId));
    return v ? `${v.placa} - ${v.marca}` : `Vehículo: ${vehiculoId}`;
  }

  iniciarRecorrido(recorrido: Recorrido) {
    const recId = recorrido.id_recorrido || recorrido.id;
    // Evitar iniciar si ya hay otro activo
    if (this.trackingState.recorridoActivo) {
      return;
    }
    
    if (recId) {
      // 1. Solo activar en BD si NO está activo aún
      if (!recorrido.activo) {
        this.recorridoService.activarRecorrido(recId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              recorrido.activo = true;
            },
            error: (err) => console.error('Error al activar en BD', err)
          });
      }

      // 2. Inicializar el GPS y Tracking Socket (pasa también el ruta_id y la metadata)
      const rutaId = recorrido.ruta_id;
      
      const v = this.vehiculos.find(ve => String(ve.id) === String(recorrido.vehiculo_id));
      const r = this.rutas.find(ru => String(ru.id) === String(recorrido.ruta_id));
      
      const placa = v ? v.placa : '';
      const rutaNombre = r ? (r.nombre_ruta || r.nombre) : `RUTA ${rutaId}`;
      
      this.trackingState.setRecorrido(recId, rutaId, placa, rutaNombre);
      this.trackingService.startTracking(String(recId));
      
      // 3. Ir al mapa pasando el query param para la vista inicial
      this.router.navigate(['/tabs/mapa'], { queryParams: { ruta_id: rutaId } });
    } else {
      console.error('El recorrido no tiene un ID válido');
    }
  }
  
  detenerRecorrido() {
    const recId = this.trackingState.recorridoActivo;
    
    if (recId) {
      // 1. Desactivar en la base de datos
      this.recorridoService.desactivarRecorrido(recId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            // Actualizar estado local si es necesario
            const recorrido = this.recorridos.find(r => String(r.id_recorrido || r.id) === String(recId));
            if (recorrido) recorrido.activo = false;
            
            // Refrescar lista opcionalmente
            this.cargarRecorridos();
          },
          error: (err) => console.error('Error al desactivar en BD', err)
        });
    }

    // 2. Detener GPS y limpiar estado global
    this.trackingService.stopTracking();
    this.trackingState.clear();
  }
}