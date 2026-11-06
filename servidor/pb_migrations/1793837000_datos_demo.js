migrate((app) => {
  const crear = (coleccion, datos) => {
    const registro = new Record(app.findCollectionByNameOrId(coleccion), datos)
    app.save(registro)
    return registro
  }

  const crearUsuario = (email, nombre, rol) => {
    const usuario = new Record(app.findCollectionByNameOrId("users"))
    usuario.set("email", email)
    usuario.set("name", nombre)
    usuario.set("rol", rol)
    usuario.set("verified", true)
    usuario.set("emailVisibility", true)
    usuario.setPassword("piston2026")
    app.save(usuario)
    return usuario
  }

  const administrador = new Record(app.findCollectionByNameOrId("_superusers"))
  administrador.set("email", "admin@elpiston.cu")
  administrador.setPassword("admin-piston-2026")
  app.save(administrador)

  crearUsuario("dueno@elpiston.cu", "Ernesto Pérez", "dueno")
  crearUsuario("recepcion@elpiston.cu", "Yanelis Rodríguez", "recepcion")
  const raul = crearUsuario("raul@elpiston.cu", "Raúl Martínez", "mecanico")
  const yoandry = crearUsuario("yoandry@elpiston.cu", "Yoandry Díaz", "mecanico")

  const clientes = [
    ["Mayelín Hernández", "+53 5234 1187", "Calle Martí #45, Pinar del Río"],
    ["Osvaldo Cruz", "+53 5412 6630", "Reparto Hermanos Cruz, edif. 12"],
    ["Lázaro Fernández", "+53 5876 2041", ""],
    ["Daymí Suárez", "+53 5319 4478", "Carretera a Viñales km 3"],
    ["Rolando Acosta", "+53 5690 3312", "Calle Isabel Rubio #210"],
    ["Yudith Valdés", "+53 5245 9071", ""],
  ].map(([nombre, telefono, direccion]) => crear("clientes", { nombre, telefono, direccion }))

  const vehiculos = [
    [0, "P123456", "Lada", "2107", 1988, 184500],
    [0, "P654321", "Moskvich", "412", 1979, 231000],
    [1, "P210987", "Peugeot", "206", 2008, 156200],
    [2, "P334455", "Hyundai", "Accent", 2012, 98700],
    [3, "P778899", "Kia", "Rio", 2015, 74300],
    [4, "P101010", "Chevrolet", "Bel Air", 1956, 312400],
    [5, "P556677", "Geely", "CK", 2011, 121900],
  ].map(([cliente, matricula, marca, modelo, anio, kilometraje]) => crear("vehiculos", {
    cliente: clientes[cliente].id, matricula, marca, modelo, anio, kilometraje,
  }))

  const repuestos = [
    ["Aceite de motor 15W40 (1 L)", "ACE-15W40", 6.5, 24, 10],
    ["Filtro de aceite Lada", "FIL-ACE-LADA", 4.0, 3, 5],
    ["Filtro de aire universal", "FIL-AIRE-UNI", 5.5, 12, 4],
    ["Pastillas de freno delanteras", "PAS-FRE-DEL", 18.0, 2, 4],
    ["Bujía NGK", "BUJ-NGK", 3.2, 40, 12],
    ["Correa de distribución", "COR-DIST", 22.0, 5, 2],
    ["Líquido de frenos DOT4 (500 ml)", "LIQ-FRE-DOT4", 4.8, 1, 3],
    ["Batería 12V 60Ah", "BAT-12V60", 85.0, 4, 2],
    ["Amortiguador delantero", "AMO-DEL", 35.0, 6, 2],
    ["Bombillo H4", "BOM-H4", 2.5, 18, 6],
  ].map(([nombre, codigo, precio, existencias, stock_minimo]) => crear("repuestos", {
    nombre, codigo, precio, existencias, stock_minimo,
  }))

  const crearOrden = (datos, trabajos, usados, pagos) => {
    const vehiculo = vehiculos[datos.vehiculo]
    const orden = crear("ordenes", {
      vehiculo: vehiculo.id,
      cliente: vehiculo.getString("cliente"),
      mecanico: datos.mecanico.id,
      fecha_entrada: datos.entrada,
      fecha_entrega: datos.entrega || "",
      problema: datos.problema,
      kilometraje: vehiculo.getInt("kilometraje"),
      estado: datos.estado,
    })

    let manoObra = 0
    for (const [descripcion, precio] of trabajos) {
      crear("trabajos", { orden: orden.id, descripcion, precio })
      manoObra += precio
    }

    let totalRepuestos = 0
    for (const [indice, cantidad] of usados) {
      const repuesto = repuestos[indice]
      crear("orden_repuestos", {
        orden: orden.id,
        repuesto: repuesto.id,
        cantidad,
        precio_unitario: repuesto.getFloat("precio"),
      })
      totalRepuestos += cantidad * repuesto.getFloat("precio")
    }

    let pagado = 0
    for (const [monto, metodo] of pagos) {
      crear("pagos", { orden: orden.id, monto, metodo, nota: "" })
      pagado += monto
    }

    const total = Math.round((manoObra + totalRepuestos) * 100) / 100
    orden.set("total_mano_obra", manoObra)
    orden.set("total_repuestos", Math.round(totalRepuestos * 100) / 100)
    orden.set("total", total)
    orden.set("pagado", pagado)
    orden.set("saldo", Math.round((total - pagado) * 100) / 100)
    app.save(orden)
  }

  crearOrden(
    { vehiculo: 0, mecanico: raul, estado: "entregada", entrada: "2026-11-02 13:00:00.000Z", entrega: "2026-11-03 21:00:00.000Z", problema: "Cambio de aceite y revisión general antes de viaje." },
    [["Cambio de aceite y filtro", 10], ["Revisión de frenos", 8]],
    [[0, 4], [1, 1]],
    [[44, "efectivo"]],
  )
  crearOrden(
    { vehiculo: 2, mecanico: yoandry, estado: "entregada", entrada: "2026-11-01 14:30:00.000Z", entrega: "2026-11-04 20:00:00.000Z", problema: "Ruido al frenar en las ruedas delanteras." },
    [["Cambio de pastillas delanteras", 25], ["Purga del sistema de frenos", 12]],
    [[3, 1], [6, 1]],
    [[30, "transferencia"]],
  )
  crearOrden(
    { vehiculo: 3, mecanico: raul, estado: "reparacion", entrada: "2026-11-04 12:15:00.000Z", problema: "El motor pierde fuerza en las subidas y consume mucho combustible." },
    [["Diagnóstico de motor", 15], ["Cambio de bujías", 8]],
    [[4, 4]],
    [],
  )
  crearOrden(
    { vehiculo: 4, mecanico: yoandry, estado: "diagnostico", entrada: "2026-11-05 13:40:00.000Z", problema: "Luz de batería encendida en el tablero." },
    [],
    [],
    [],
  )
  crearOrden(
    { vehiculo: 5, mecanico: raul, estado: "lista", entrada: "2026-11-03 15:00:00.000Z", problema: "Cambio de correa de distribución y ajuste de carburador." },
    [["Cambio de correa de distribución", 40], ["Ajuste de carburador", 20]],
    [[5, 1]],
    [[40, "efectivo"]],
  )
  crearOrden(
    { vehiculo: 6, mecanico: yoandry, estado: "recibida", entrada: "2026-11-05 15:20:00.000Z", problema: "Vibración en el timón a más de 60 km/h." },
    [],
    [],
    [],
  )
  crearOrden(
    { vehiculo: 1, mecanico: raul, estado: "cancelada", entrada: "2026-10-28 14:00:00.000Z", problema: "Revisión de caja de velocidades. El cliente decidió no reparar." },
    [],
    [],
    [],
  )
}, (app) => {
  for (const coleccion of ["pagos", "orden_repuestos", "trabajos", "ordenes", "repuestos", "vehiculos", "clientes"]) {
    for (const registro of app.findAllRecords(coleccion)) {
      app.delete(registro)
    }
  }
  for (const email of ["dueno@elpiston.cu", "recepcion@elpiston.cu", "raul@elpiston.cu", "yoandry@elpiston.cu"]) {
    app.delete(app.findAuthRecordByEmail("users", email))
  }
  app.delete(app.findAuthRecordByEmail("_superusers", "admin@elpiston.cu"))
})
