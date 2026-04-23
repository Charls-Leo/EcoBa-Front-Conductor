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
import { Recorrido } from 'src/app/core/models';
import { addIcons } from 'ionicons';
import { playOutline, stopOutline } from 'ionicons/icons';

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
  isLoading = true;
  errorMsg = '';

  private destroy$ = new Subject<void>();

  constructor(
    private location: Location,
    private router: Router,
    private recorridoService: RecorridoService,
    private authService: AuthService,
    private trackingService: TrackingService,
    public trackingState: TrackingStateService
  ) {}

  ngOnInit(): void {
    this.cargarRecorridos();
  }

  ionViewWillEnter(): void {
    this.cargarRecorridos();
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

  iniciarRecorrido(recorrido: Recorrido) {
    const recId = recorrido.id_recorrido || recorrido.id;
    // Evitar iniciar si ya hay otro activo
    if (this.trackingState.recorridoActivo) {
      return;
    }
    
    if (recId) {
      // 1. Activar en la base de datos
      this.recorridoService.activarRecorrido(recId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            recorrido.activo = true;
          },
          error: (err) => console.error('Error al activar en BD', err)
        });

      // 2. Inicializar el GPS y Tracking Socket (pasa también el ruta_id)
      const rutaId = recorrido.ruta_id;
      this.trackingState.setRecorrido(recId, rutaId);
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