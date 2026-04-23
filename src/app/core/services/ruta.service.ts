import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
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

  constructor(private http: HttpClient) {}

  /** Obtiene todas las rutas — normaliza la respuesta del backend */
  getRutas(): Observable<Ruta[]> {
    const params = new HttpParams().set('perfil_id', this.perfilId);
    return this.http.get<Ruta[] | RutasApiResponse>(this.baseUrl, { params }).pipe(
      map(response => {
        if (Array.isArray(response)) return response;
        return response.data || response.rutas || [];
      })
    );
  }

  /** Obtiene una ruta por su ID */
  getRutaPorId(id: string): Observable<Ruta> {
    const params = new HttpParams().set('perfil_id', this.perfilId);
    return this.http.get<Ruta>(`${this.baseUrl}/${id}`, { params });
  }
}
