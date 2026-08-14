import { ROLES } from './roles.enum';

/**
 * Qué rol hace falta para cada área de la app.
 *
 * **Fuente única.** La consumen las dos capas: el menú, para no mostrar lo que
 * el usuario no puede usar, y `rolGuard`, para que escribir la URL a mano
 * tampoco entre. Declararlo en cada lugar es lo que hace que se
 * desincronicen — y cuando se desincronizan, la que sobra es la del menú:
 * esconder sin guardar no protege nada.
 *
 * ⚠️ **`ADMIN` va en todas.** No es un permiso más: es el que usa soporte para
 * entrar a mirar cuando alguien reporta algo.
 *
 * ---
 *
 * ## Lo que deliberadamente NO lleva rol
 *
 * | Área | Por qué |
 * |---|---|
 * | Buscar, ficha, kiosco, vencidos | Consultar un precio o un stock lo hace cualquiera en el salón. La base tiene `VER PRODUCTOS`, pero solo **91 de 404** usuarios lo tienen: exigirlo dejaría sin buscador a tres cuartos de la gente |
 * | Caja chica, Mi trabajo, Mis finanzas, Marcación | Autoservicio. Cada uno ve **lo suyo**, y el filtro es la persona en sesión, no un rol |
 * | Notificaciones, Mi cuenta | Ídem |
 * | Devoluciones | La carga la hace el personal de sucursal; el sistema no tiene un rol para esto |
 * | Solicitudes de pago | Correspondería `TESORERIA CPP PAGAR`, pero **ningún usuario lo tiene asignado**: exigirlo hoy lo escondería para todos menos ADMIN. Queda abierto hasta que los roles de tesorería se repartan |
 *
 * Conteo de usuarios por rol tomado de `personas.usuario_role` el 2026-08-14,
 * sobre 404 usuarios.
 */
export const PERMISOS = {
  /** Apertura, cierre y arqueo. 233 usuarios tienen VENTA TOUCH. */
  caja: [ROLES.ADMIN, ROLES.VENTA_TOUCH],

  /** 36 usuarios tienen VER INVENTARIO. */
  inventario: [ROLES.ADMIN, ROLES.VER_INVENTARIO],

  /** 257 usuarios tienen VER TRANSFERENCIA. */
  transferencias: [ROLES.ADMIN, ROLES.VER_TRANSFERENCIA],

  /**
   * ⚠️ **Solo 2 usuarios tienen RECIBIR PEDIDOS**, más los 28 ADMIN.
   *
   * Es el rol correcto para recibir mercadería, pero está muy poco repartido.
   * Si el personal de depósito reporta que la opción «no aparece», el arreglo
   * es asignarles el rol, no sacar el guard.
   */
  recepcion: [ROLES.ADMIN, ROLES.RECIBIR_PEDIDOS],

  /** Registrar el cupón del POS es trabajo de quien está en la caja. */
  ventaTarjeta: [ROLES.ADMIN, ROLES.VENTA_TOUCH],

  /**
   * Bandeja de aprobaciones de RRHH.
   *
   * ⚠️ Antes pedía `DIRECTIVO`, **un rol que no existe en la base**: el
   * chequeo daba siempre falso y solo entraba ADMIN, sin forma de delegarlo.
   * `RRHH APROBAR` sí existe. Hoy no lo tiene nadie asignado, así que en la
   * práctica sigue entrando solo ADMIN — la diferencia es que ahora **se
   * puede dar**.
   */
  aprobacionesRrhh: [ROLES.ADMIN, ROLES.RRHH_APROBAR],
} as const satisfies Record<string, readonly ROLES[]>;

export type AreaProtegida = keyof typeof PERMISOS;
