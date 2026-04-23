import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

// =========================================================
// TrackingStateService — Mantiene el estado global del recorrido activo
// =========================================================

@Injectable({
  providedIn: 'root'
})
export class TrackingStateService {
  private recorridoIdSubj = new BehaviorSubject<string | null>(null);
  readonly recorridoId$ = this.recorridoIdSubj.asObservable();
  
  private rutaIdSubj = new BehaviorSubject<string | null>(null);
  
  private vehiculoPlacaSubj = new BehaviorSubject<string | null>(null);
  private nombreRutaSubj = new BehaviorSubject<string | null>(null);

  setRecorrido(id: string | number, rutaId?: string | number, placa?: string, nombreRuta?: string): void {
    this.recorridoIdSubj.next(String(id));
    if (rutaId) this.rutaIdSubj.next(String(rutaId));
    if (placa) this.vehiculoPlacaSubj.next(placa);
    if (nombreRuta) this.nombreRutaSubj.next(nombreRuta);
  }

  clear(): void {
    this.recorridoIdSubj.next(null);
    this.rutaIdSubj.next(null);
    this.vehiculoPlacaSubj.next(null);
    this.nombreRutaSubj.next(null);
  }

  get recorridoActivo(): string | null {
    return this.recorridoIdSubj.value;
  }
  
  get rutaActiva(): string | null {
    return this.rutaIdSubj.value;
  }

  get vehiculoPlaca(): string | null {
    return this.vehiculoPlacaSubj.value;
  }

  get nombreRuta(): string | null {
    return this.nombreRutaSubj.value;
  }
}
