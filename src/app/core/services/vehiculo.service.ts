import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Vehiculo } from '../models';

// =========================================================
// Servicio de dominio: Vehículos (solo lectura desde móvil)
// Solo maneja /vehiculos — sin lógica de UI
// =========================================================

@Injectable({
  providedIn: 'root'
})
export class VehiculoService {

  private readonly baseUrl = `${environment.API_BASE_URL}/vehiculos`;
  private readonly perfilId = environment.PERFIL_ID;

  // ═══ ESTRATEGIA DE CACHING PERSISTENTE EN LOCALSTORAGE ═══
  private readonly STORAGE_KEY_DATA = 'eco_vehiculos_cache_data';
  private readonly STORAGE_KEY_TIME = 'eco_vehiculos_cache_time';
  private vehiculosCache: Vehiculo[] | null = null;
  private lastFetchTime = 0;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas (los vehículos raramente cambian)

  constructor(private http: HttpClient) {}

  /** Obtiene todos los vehículos — normaliza respuesta paginada del profesor y aplica caché persistente */
  getVehiculos(forceRefresh = false): Observable<Vehiculo[]> {
    const now = Date.now();

    // 1. Devolver desde la memoria si es válida
    if (!forceRefresh && this.vehiculosCache && (now - this.lastFetchTime < this.CACHE_DURATION)) {
      console.log('📦 [VehiculoService] Devolviendo vehículos desde caché local (in-memory)');
      return of(this.vehiculosCache);
    }

    // 2. Devolver desde localStorage si es válida
    if (!forceRefresh) {
      try {
        const cachedData = localStorage.getItem(this.STORAGE_KEY_DATA);
        const cachedTime = localStorage.getItem(this.STORAGE_KEY_TIME);
        
        if (cachedData && cachedTime) {
          const parsedTime = Number(cachedTime);
          if (now - parsedTime < this.CACHE_DURATION) {
            const parsedData = JSON.parse(cachedData) as Vehiculo[];
            this.vehiculosCache = parsedData;
            this.lastFetchTime = parsedTime;
            console.log('💾 [VehiculoService] Devolviendo vehículos desde caché persistente (localStorage)');
            return of(parsedData);
          }
        }
      } catch (e) {
        console.error('[VehiculoService] Error leyendo caché de vehículos persistente:', e);
      }
    }

    // 3. De lo contrario, descargar del servidor
    const params = new HttpParams().set('perfil_id', this.perfilId);
    return this.http.get<any>(this.baseUrl, { params }).pipe(
      map(response => {
        const data = Array.isArray(response) ? response : (response?.data && Array.isArray(response.data) ? response.data : []);
        this.vehiculosCache = data;
        this.lastFetchTime = now;
        
        try {
          localStorage.setItem(this.STORAGE_KEY_DATA, JSON.stringify(data));
          localStorage.setItem(this.STORAGE_KEY_TIME, String(now));
          console.log('💾 [VehiculoService] Caché de vehículos guardada en localStorage');
        } catch (e) {
          console.error('[VehiculoService] Error guardando caché de vehículos persistente:', e);
        }
        
        return data;
      })
    );
  }

  /** Limpia el cache de vehículos manualmente de memoria y localStorage */
  clearCache(): void {
    this.vehiculosCache = null;
    this.lastFetchTime = 0;
    try {
      localStorage.removeItem(this.STORAGE_KEY_DATA);
      localStorage.removeItem(this.STORAGE_KEY_TIME);
    } catch (e) {}
    console.log('📦 [VehiculoService] Caché de vehículos limpiado (memoria y localStorage)');
  }
}
