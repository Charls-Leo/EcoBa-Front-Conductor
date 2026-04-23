import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Usuario } from '../models';

// =========================================================
// Servicio de dominio: Usuarios / Conductores
// Solo maneja /usuarios (no auth) — sin lógica de UI
// =========================================================

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {

  private readonly baseUrl = `${environment.API_BASE_URL}/usuarios`;

  constructor(private http: HttpClient) {}

  /** Obtiene todos los conductores */
  getConductores(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${this.baseUrl}/conductores`);
  }
}
