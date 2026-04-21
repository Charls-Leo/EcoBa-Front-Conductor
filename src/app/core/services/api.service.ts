import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private baseUrl = environment.API_BASE_URL;
  private _perfilId = environment.PERFIL_ID;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  /**
   * Headers con token JWT para rutas protegidas
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  // ======================================================
  // 📍 RUTAS
  // ======================================================

  getRutas(): Observable<any> {
    const params = new HttpParams().set('perfil_id', this._perfilId);
    return this.http.get<any>(`${this.baseUrl}/rutas`, { params });
  }

  getRutaPorId(id: string): Observable<any> {
    const params = new HttpParams().set('perfil_id', this._perfilId);
    return this.http.get<any>(`${this.baseUrl}/rutas/${id}`, { params });
  }

  // ======================================================
  // 📍 RECORRIDOS DEL CONDUCTOR
  // ======================================================

  /**
   * Obtener recorridos asignados al conductor logueado
   */
  getRecorridosConductor(): Observable<any> {
    const usuario = this.authService.getUser();
    if (!usuario) {
      return new Observable(subscriber => {
        subscriber.error('No hay usuario logueado');
      });
    }
    return this.http.get<any>(`${this.baseUrl}/recorridos_locales/conductor/${usuario.id_usuario}`);
  }

  /**
   * Obtener todos los recorridos (vista general)
   */
  getRecorridos(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/recorridos_locales`);
  }

  // ======================================================
  // 🚗 VEHÍCULOS (solo lectura desde móvil)
  // ======================================================

  getVehiculos(): Observable<any> {
    const params = new HttpParams().set('perfil_id', this._perfilId);
    return this.http.get<any[]>(`${this.baseUrl}/vehiculos`, { params });
  }

  // ======================================================
  // 👥 CONDUCTORES
  // ======================================================

  getConductores(): Observable<any> {
    return this.http.get<any[]>(`${this.baseUrl}/usuarios/conductores`);
  }
}
