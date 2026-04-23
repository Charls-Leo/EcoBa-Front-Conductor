// =========================================================
// Modelo de dominio: Recorrido (asignación conductor-ruta-vehículo)
// =========================================================

export interface Recorrido {
  id?: string | number;
  id_recorrido?: string | number;
  ruta_id: string | number;
  vehiculo_id: string | number;
  conductor_id: string;
  activo: boolean;
  creado_en?: string;
  actualizado_en?: string;
}
