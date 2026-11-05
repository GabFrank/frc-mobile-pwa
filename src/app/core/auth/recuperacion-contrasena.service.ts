import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, firstValueFrom, Observable, throwError, timeout } from 'rxjs';

import { ServerConfigService } from '../config/server-config.service';

/** Respuestas de `/public/recuperacion-contrasena` del central. */
export interface CaptchaRecuperacion {
  id: string;
  /** PNG en base64. */
  imagen: string;
}

export interface VerificacionRecuperacion {
  tipo: 'CORREO' | 'SIN_CORREO';
  solicitudId?: number;
  emailEnmascarado?: string;
  minutosVigencia?: number;
  verificacionToken?: string;
}

export interface SolicitudRrhhCreada {
  solicitudId: number;
  codigoSecreto: string;
  mensajeWhatsapp: string;
  horasParaAprobar: number;
}

export interface EstadoRecuperacion {
  solicitudId: number;
  tipo: 'CORREO' | 'RRHH';
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'VENCIDA' | 'COMPLETADA' | 'ANULADA';
  motivoRechazo?: string;
  puedeRestablecer: boolean;
  mensaje: string;
}

const TIMEOUT_MS = 30_000;

/**
 * «¿Olvidaste tu contraseña?» contra el central.
 *
 * REST y **sin sesión**: quien lo usa no puede entrar. Es el mismo contrato
 * que el diálogo del desktop (`recuperacion-contrasena.service.ts` de
 * `frc-sistemas-integrados-angular`). Las reglas —captcha, bloqueos,
 * vencimientos, intentos— son del central; acá solo se muestran sus mensajes.
 *
 * Devuelve promesas que rechazan con un `Error` cuyo mensaje ya está listo
 * para mostrar.
 */
@Injectable({ providedIn: 'root' })
export class RecuperacionContrasenaService {
  private readonly http = inject(HttpClient);
  private readonly servidor = inject(ServerConfigService);

  captcha(): Promise<CaptchaRecuperacion> {
    return this.pedir(this.http.get<CaptchaRecuperacion>(this.url('captcha')));
  }

  verificar(
    nickname: string,
    documento: string,
    captchaId: string,
    captchaRespuesta: string,
  ): Promise<VerificacionRecuperacion> {
    return this.post('verificar', { nickname, documento, captchaId, captchaRespuesta });
  }

  solicitudRrhh(
    verificacionToken: string,
    telefono: string,
    email: string,
    observacion: string | null,
  ): Promise<SolicitudRrhhCreada> {
    return this.post('solicitud-rrhh', { verificacionToken, telefono, email, observacion });
  }

  /** `documento` solo hace falta en las solicitudes a RRHH. */
  consultar(solicitudId: number, codigo: string, documento: string | null): Promise<EstadoRecuperacion> {
    return this.post('consultar', { solicitudId, codigo, documento });
  }

  restablecer(
    solicitudId: number,
    codigo: string,
    documento: string | null,
    nuevaContrasena: string,
  ): Promise<EstadoRecuperacion> {
    return this.post('restablecer', { solicitudId, codigo, documento, nuevaContrasena });
  }

  private url(ruta: string): string {
    return `${this.servidor.baseUrl()}/public/recuperacion-contrasena/${ruta}`;
  }

  private post<T>(ruta: string, cuerpo: object): Promise<T> {
    return this.pedir(this.http.post<T>(this.url(ruta), cuerpo));
  }

  private pedir<T>(origen: Observable<T>): Promise<T> {
    return firstValueFrom(
      origen.pipe(
        timeout(TIMEOUT_MS),
        catchError((e: unknown) =>
          throwError(() => new ErrorRecuperacion(mensajeDeRecuperacion(e), rechazoDelCentral(e))),
        ),
      ),
    );
  }
}

/**
 * Error con el mensaje listo para mostrar.
 *
 * `rechazado` dice si el central contestó que no (400): el pedido llegó y no
 * cambió nada. Si es `false` (red, timeout, 5xx) no se sabe si se aplicó.
 */
export class ErrorRecuperacion extends Error {
  constructor(
    mensaje: string,
    readonly rechazado: boolean,
  ) {
    super(mensaje);
  }
}

function rechazoDelCentral(e: unknown): boolean {
  return e instanceof HttpErrorResponse && e.status === 400;
}

/** Lo que se le muestra a la persona cuando algo falla. */
export function mensajeDeRecuperacion(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) {
      return 'No se pudo conectar con el servidor. Verificá la conexión e intentá de nuevo.';
    }
    // El central manda { message } en los rechazos previstos (datos que no
    // coinciden, bloqueos, vencimientos) y un texto genérico en los imprevistos.
    const delCentral = (e.error as { message?: unknown } | null)?.message;
    if (typeof delCentral === 'string' && delCentral.trim()) {
      return delCentral;
    }
    if (e.status === 404) {
      return 'El servidor todavía no tiene esta función. Avisá a soporte.';
    }
  }
  if ((e as Error)?.name === 'TimeoutError') {
    return 'El servidor no respondió a tiempo. Intentá de nuevo.';
  }
  return 'No se pudo procesar el pedido. Intentá de nuevo.';
}
