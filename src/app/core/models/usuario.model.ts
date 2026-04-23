// =========================================================
// Modelo de dominio: Usuario / Conductor
// =========================================================

export interface Usuario {
  id_usuario: string;
  email: string;
  id_rol: number;
  nombre: string;
  apellido: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  ok: boolean;
  token: string;
  usuario: Usuario;
}

export interface RegisterRequest {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  id_rol?: number;
}

export interface RegisterResponse {
  ok: boolean;
  usuario: Usuario;
}
