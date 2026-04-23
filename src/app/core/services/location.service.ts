import { Injectable, NgZone } from '@angular/core';
import { Observable, Subject, BehaviorSubject, ReplaySubject } from 'rxjs';
import { Geolocation, Position, CallbackID } from '@capacitor/geolocation';
import { LocationData } from '../models';

// =========================================================
// LocationService — Captura GPS via Capacitor Geolocation
// Responsabilidad única: obtener coordenadas del dispositivo
// NO contiene lógica de red ni de negocio
// =========================================================

export type LocationStatus = 'idle' | 'watching' | 'error' | 'permission_denied';

@Injectable({
  providedIn: 'root'
})
export class LocationService {

  /** Stream de ubicaciones GPS */
  private locationSubject = new ReplaySubject<LocationData>(1);
  readonly location$ = this.locationSubject.asObservable();

  /** Estado actual del servicio de ubicación */
  private statusSubject = new BehaviorSubject<LocationStatus>('idle');
  readonly status$ = this.statusSubject.asObservable();

  /** ID del watcher activo de Capacitor */
  private watchId: CallbackID | null = null;

  constructor(private ngZone: NgZone) {}

  // -----------------------------------------------------------
  // Permisos
  // -----------------------------------------------------------

  /** Solicitar permisos de ubicación al usuario */
  async requestPermissions(): Promise<boolean> {
    try {
      const status = await Geolocation.requestPermissions();
      return status.location === 'granted';
    } catch (err: any) {
      // En entorno web, Capacitor lanza 'Not implemented' en requestPermissions.
      // Retornamos true silenciosamente para permitir que watchPosition active el prompt automático.
      return true;
    }
  }

  /** Verificar si ya se tienen permisos */
  async checkPermissions(): Promise<boolean> {
    try {
      const status = await Geolocation.checkPermissions();
      return status.location === 'granted';
    } catch {
      return true; // Fallback web
    }
  }

  // -----------------------------------------------------------
  // Captura de ubicación
  // -----------------------------------------------------------

  /** Obtener ubicación actual una sola vez */
  async getCurrentPosition(): Promise<LocationData | null> {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });
      return this.mapPosition(position);
    } catch (err) {
      console.error('[LocationService] Error obteniendo posición actual:', err);
      return null;
    }
  }

  /** Iniciar seguimiento continuo de ubicación */
  async startWatching(): Promise<void> {
    // Evitar múltiples watchers
    if (this.watchId !== null) {
      return;
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      this.statusSubject.next('permission_denied');
      console.warn('[LocationService] Permisos de ubicación denegados');
      return;
    }

    try {
      this.watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000
        },
        (position: Position | null, err?: unknown) => {
          // NgZone para que Angular detecte los cambios
          this.ngZone.run(() => {
            if (err) {
              console.error('[LocationService] Error en watchPosition:', err);
              this.statusSubject.next('error');
              return;
            }

            if (position) {
              const locationData = this.mapPosition(position);
              this.locationSubject.next(locationData);
              this.statusSubject.next('watching');
            }
          });
        }
      );

      this.statusSubject.next('watching');
    } catch (err) {
      console.error('[LocationService] Error iniciando watchPosition:', err);
      this.statusSubject.next('error');
    }
  }

  /** Detener seguimiento de ubicación */
  async stopWatching(): Promise<void> {
    if (this.watchId !== null) {
      await Geolocation.clearWatch({ id: this.watchId });
      this.watchId = null;
      this.statusSubject.next('idle');
    }
  }

  /** ¿Se está rastreando la ubicación actualmente? */
  get isWatching(): boolean {
    return this.watchId !== null;
  }

  // -----------------------------------------------------------
  // Mapeo interno
  // -----------------------------------------------------------

  /** Convierte Position de Capacitor a nuestro modelo tipado */
  private mapPosition(position: Position): LocationData {
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      timestamp: position.timestamp,
      accuracy: position.coords.accuracy ?? undefined,
      speed: position.coords.speed ?? null,
      heading: position.coords.heading ?? null
    };
  }
}
