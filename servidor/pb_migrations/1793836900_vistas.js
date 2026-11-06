migrate((app) => {
  const saldos = new Collection({
    type: "view",
    name: "saldos_clientes",
    listRule: '@request.auth.rol = "dueno" || @request.auth.rol = "recepcion"',
    viewRule: '@request.auth.rol = "dueno" || @request.auth.rol = "recepcion"',
    viewQuery: `
      SELECT
        c.id AS id,
        c.nombre AS nombre,
        c.telefono AS telefono,
        CAST(COUNT(o.id) AS INTEGER) AS ordenes_pendientes,
        CAST(COALESCE(SUM(o.saldo), 0) AS REAL) AS saldo
      FROM clientes c
      JOIN ordenes o ON o.cliente = c.id
      WHERE o.saldo > 0 AND o.estado != 'cancelada'
      GROUP BY c.id
    `,
  })
  app.save(saldos)

  const carga = new Collection({
    type: "view",
    name: "carga_mecanicos",
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    viewQuery: `
      SELECT
        u.id AS id,
        u.name AS nombre,
        CAST(COUNT(o.id) AS INTEGER) AS abiertas,
        CAST(COALESCE(SUM(CASE WHEN o.estado = 'recibida' THEN 1 ELSE 0 END), 0) AS INTEGER) AS recibidas,
        CAST(COALESCE(SUM(CASE WHEN o.estado = 'diagnostico' THEN 1 ELSE 0 END), 0) AS INTEGER) AS en_diagnostico,
        CAST(COALESCE(SUM(CASE WHEN o.estado = 'reparacion' THEN 1 ELSE 0 END), 0) AS INTEGER) AS en_reparacion,
        CAST(COALESCE(SUM(CASE WHEN o.estado = 'lista' THEN 1 ELSE 0 END), 0) AS INTEGER) AS listas
      FROM users u
      LEFT JOIN ordenes o ON o.mecanico = u.id AND o.estado NOT IN ('entregada', 'cancelada')
      WHERE u.rol = 'mecanico'
      GROUP BY u.id
    `,
  })
  app.save(carga)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("carga_mecanicos"))
  app.delete(app.findCollectionByNameOrId("saldos_clientes"))
})
