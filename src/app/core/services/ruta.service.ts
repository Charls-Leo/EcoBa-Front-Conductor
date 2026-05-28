import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Ruta } from '../models';

// =========================================================
// Servicio de dominio: Rutas
// Solo maneja /rutas — sin lógica de UI
// =========================================================

/** La API puede devolver un array directo o un wrapper { data: [...] } / { rutas: [...] } */
interface RutasApiResponse {
  data?: Ruta[];
  rutas?: Ruta[];
}

@Injectable({
  providedIn: 'root'
})
export class RutaService {

  private readonly baseUrl = `${environment.API_BASE_URL}/rutas`;
  private readonly perfilId = environment.PERFIL_ID;

  // ═══ ESTRATEGIA DE CACHING PERSISTENTE EN LOCALSTORAGE ═══
  private readonly STORAGE_KEY_DATA = 'eco_rutas_cache_data';
  private readonly STORAGE_KEY_TIME = 'eco_rutas_cache_time';
  private rutasCache: Ruta[] | null = null;
  private lastFetchTime = 0;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas (TTL largo para ahorrar recursos de red)

  constructor(private http: HttpClient) {}

  /** Obtiene todas las rutas — normaliza la respuesta del backend y aplica caché persistente */
  getRutas(forceRefresh = false): Observable<Ruta[]> {
    const now = Date.now();
    
    // 1. Devolver desde la memoria si es válida
    if (!forceRefresh && this.rutasCache && (now - this.lastFetchTime < this.CACHE_DURATION)) {
      console.log('📦 [RutaService] Devolviendo rutas desde caché local (in-memory)');
      return of(this.rutasCache);
    }

    // 2. Devolver desde localStorage si es válida
    if (!forceRefresh) {
      try {
        const cachedData = localStorage.getItem(this.STORAGE_KEY_DATA);
        const cachedTime = localStorage.getItem(this.STORAGE_KEY_TIME);
        
        if (cachedData && cachedTime) {
          const parsedTime = Number(cachedTime);
          if (now - parsedTime < this.CACHE_DURATION) {
            const parsedData = JSON.parse(cachedData) as Ruta[];
            this.rutasCache = parsedData;
            this.lastFetchTime = parsedTime;
            console.log('💾 [RutaService] Devolviendo rutas desde caché persistente (localStorage)');
            return of(parsedData);
          }
        }
      } catch (e) {
        console.error('[RutaService] Error leyendo caché persistente:', e);
      }
    }

    // 3. De lo contrario, descargar del servidor
    const params = new HttpParams().set('perfil_id', this.perfilId);
    return this.http.get<Ruta[] | RutasApiResponse>(this.baseUrl, { params }).pipe(
      map(response => {
        const data = Array.isArray(response) ? response : (response.data || response.rutas || []);
        this.rutasCache = data;
        this.lastFetchTime = now;
        
        try {
          localStorage.setItem(this.STORAGE_KEY_DATA, JSON.stringify(data));
          localStorage.setItem(this.STORAGE_KEY_TIME, String(now));
          console.log('💾 [RutaService] Caché persistente guardada en localStorage');
        } catch (e) {
          console.error('[RutaService] Error guardando caché persistente:', e);
        }
        
        return data;
      })
    );
  }

  /** Obtiene una ruta por su ID (busca en caché primero) */
  getRutaPorId(id: string): Observable<Ruta> {
    if (this.rutasCache) {
      const rutaLocal = this.rutasCache.find(r => String(r.id) === String(id));
      if (rutaLocal) {
        console.log(`📦 [RutaService] Ruta ${id} encontrada en caché local`);
        return of(rutaLocal);
      }
    }

    const params = new HttpParams().set('perfil_id', this.perfilId);
    return this.http.get<Ruta>(`${this.baseUrl}/${id}`, { params });
  }

  /** Limpia el cache de rutas manualmente de memoria y localStorage */
  clearCache(): void {
    this.rutasCache = null;
    this.lastFetchTime = 0;
    try {
      localStorage.removeItem(this.STORAGE_KEY_DATA);
      localStorage.removeItem(this.STORAGE_KEY_TIME);
    } catch (e) {}
    console.log('📦 [RutaService] Caché de rutas limpiado (memoria y localStorage)');
  }
}
