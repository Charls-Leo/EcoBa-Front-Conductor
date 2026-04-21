import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

interface LoginResponse {
  ok: boolean;
  token: string;
  usuario: {
    id_usuario: string;
    email: string;
    id_rol: number;
    nombre: string;
    apellido: string;
  };
}

interface RegisterResponse {
  ok: boolean;
  usuario: {
    id_usuario: string;
    email: string;
    id_rol: number;
    nombre: string;
    apellido: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEY = 'ecobahia_driver_auth';
  private readonly USER_KEY = 'ecobahia_driver_user';
  private readonly TOKEN_KEY = 'ecobahia_driver_token';

  private apiUrl = `${environment.API_BASE_URL}/usuarios`;

  constructor(private http: HttpClient) {}

  /**
   * Login real contra el backend - solo conductores (id_rol=2)
   */
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login-conductor`, { email, password })
      .pipe(
        tap(response => {
          if (response.ok) {
            this.guardarSesion(response.token, response.usuario);
          }
        })
      );
  }

  /**
   * Registro real contra el backend con id_rol=2 (conductor)
   */
  register(data: { email: string; password: string; nombre: string; apellido: string }): Observable<RegisterResponse> {
    const body = { ...data, id_rol: 2 };
    return this.http.post<RegisterResponse>(`${this.apiUrl}/register`, body);
  }

  /**
   * Guardar sesión localmente
   */
  private guardarSesion(token: string, usuario: any): void {
    localStorage.setItem(this.STORAGE_KEY, 'true');
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(usuario));
  }

  /**
   * Verificar si hay sesión activa
   */
  isLoggedIn(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) === 'true' && !!this.getToken();
  }

  /**
   * Obtener el JWT guardado
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Obtener datos del usuario guardado
   */
  getUser(): any | null {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  /**
   * Obtener perfil actualizado desde el backend
   */
  getPerfil(): Observable<any> {
    return this.http.get(`${this.apiUrl}/me`, {
      headers: { Authorization: `Bearer ${this.getToken()}` }
    });
  }

  /**
   * Cerrar sesión
   */
  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }
}