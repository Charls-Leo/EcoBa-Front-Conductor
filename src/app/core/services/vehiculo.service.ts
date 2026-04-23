import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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

  constructor(private http: HttpClient) {}

  /** Obtiene todos los vehículos */
  getVehiculos(): Observable<Vehiculo[]> {
    const params = new HttpParams().set('perfil_id', this.perfilId);
    return this.http.get<Vehiculo[]>(this.baseUrl, { params });
  }
}
