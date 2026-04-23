import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription, BehaviorSubject, filter, firstValueFrom, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LocationService } from './location.service';
import { WebSocketService } from './websocket.service';
import { AuthService } from './auth.service';
import { LocationData, TrackingPayload } from '../models';

// =========================================================
// TrackingService — Gestión del envío de ubicación al backend
// Orquesta: LocationService → WebSocket (o HTTP fallback) → Backend
// NO captura GPS (eso es LocationService)
// NO gestiona UI (eso es el componente)
// =========================================================

export type TrackingStatus = 'inactive' | 'active' | 'paused' | 'error';

@Injectable({
  providedIn: 'root'
})
export class TrackingService {

  /** Estado del tracking */
  private statusSubject = new BehaviorSubject<TrackingStatus>('inactive');
  readonly status$ = this.statusSubject.asObservable();

  /** Última ubicación enviada (para UI) */
  private lastLocationSubject = new BehaviorSubject<LocationData | null>(null);
  readonly lastLocation$ = this.lastLocationSubject.asObservable();

  /** Contador de ubicaciones enviadas en la sesión actual */
  private sentCountSubject = new BehaviorSubject<number>(0);
  readonly sentCount$ = this.sentCountSubject.asObservable();

  /** Suscripción interna al stream de ubicaciones */
  private locationSub: Subscription | null = null;

  /** ID del recorrido activo */
  private activeRecorridoId: string | null = null;

  /** Buffer de ubicaciones no enviadas (offline fallback) */
  private offlineBuffer: TrackingPayload[] = [];
  private readonly MAX_BUFFER_SIZE = 500;

  /** URL para fallback HTTP */
  private readonly httpUrl = `${environment.API_BASE_URL}/ubicaciones`;

  constructor(
    private locationService: LocationService,
    private webSocketService: WebSocketService,
    private authService: AuthService,
    private http: HttpClient
  ) {}

  // -----------------------------------------------------------
  // Control del tracking
  // -----------------------------------------------------------

  /** Iniciar tracking de ubicación para un recorrido */
  async startTracking(recorridoId: string): Promise<boolean> {
    const user = this.authService.getUser();
    if (!user) {
      console.error('[TrackingService] No hay usuario logueado');
      this.statusSubject.next('error');
      return false;
    }

    this.activeRecorridoId = recorridoId;

    // 1. Conectar WebSocket PRIMERO y esperar a que esté listo
    const token = this.authService.getToken();
    if (token) {
      this.webSocketService.connect(token);
      try {
        // Esperar hasta 3 segundos a que el WebSocket conecte
        await firstValueFrom(
          this.webSocketService.connectionStatus$.pipe(
            filter(status => status === 'connected'),
            timeout(3000)
          )
        );
        console.log('[TrackingService] WebSocket conectado — listo para enviar');
      } catch {
        console.warn('[TrackingService] WebSocket no conectó en 3s — se usará buffer offline');
      }
    }

    // 2. Iniciar captura GPS
    await this.locationService.startWatching();

    if (!this.locationService.isWatching) {
      console.error('[TrackingService] No se pudo iniciar GPS');
      this.statusSubject.next('error');
      return false;
    }

    // 3. Suscribirse al stream de ubicaciones (WebSocket ya debería estar listo)
    this.locationSub = this.locationService.location$.subscribe(location => {
      this.handleNewLocation(location, user.id_usuario);
    });

    this.statusSubject.next('active');
    console.log(`[TrackingService] Tracking iniciado — Recorrido: ${recorridoId}`);
    return true;
  }

  /** Detener tracking completamente */
  async stopTracking(): Promise<void> {
    // 1. Desuscribirse del stream GPS
    if (this.locationSub) {
      this.locationSub.unsubscribe();
      this.locationSub = null;
    }

    // 2. Detener captura GPS
    await this.locationService.stopWatching();

    // 3. Flush del buffer offline antes de cerrar
    await this.flushOfflineBuffer();

    // 4. Desconectar WebSocket
    this.webSocketService.disconnect();

    // 5. Resetear estado
    this.activeRecorridoId = null;
    this.sentCountSubject.next(0);
    this.statusSubject.next('inactive');
    console.log('[TrackingService] Tracking detenido');
  }

  /** Pausar tracking (mantiene GPS pero no envía) */
  pauseTracking(): void {
    if (this.statusSubject.value === 'active') {
      this.statusSubject.next('paused');
    }
  }

  /** Reanudar tracking pausado */
  resumeTracking(): void {
    if (this.statusSubject.value === 'paused') {
      this.statusSubject.next('active');
    }
  }

  /** ¿Está el tracking activo? */
  get isActive(): boolean {
    return this.statusSubject.value === 'active';
  }

  // -----------------------------------------------------------
  // Lógica interna de envío
  // -----------------------------------------------------------

  /** Procesa cada nueva ubicación recibida del GPS */
  private handleNewLocation(location: LocationData, conductorId: string): void {
    this.lastLocationSubject.next(location);

    // Si está pausado, no enviar
    if (this.statusSubject.value !== 'active') {
      return;
    }

    const payload: TrackingPayload = {
      conductor_id: conductorId,
      recorrido_id: this.activeRecorridoId,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: location.timestamp,
        accuracy: location.accuracy,
        speed: location.speed,
        heading: location.heading
      }
    };

    // Intentar enviar por WebSocket
    const sent = this.webSocketService.send('conductor:location', payload);

    if (sent) {
      this.sentCountSubject.next(this.sentCountSubject.value + 1);
    } else {
      // WebSocket no disponible — guardar en buffer offline
      this.addToOfflineBuffer(payload);
    }
  }

  // -----------------------------------------------------------
  // Buffer offline (fallback)
  // -----------------------------------------------------------

  /** Agregar payload al buffer cuando no hay conexión */
  private addToOfflineBuffer(payload: TrackingPayload): void {
    if (this.offlineBuffer.length >= this.MAX_BUFFER_SIZE) {
      // Descartar las ubicaciones más viejas
      this.offlineBuffer.shift();
    }
    this.offlineBuffer.push(payload);
  }

  /** Enviar todas las ubicaciones acumuladas via HTTP */
  private async flushOfflineBuffer(): Promise<void> {
    if (this.offlineBuffer.length === 0) return;

    const usuario = this.authService.getUser();
    if (!usuario) return;

    const payload = this.offlineBuffer.map(loc => ({
      lat: loc.location.latitude,
      lon: loc.location.longitude,
      perfil_id: usuario.id_usuario,
      recorrido_id: this.activeRecorridoId
    }));

    try {
      await this.http.post(`${this.httpUrl}/batch`, payload).toPromise();
      this.offlineBuffer = [];
      console.log(`[TrackingService] Buffer offline enviado: ${payload.length} ubicaciones`);
    } catch (err) {
      console.error('[TrackingService] Error enviando buffer offline:', err);
    }
  }
}
