const ESTADOS_CERRADOS = ["entregada", "cancelada"]

const redondear = (valor) => Math.round(valor * 100) / 100

const estaCerrada = (estado) => ESTADOS_CERRADOS.includes(estado)

const buscarOrdenAbierta = (app, ordenId) => {
  let orden
  try {
    orden = app.findRecordById("ordenes", ordenId)
  } catch (_) {
    throw new BadRequestError("La orden indicada no existe.")
  }
  if (estaCerrada(orden.getString("estado"))) {
    throw new BadRequestError(`La orden está ${orden.getString("estado")} y ya no admite cambios.`)
  }
  return orden
}

const validarReduccion = (orden, reduccion) => {
  const nuevoTotal = redondear(orden.getFloat("total") - reduccion)
  const pagado = redondear(orden.getFloat("pagado"))
  if (reduccion > 0 && nuevoTotal < pagado) {
    throw new BadRequestError(`No se puede: el total quedaría en ${nuevoTotal.toFixed(2)} y el cliente ya pagó ${pagado.toFixed(2)}.`)
  }
}

const validarMecanico = (app, usuarioId) => {
  let usuario
  try {
    usuario = app.findRecordById("users", usuarioId)
  } catch (_) {
    throw new BadRequestError("El mecánico indicado no existe.")
  }
  if (usuario.getString("rol") !== "mecanico") {
    throw new BadRequestError("La orden solo se puede asignar a un usuario con rol mecánico.")
  }
}

const sumar = (registros, calcular) => {
  let total = 0
  for (const registro of registros) {
    total += calcular(registro)
  }
  return redondear(total)
}

const aplicarTotales = (app, orden) => {
  const filtro = "orden = {:orden}"
  const parametros = { orden: orden.id }
  const trabajos = app.findRecordsByFilter("trabajos", filtro, "", 0, 0, parametros)
  const repuestos = app.findRecordsByFilter("orden_repuestos", filtro, "", 0, 0, parametros)
  const pagos = app.findRecordsByFilter("pagos", filtro, "", 0, 0, parametros)

  const manoObra = sumar(trabajos, (t) => t.getFloat("precio"))
  const totalRepuestos = sumar(repuestos, (r) => r.getInt("cantidad") * r.getFloat("precio_unitario"))
  const pagado = sumar(pagos, (p) => p.getFloat("monto"))
  const total = redondear(manoObra + totalRepuestos)

  orden.set("total_mano_obra", manoObra)
  orden.set("total_repuestos", totalRepuestos)
  orden.set("total", total)
  orden.set("pagado", pagado)
  orden.set("saldo", redondear(total - pagado))
  return orden
}

const recalcularOrden = (app, ordenId) => {
  const orden = app.findRecordById("ordenes", ordenId)
  app.save(aplicarTotales(app, orden))
}

const ajustarExistencias = (app, repuestoId, diferencia) => {
  const repuesto = app.findRecordById("repuestos", repuestoId)
  repuesto.set("existencias", repuesto.getInt("existencias") + diferencia)
  app.save(repuesto)
}

const enTransaccion = (e, accion) => {
  const appOriginal = e.app
  appOriginal.runInTransaction((txApp) => {
    e.app = txApp
    try {
      accion(txApp)
    } finally {
      e.app = appOriginal
    }
  })
}

module.exports = {
  redondear,
  estaCerrada,
  buscarOrdenAbierta,
  validarReduccion,
  validarMecanico,
  aplicarTotales,
  recalcularOrden,
  ajustarExistencias,
  enTransaccion,
}
