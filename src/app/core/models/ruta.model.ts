// =========================================================
// Modelo de dominio: Ruta
// =========================================================

export interface GeoJSONGeometry {
  type: 'LineString' | 'MultiLineString';
  coordinates: number[][] | number[][][];
}

export interface Ruta {
  id: string | number;
  nombre: string;
  nombre_ruta?: string;
  descripcion?: string;
  shape: GeoJSONGeometry | string;
  color_hex?: string;
  perfil_id?: string;
  creado_en?: string;
  actualizado_en?: string;
}
