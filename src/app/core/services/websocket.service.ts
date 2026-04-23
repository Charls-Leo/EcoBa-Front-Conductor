import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';

// =========================================================
// WebSocketService — Capa de comunicación en tiempo real
// Implementado con Socket.IO para compatibilidad con backend
// =========================================================

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WebSocketMessage {
  event: string;
  data: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {

  /** Estado de la conexión */
  private statusSubject = new BehaviorSubject<ConnectionStatus>('disconnected');
  readonly connectionStatus$ = this.statusSubject.asObservable();

  /** Mensajes entrantes del servidor (opcional) */
  private messageSubject = new Subject<WebSocketMessage>();
  readonly messages$ = this.messageSubject.asObservable();

  /** Referencia al cliente Socket.IO */
  private socket: Socket | null = null;

  /** URL del servidor Socket.IO (remueve el /api del endpoint) */
  private readonly serverUrl = environment.API_BASE_URL.replace(/\/api$/, '');

  // -----------------------------------------------------------
  // Conexión
  // -----------------------------------------------------------

  /** Conectar al servidor Socket.IO con JWT */
  connect(token: string): void {
    if (this.socket && this.socket.connected) {
      return; // Ya conectado
    }

    this.statusSubject.next('connecting');

    try {
      // Se conecta enviando el token en el objeto auth (como espera el backend)
      this.socket = io(this.serverUrl, {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        this.statusSubject.next('connected');
        console.log('[WebSocketService] Conectado al servidor Socket.IO');
      });

      this.socket.on('connect_error', (err) => {
        this.statusSubject.next('error');
        console.error('[WebSocketService] Error de conexión Socket.IO:', err.message);
      });

      this.socket.on('disconnect', (reason) => {
        this.statusSubject.next('disconnected');
        console.log('[WebSocketService] Desconectado:', reason);
      });

      // Escuchar eventos dinámicos si se requiere
      this.socket.onAny((event, ...args) => {
        this.messageSubject.next({ event, data: args[0] });
      });

    } catch (err) {
      this.statusSubject.next('error');
      console.error('[WebSocketService] Error al inicializar Socket.IO:', err);
    }
  }

  // -----------------------------------------------------------
  // Envío de datos
  // -----------------------------------------------------------

  /** Enviar evento con datos al servidor */
  send(event: string, data: unknown): boolean {
    if (!this.socket || !this.socket.connected) {
      console.warn('[WebSocketService] No conectado — mensaje descartado:', event);
      return false;
    }

    this.socket.emit(event, data);
    return true;
  }

  // -----------------------------------------------------------
  // Desconexión
  // -----------------------------------------------------------

  /** Desconectar del servidor */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.statusSubject.next('disconnected');
    }
  }

  /** ¿Está conectado? */
  get isConnected(): boolean {
    return this.socket !== null && this.socket.connected;
  }
}
