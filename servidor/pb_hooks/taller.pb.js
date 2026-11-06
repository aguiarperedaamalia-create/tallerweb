onRecordCreateRequest((e) => {
  const taller = require(`${__hooks}/lib/taller.js`)

  let vehiculo
  try {
    vehiculo = e.app.findRecordById("vehiculos", e.record.getString("vehiculo"))
  } catch (_) {
    throw new BadRequestError("Seleccione un vehículo válido.")
  }
  taller.validarMecanico(e.app, e.record.getString("mecanico"))

  const kilometraje = e.record.getInt("kilometraje")
  const ultimoKilometraje = vehiculo.getInt("kilometraje")
  if (kilometraje > 0 && kilometraje < ultimoKilometraje) {
    throw new BadRequestError(`El kilometraje no puede ser menor que el último registrado (${ultimoKilometraje} km).`)
  }

  e.record.set("cliente", vehiculo.getString("cliente"))
  e.record.set("estado", "recibida")
  e.record.set("fecha_entrega", "")
  taller.aplicarTotales(e.app, e.record)

  taller.enTransaccion(e, (app) => {
    e.next()
    if (kilometraje > 0) {
      vehiculo.set("kilometraje", kilometraje)
      app.save(vehiculo)
    }
  })
}, "ordenes")

onRecordUpdateRequest((e) => {
  const taller = require(`${__hooks}/lib/taller.js`)
  const anterior = e.record.original()
  const estadoAnterior = anterior.getString("estado")
  const estadoNuevo = e.record.getString("estado")

  if (taller.estaCerrada(estadoAnterior)) {
    throw new BadRequestError(`La orden está ${estadoAnterior} y ya no admite cambios.`)
  }
  if (e.record.getString("vehiculo") !== anterior.getString("vehiculo")) {
    throw new BadRequestError("No se puede cambiar el vehículo de una orden existente.")
  }
  if (e.record.getString("mecanico") !== anterior.getString("mecanico")) {
    taller.validarMecanico(e.app, e.record.getString("mecanico"))
  }
  if (estadoNuevo === "cancelada") {
    const usados = e.app.findRecordsByFilter("orden_repuestos", "orden = {:orden}", "", 1, 0, { orden: e.record.id })
    if (usados.length > 0) {
      throw new BadRequestError("Retire los repuestos de la orden antes de cancelarla para devolverlos al inventario.")
    }
    if (anterior.getFloat("pagado") > 0) {
      throw new BadRequestError("No se puede cancelar una orden que ya tiene pagos registrados.")
    }
  }

  e.record.set("cliente", anterior.getString("cliente"))
  e.record.set("fecha_entrega", estadoNuevo === "entregada" ? new DateTime() : "")
  taller.aplicarTotales(e.app, e.record)

  e.next()
}, "ordenes")

onRecordDeleteRequest((e) => {
  const taller = require(`${__hooks}/lib/taller.js`)
  const pagos = e.app.findRecordsByFilter("pagos", "orden = {:orden}", "", 1, 0, { orden: e.record.id })
  if (pagos.length > 0) {
    throw new BadRequestError("No se puede eliminar una orden con pagos registrados. Cancélela en su lugar.")
  }

  taller.enTransaccion(e, (app) => {
    if (e.record.getString("estado") !== "entregada") {
      const usados = app.findRecordsByFilter("orden_repuestos", "orden = {:orden}", "", 0, 0, { orden: e.record.id })
      for (const usado of usados) {
        taller.ajustarExistencias(app, usado.getString("repuesto"), usado.getInt("cantidad"))
      }
    }
    e.next()
  })
}, "ordenes")

onRecordCreateRequest((e) => {
  const taller = require(`${__hooks}/lib/taller.js`)
  taller.buscarOrdenAbierta(e.app, e.record.getString("orden"))

  taller.enTransaccion(e, (app) => {
    e.next()
    taller.recalcularOrden(app, e.record.getString("orden"))
  })
}, "trabajos")

onRecordUpdateRequest((e) => {
  const taller = require(`${__hooks}/lib/taller.js`)
  if (e.record.getString("orden") !== e.record.original().getString("orden")) {
    throw new BadRequestError("Un trabajo no se puede mover a otra orden.")
  }
  const orden = taller.buscarOrdenAbierta(e.app, e.record.getString("orden"))
  taller.validarReduccion(orden, e.record.original().getFloat("precio") - e.record.getFloat("precio"))

  taller.enTransaccion(e, (app) => {
    e.next()
    taller.recalcularOrden(app, e.record.getString("orden"))
  })
}, "trabajos")

onRecordDeleteRequest((e) => {
  const taller = require(`${__hooks}/lib/taller.js`)
  const orden = taller.buscarOrdenAbierta(e.app, e.record.getString("orden"))
  taller.validarReduccion(orden, e.record.getFloat("precio"))

  taller.enTransaccion(e, (app) => {
    e.next()
    taller.recalcularOrden(app, e.record.getString("orden"))
  })
}, "trabajos")

onRecordCreateRequest((e) => {
  const taller = require(`${__hooks}/lib/taller.js`)
  taller.buscarOrdenAbierta(e.app, e.record.getString("orden"))

  let repuesto
  try {
    repuesto = e.app.findRecordById("repuestos", e.record.getString("repuesto"))
  } catch (_) {
    throw new BadRequestError("Seleccione un repuesto válido.")
  }

  const cantidad = e.record.getInt("cantidad")
  const existencias = repuesto.getInt("existencias")
  if (cantidad < 1) {
    throw new BadRequestError("La cantidad debe ser al menos 1.")
  }
  if (cantidad > existencias) {
    throw new BadRequestError(`Solo quedan ${existencias} unidades de ${repuesto.getString("nombre")}.`)
  }

  e.record.set("precio_unitario", repuesto.getFloat("precio"))

  taller.enTransaccion(e, (app) => {
    e.next()
    taller.ajustarExistencias(app, repuesto.id, -cantidad)
    taller.recalcularOrden(app, e.record.getString("orden"))
  })
}, "orden_repuestos")

onRecordDeleteRequest((e) => {
  const taller = require(`${__hooks}/lib/taller.js`)
  const orden = taller.buscarOrdenAbierta(e.app, e.record.getString("orden"))
  taller.validarReduccion(orden, e.record.getInt("cantidad") * e.record.getFloat("precio_unitario"))

  taller.enTransaccion(e, (app) => {
    e.next()
    taller.ajustarExistencias(app, e.record.getString("repuesto"), e.record.getInt("cantidad"))
    taller.recalcularOrden(app, e.record.getString("orden"))
  })
}, "orden_repuestos")

onRecordCreateRequest((e) => {
  const taller = require(`${__hooks}/lib/taller.js`)
  let orden
  try {
    orden = e.app.findRecordById("ordenes", e.record.getString("orden"))
  } catch (_) {
    throw new BadRequestError("La orden indicada no existe.")
  }
  if (orden.getString("estado") === "cancelada") {
    throw new BadRequestError("No se pueden registrar pagos en una orden cancelada.")
  }

  const monto = taller.redondear(e.record.getFloat("monto"))
  const saldo = taller.redondear(orden.getFloat("saldo"))
  if (monto <= 0) {
    throw new BadRequestError("El monto debe ser mayor que cero.")
  }
  if (monto > saldo) {
    throw new BadRequestError(`El pago supera el saldo pendiente de la orden (${saldo.toFixed(2)}).`)
  }
  e.record.set("monto", monto)

  taller.enTransaccion(e, (app) => {
    e.next()
    taller.recalcularOrden(app, orden.id)
  })
}, "pagos")

onRecordDeleteRequest((e) => {
  const taller = require(`${__hooks}/lib/taller.js`)

  taller.enTransaccion(e, (app) => {
    e.next()
    taller.recalcularOrden(app, e.record.getString("orden"))
  })
}, "pagos")
