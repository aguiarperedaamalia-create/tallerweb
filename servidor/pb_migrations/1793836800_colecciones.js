const AUTENTICADO = '@request.auth.id != ""'
const DUENO = '@request.auth.rol = "dueno"'
const PERSONAL = '(@request.auth.rol = "dueno" || @request.auth.rol = "recepcion")'
const MECANICO_DE_LA_ORDEN = '(@request.auth.rol = "mecanico" && orden.mecanico = @request.auth.id)'

const fechasAutomaticas = () => [
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
]

migrate((app) => {
  const usuarios = app.findCollectionByNameOrId("users")
  usuarios.fields.add(new SelectField({
    name: "rol",
    values: ["dueno", "recepcion", "mecanico"],
    maxSelect: 1,
    required: true,
  }))
  usuarios.listRule = AUTENTICADO
  usuarios.viewRule = AUTENTICADO
  usuarios.createRule = DUENO
  usuarios.updateRule = `(id = @request.auth.id && @request.body.rol:isset = false) || ${DUENO}`
  usuarios.deleteRule = DUENO
  usuarios.manageRule = DUENO
  app.save(usuarios)

  const clientes = new Collection({
    type: "base",
    name: "clientes",
    listRule: AUTENTICADO,
    viewRule: AUTENTICADO,
    createRule: PERSONAL,
    updateRule: PERSONAL,
    deleteRule: DUENO,
    fields: [
      { name: "nombre", type: "text", required: true, min: 2, max: 120, presentable: true },
      { name: "telefono", type: "text", required: true, pattern: "^[0-9+ ()-]{6,20}$" },
      { name: "direccion", type: "text", max: 250 },
      ...fechasAutomaticas(),
    ],
    indexes: ["CREATE INDEX idx_clientes_nombre ON clientes (nombre)"],
  })
  app.save(clientes)

  const vehiculos = new Collection({
    type: "base",
    name: "vehiculos",
    listRule: AUTENTICADO,
    viewRule: AUTENTICADO,
    createRule: PERSONAL,
    updateRule: PERSONAL,
    deleteRule: DUENO,
    fields: [
      { name: "cliente", type: "relation", required: true, collectionId: clientes.id, maxSelect: 1, cascadeDelete: false },
      { name: "matricula", type: "text", required: true, pattern: "^[A-Z0-9-]{4,12}$", presentable: true },
      { name: "marca", type: "text", required: true, max: 60 },
      { name: "modelo", type: "text", required: true, max: 60 },
      { name: "anio", type: "number", required: true, onlyInt: true, min: 1940, max: 2100 },
      { name: "kilometraje", type: "number", onlyInt: true, min: 0 },
      ...fechasAutomaticas(),
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_vehiculos_matricula ON vehiculos (matricula)",
      "CREATE INDEX idx_vehiculos_cliente ON vehiculos (cliente)",
    ],
  })
  app.save(vehiculos)

  const repuestos = new Collection({
    type: "base",
    name: "repuestos",
    listRule: AUTENTICADO,
    viewRule: AUTENTICADO,
    createRule: PERSONAL,
    updateRule: PERSONAL,
    deleteRule: DUENO,
    fields: [
      { name: "nombre", type: "text", required: true, max: 120, presentable: true },
      { name: "codigo", type: "text", required: true, pattern: "^[A-Z0-9-]{2,30}$" },
      { name: "precio", type: "number", required: true, min: 0 },
      { name: "existencias", type: "number", onlyInt: true, min: 0 },
      { name: "stock_minimo", type: "number", onlyInt: true, min: 0 },
      ...fechasAutomaticas(),
    ],
    indexes: ["CREATE UNIQUE INDEX idx_repuestos_codigo ON repuestos (codigo)"],
  })
  app.save(repuestos)

  const ordenes = new Collection({
    type: "base",
    name: "ordenes",
    listRule: AUTENTICADO,
    viewRule: AUTENTICADO,
    createRule: PERSONAL,
    updateRule: `${PERSONAL} || (@request.auth.rol = "mecanico" && mecanico = @request.auth.id && @request.body.mecanico:isset = false && @request.body.estado != "entregada" && @request.body.estado != "cancelada")`,
    deleteRule: DUENO,
    fields: [
      { name: "vehiculo", type: "relation", required: true, collectionId: vehiculos.id, maxSelect: 1, cascadeDelete: false },
      { name: "cliente", type: "relation", collectionId: clientes.id, maxSelect: 1, cascadeDelete: false },
      { name: "mecanico", type: "relation", required: true, collectionId: usuarios.id, maxSelect: 1, cascadeDelete: false },
      { name: "fecha_entrada", type: "date", required: true },
      { name: "fecha_entrega", type: "date" },
      { name: "problema", type: "text", required: true, min: 3, max: 1000 },
      { name: "kilometraje", type: "number", onlyInt: true, min: 0 },
      {
        name: "estado",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["recibida", "diagnostico", "reparacion", "lista", "entregada", "cancelada"],
      },
      { name: "total_mano_obra", type: "number", min: 0 },
      { name: "total_repuestos", type: "number", min: 0 },
      { name: "total", type: "number", min: 0 },
      { name: "pagado", type: "number", min: 0 },
      { name: "saldo", type: "number" },
      ...fechasAutomaticas(),
    ],
    indexes: [
      "CREATE INDEX idx_ordenes_estado ON ordenes (estado)",
      "CREATE INDEX idx_ordenes_mecanico ON ordenes (mecanico)",
      "CREATE INDEX idx_ordenes_vehiculo ON ordenes (vehiculo)",
      "CREATE INDEX idx_ordenes_cliente ON ordenes (cliente)",
    ],
  })
  app.save(ordenes)

  const trabajos = new Collection({
    type: "base",
    name: "trabajos",
    listRule: AUTENTICADO,
    viewRule: AUTENTICADO,
    createRule: `${PERSONAL} || ${MECANICO_DE_LA_ORDEN}`,
    updateRule: `${PERSONAL} || ${MECANICO_DE_LA_ORDEN}`,
    deleteRule: `${PERSONAL} || ${MECANICO_DE_LA_ORDEN}`,
    fields: [
      { name: "orden", type: "relation", required: true, collectionId: ordenes.id, maxSelect: 1, cascadeDelete: true },
      { name: "descripcion", type: "text", required: true, min: 3, max: 200 },
      { name: "precio", type: "number", required: true, min: 0 },
      ...fechasAutomaticas(),
    ],
    indexes: ["CREATE INDEX idx_trabajos_orden ON trabajos (orden)"],
  })
  app.save(trabajos)

  const ordenRepuestos = new Collection({
    type: "base",
    name: "orden_repuestos",
    listRule: AUTENTICADO,
    viewRule: AUTENTICADO,
    createRule: `${PERSONAL} || ${MECANICO_DE_LA_ORDEN}`,
    updateRule: null,
    deleteRule: `${PERSONAL} || ${MECANICO_DE_LA_ORDEN}`,
    fields: [
      { name: "orden", type: "relation", required: true, collectionId: ordenes.id, maxSelect: 1, cascadeDelete: true },
      { name: "repuesto", type: "relation", required: true, collectionId: repuestos.id, maxSelect: 1, cascadeDelete: false },
      { name: "cantidad", type: "number", required: true, onlyInt: true, min: 1 },
      { name: "precio_unitario", type: "number", min: 0 },
      ...fechasAutomaticas(),
    ],
    indexes: [
      "CREATE INDEX idx_orden_repuestos_orden ON orden_repuestos (orden)",
      "CREATE INDEX idx_orden_repuestos_repuesto ON orden_repuestos (repuesto)",
    ],
  })
  app.save(ordenRepuestos)

  const pagos = new Collection({
    type: "base",
    name: "pagos",
    listRule: PERSONAL,
    viewRule: PERSONAL,
    createRule: PERSONAL,
    updateRule: null,
    deleteRule: DUENO,
    fields: [
      { name: "orden", type: "relation", required: true, collectionId: ordenes.id, maxSelect: 1, cascadeDelete: false },
      { name: "monto", type: "number", required: true, min: 0.01 },
      { name: "metodo", type: "select", required: true, maxSelect: 1, values: ["efectivo", "transferencia"] },
      { name: "nota", type: "text", max: 200 },
      ...fechasAutomaticas(),
    ],
    indexes: [
      "CREATE INDEX idx_pagos_orden ON pagos (orden)",
      "CREATE INDEX idx_pagos_created ON pagos (created)",
    ],
  })
  app.save(pagos)
}, (app) => {
  for (const nombre of ["pagos", "orden_repuestos", "trabajos", "ordenes", "repuestos", "vehiculos", "clientes"]) {
    app.delete(app.findCollectionByNameOrId(nombre))
  }
  const usuarios = app.findCollectionByNameOrId("users")
  usuarios.fields.removeByName("rol")
  usuarios.listRule = "id = @request.auth.id"
  usuarios.viewRule = "id = @request.auth.id"
  usuarios.createRule = ""
  usuarios.updateRule = "id = @request.auth.id"
  usuarios.deleteRule = "id = @request.auth.id"
  usuarios.manageRule = null
  app.save(usuarios)
})
