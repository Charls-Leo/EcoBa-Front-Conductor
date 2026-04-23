// =========================================================
// Modelo de dominio: Ubicación GPS y Tracking
// =========================================================

/** Datos de una lectura GPS individual */
export interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
  speed?: number | null;
  heading?: number | null;
}

/** Payload que se envía al backend con cada ubicación */
export interface TrackingPayload {
  conductor_id: string;
  location: LocationData;
  recorrido_id?: string | null;
}

/** Payload para envío batch de ubicaciones offline */
export interface TrackingBatchPayload {
  ubicaciones: TrackingPayload[];
}
