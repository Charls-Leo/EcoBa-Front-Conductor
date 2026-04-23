// =========================================================
// Modelo de dominio: Vehículo
// =========================================================

export interface Vehiculo {
  id: string | number;
  placa: string;
  marca?: string;
  modelo?: string;
  capacidad?: number;
  estado?: string;
  perfil_id?: string;
}
