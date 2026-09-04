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

  /**
   * Abrir una toma.
   *
   * ⚠️ **Más restrictivo que `inventario`, por el mismo motivo que
   * `lugares`.** `VER INVENTARIO` (36 usuarios) es mirar un conteo; abrir una
   * toma define el alcance de lo que se va a contar y termina, al
   * finalizarla, ajustando el stock de la sucursal contra lo contado.
   * `CREAR INVENTARIO` (29 usuarios) es exactamente el rol de quien arma la
   * toma.
   *
   * `frc-mobile` no pide ninguno: el botón «Nuevo inventario» cuelga del hub
   * y lo ve cualquiera que llegue al módulo.
   */
  inventarioAlta: [ROLES.ADMIN, ROLES.CREAR_INVENTARIO],

  /**
   * Sectores y zonas del depósito.
   *
   * ⚠️ **Más restrictivo que `inventario`, a propósito.** `VER INVENTARIO`
   * (36 usuarios) es para mirar un conteo; acá se crea y se borra la
   * geografía sobre la que se cuenta, y borrar un sector con conteos
   * encima es una operación que no se deshace desde la app. `CREAR
   * INVENTARIO` (29 usuarios) es quien arma la toma, que es exactamente
   * quien necesita definir dónde se cuenta.
   *
   * `frc-mobile` no pide nada: la pantalla cuelga de la toma y cualquiera
   * que llegue al inventario puede borrar zonas.
   */
  lugares: [ROLES.ADMIN, ROLES.CREAR_INVENTARIO],

  /** 257 usuarios tienen VER TRANSFERENCIA. */
  transferencias: [ROLES.ADMIN, ROLES.VER_TRANSFERENCIA],

  /**
   * Crear una transferencia.
   *
   * ⚠️ **Más restrictivo que `transferencias`, por el mismo motivo que
   * `inventarioAlta`.** `VER TRANSFERENCIA` (257 usuarios) es mirar el
   * movimiento de mercadería; crear una origina un documento que después
   * descuenta stock en una sucursal y lo carga en otra. `CREAR TRANSFERENCIA`
   * es exactamente el rol de quien la origina.
   *
   * `frc-mobile` declara el rol en su enum y **no lo usa en ningún lado**: el
   * botón «Crear una nueva transferencia» cuelga del hub y lo ve cualquiera
   * que entre al módulo.
   *
   * ⚠️ **Falta confirmar cuántos usuarios lo tienen asignado.** Si fueran cero
   * —como pasa con `TESORERIA CPP PAGAR`—, el alta quedaría visible solo para
   * ADMIN. El arreglo en ese caso es **asignar el rol**, no sacar el guard,
   * igual que con `recepcion`.
   */
  transferenciasAlta: [ROLES.ADMIN, ROLES.CREAR_TRANSFERENCIA],

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

  /**
   * Kiosco de marcación: la tablet de la puerta.
   *
   * ⚠️ **Marcación no lleva rol y el kiosco sí**, y no es una inconsistencia.
   * La marcación propia es autoservicio: el filtro es la persona en sesión y
   * cada uno ve lo suyo. El kiosco **marca por otros** —identifica un rostro
   * y registra la asistencia de quien reconoció—, así que esa premisa no lo
   * cubre. Dejarlo sin rol pondría en manos de cualquiera con sesión el
   * registro de asistencia de todo el personal.
   *
   * `RRHH GESTIONAR` es quien administra la asistencia. `frc-mobile` protege
   * la pantalla equivalente comparando `nickname === 'ADMIN'`, que además de
   * frágil no se puede delegar a nadie.
   */
  kioscoMarcacion: [ROLES.ADMIN, ROLES.RRHH_GESTIONAR],
} as const satisfies Record<string, readonly ROLES[]>;

export type AreaProtegida = keyof typeof PERMISOS;
