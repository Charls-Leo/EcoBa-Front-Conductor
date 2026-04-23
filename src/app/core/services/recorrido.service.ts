import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Recorrido } from '../models';
import { AuthService } from './auth.service';

// =========================================================
// Servicio de dominio: Recorridos del conductor
// Solo maneja /recorridos_locales — sin lógica de UI
// =========================================================

@Injectable({
  providedIn: 'root'
})
export class RecorridoService {

  private readonly baseUrl = `${environment.API_BASE_URL}/recorridos_locales`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  /** Obtiene recorridos asignados al conductor logueado */
  getRecorridosConductor(): Observable<Recorrido[]> {
    const usuario = this.authService.getUser();
    if (!usuario) {
      return new Observable(subscriber => {
        subscriber.error('No hay usuario logueado');
      });
    }
    return this.http.get<Recorrido[]>(`${this.baseUrl}/conductor/${usuario.id_usuario}`);
  }

  getRecorridos(): Observable<Recorrido[]> {
    return this.http.get<Recorrido[]>(this.baseUrl);
  }

  /** Activa un recorrido en la base de datos */
  activarRecorrido(id: string | number): Observable<any> {
    return this.http.post(`${this.baseUrl}/${id}/activar`, {});
  }

  /** Desactiva un recorrido en la base de datos */
  desactivarRecorrido(id: string | number): Observable<any> {
    return this.http.post(`${this.baseUrl}/${id}/desactivar`, {});
  }
}
