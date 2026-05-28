import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';
import { RutaService } from 'src/app/core/services/ruta.service';
import { RecorridoService } from 'src/app/core/services/recorrido.service';
import { VehiculoService } from 'src/app/core/services/vehiculo.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { TrackingStateService } from 'src/app/core/services/tracking-state.service';
import { WebSocketService } from 'src/app/core/services/websocket.service';
import { Ruta, Recorrido, Vehiculo } from 'src/app/core/models';

/** Info del recorrido activo asociado a una ruta */
export interface RecorridoActivoInfo {
  recorridoId: string | number;
  vehiculoId: string | number;
  placa: string;
  marcaVehiculo: string;
  horaInicio: string;
  conductorId: string;
}

@Component({
  selector: 'app-rutas',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './rutas.page.html',
  styleUrls: ['./rutas.page.scss']
})
export class RutasPage implements OnInit, OnDestroy {
  activeNav = 'rutas';
  rutas: Ruta[] = [];
  isLoading = true;
  errorMsg = '';

  /** Mapa de ruta_id → info del recorrido activo (si existe) */
  recorridosActivosMap: Map<string, RecorridoActivoInfo> = new Map();

  /** ID de la ruta cuyo panel está expandido (null = ninguno) */
  expandedRutaId: string | number | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private location: Location,
    private router: Router,
    private rutaService: RutaService,
    public trackingState: TrackingStateService,
    private recorridoService: RecorridoService,
    private vehiculoService: VehiculoService,
    private authService: AuthService,
    private webSocketService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.cargarTodo();

    // Escuchar si inicia o finaliza algún recorrido en tiempo real
    this.webSocketService.messages$
      .pipe(
        takeUntil(this.destroy$),
        filter(msg => msg.event === 'recorrido:iniciado' || msg.event === 'recorrido:finalizado')
      )
      .subscribe(msg => {
        console.log(`[RUTAS-CONDUCTOR] 📡 Evento real-time '${msg.event}' recibido. Actualizando silenciosamente...`);
        // Silent refresh para no interrumpir la experiencia de usuario (no pone isLoading = true)
        this.cargarTodo(true);
      });
  }

  ionViewWillEnter(): void {
    // Conectar WebSocket si hay sesión activa para recibir eventos
    const token = this.authService.getToken();
    if (token) {
      this.webSocketService.connect(token);
    }

    // Si el conductor tiene un recorrido activo PROPIO, mostramos la pantalla de bloqueo
    if (this.trackingState.recorridoActivo) {
      this.isLoading = false;
      return;
    }

    // Si está logueado, verificar si hay un recorrido activo pendiente en la BD
    if (this.authService.isLoggedIn()) {
      this.recorridoService.getRecorridosConductor()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (data) => {
            const activoDB = (data || []).find((r: any) => r.estado === 'en_curso' || r.activo);
            if (activoDB) {
              const recId = activoDB.id_recorrido || activoDB.id || '';
              const rutaId = activoDB.ruta_id || '';
              if (recId) {
                this.trackingState.setRecorrido(recId, rutaId);
              }
              this.isLoading = false;
            } else {
              this.cargarTodo();
            }
          },
          error: () => {
            this.cargarTodo();
          }
        });
    } else {
      this.cargarTodo();
    }
  }

  ionViewWillLeave(): void {
    this.webSocketService.disconnect();
  }

  ngOnDestroy(): void {
    this.webSocketService.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Carga rutas, recorridos y vehículos en paralelo */
  cargarTodo(silent = false): void {
    if (!silent) {
      this.isLoading = true;
    }
    this.errorMsg = '';

    forkJoin({
      rutas: this.rutaService.getRutas(),
      recorridos: this.recorridoService.getRecorridos(true),
      vehiculos: this.vehiculoService.getVehiculos()
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ rutas, recorridos, vehiculos }) => {
        this.rutas = Array.isArray(rutas) ? rutas : [];
        this.construirMapaActivos(recorridos || [], vehiculos || []);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando datos de rutas:', err);
        if (!silent) {
          this.errorMsg = 'No se pudieron cargar las rutas';
        }
        this.isLoading = false;
      }
    });
  }

  /** Construye el mapa de ruta_id → recorrido activo con datos del vehículo */
  private construirMapaActivos(recorridos: Recorrido[], vehiculos: Vehiculo[]): void {
    this.recorridosActivosMap.clear();

    const activos = recorridos.filter((r: any) => r.activo === true || r.estado === 'en_curso');

    for (const rec of activos) {
      const rutaId = String(rec.ruta_id);
      const vehiculoId = rec.vehiculo_id;
      const vehiculo = vehiculos.find(v => String(v.id) === String(vehiculoId));

      this.recorridosActivosMap.set(rutaId, {
        recorridoId: rec.id_recorrido || rec.id || '',
        vehiculoId: vehiculoId,
        placa: vehiculo?.placa || 'Sin placa',
        marcaVehiculo: vehiculo?.marca || '',
        horaInicio: (rec as any).sesion_inicio || rec.creado_en || '',
        conductorId: rec.conductor_id || (rec as any).perfil_id || ''
      });
    }
  }

  /** ¿La ruta tiene un recorrido activo? */
  isRutaActiva(rutaId: string | number): boolean {
    return this.recorridosActivosMap.has(String(rutaId));
  }

  /** Obtiene info del recorrido activo para una ruta */
  getRecorridoActivo(rutaId: string | number): RecorridoActivoInfo | undefined {
    return this.recorridosActivosMap.get(String(rutaId));
  }

  /** Formatea la hora de inicio para mostrar */
  formatHoraInicio(isoString: string): string {
    if (!isoString) return 'No disponible';
    try {
      return new Date(isoString).toLocaleString('es-CO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  }

  /** Toggle de expansión de la tarjeta de ruta */
  toggleRuta(rutaId: string | number): void {
    this.expandedRutaId = this.expandedRutaId === rutaId ? null : rutaId;
  }

  /** Navega al mapa para ver la ruta (y si hay recorrido activo, con tracking en tiempo real) */
  verEnMapa(rutaId: string | number): void {
    const activeRec = this.getRecorridoActivo(rutaId);
    const queryParams: any = { ruta_id: rutaId };
    if (activeRec) {
      queryParams.recorrido_id = activeRec.recorridoId;
      queryParams.placa        = activeRec.placa;
      queryParams.nombre_ruta  = this.rutas.find(r => String(r.id) === String(rutaId))?.nombre_ruta
                               || this.rutas.find(r => String(r.id) === String(rutaId))?.nombre
                               || '';
    }
    this.router.navigate(['/tabs/mapa'], { queryParams });
  }

  goBack(): void {
    this.location.back();
  }

  irAMiMapa() {
    this.router.navigate(['/tabs/mapa']);
  }
}