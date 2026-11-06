import { pb, esDueno, esPersonal, mensajeError, suscribir } from "../api.js"
import { iniciarPagina } from "../plantilla.js"
import {
  $, ESTADOS, ESTADOS_ABIERTOS, aviso, conCarga, confirmar, datosFormulario, dinero, entero, escapar, estaCerrada,
  estadoVacio, fechaHora, insigniaEstado, mostrarErrorFormulario, parametro, retrasar,
} from "../ui.js"

const ordenId = parametro("id")
const PASOS = ["recibida", "diagnostico", "reparacion", "lista", "entregada"]

const contexto = {
  usuario: null,
  orden: null,
  trabajos: [],
  repuestosUsados: [],
  pagos: [],
  inventario: [],
  mecanicos: [],
}

const puedeEditar = () =>
  !estaCerrada(contexto.orden.estado) && (esPersonal() || contexto.orden.mecanico === contexto.usuario.id)

const pintarCabecera = () => {
  const { orden } = contexto
  const vehiculo = orden.expand?.vehiculo
  document.title = `Orden ${vehiculo?.matricula ?? ""} · El Pistón`
  $("#titulo-orden").innerHTML = `Orden ${escapar(vehiculo?.matricula)} ${insigniaEstado(orden.estado)}`
  $("#subtitulo-orden").textContent = `${vehiculo?.marca ?? ""} ${vehiculo?.modelo ?? ""} · Entrada ${fechaHora(orden.fecha_entrada)}`

  const nota = $("#nota-orden")
  if (estaCerrada(orden.estado)) {
    nota.textContent = orden.estado === "entregada"
      ? `Orden entregada el ${fechaHora(orden.fecha_entrega)}. Solo se pueden registrar pagos pendientes.`
      : "Orden cancelada. No admite cambios."
    nota.classList.remove("oculto")
  } else if (!puedeEditar()) {
    nota.textContent = "Esta orden está asignada a otro mecánico. Puede consultarla, pero no modificarla."
    nota.classList.remove("oculto")
  } else {
    nota.classList.add("oculto")
  }
}

const pintarAccionesEstado = () => {
  const { orden } = contexto
  const contenedor = $("#acciones-estado")
  if (!puedeEditar()) {
    contenedor.innerHTML = ""
    return
  }
  const siguiente = ESTADOS[orden.estado].siguiente
  const opciones = ESTADOS_ABIERTOS
    .filter((estado) => estado !== orden.estado)
    .map((estado) => `<option value="${estado}">${ESTADOS[estado].texto}</option>`).join("")
  const puedeEntregar = siguiente !== "entregada" || esPersonal()
  contenedor.innerHTML = `
    ${siguiente && puedeEntregar ? `<button type="button" class="boton ${siguiente === "entregada" ? "boton--exito" : ""}" data-estado="${siguiente}">${siguiente === "entregada" ? "Entregar al cliente" : `Pasar a: ${ESTADOS[siguiente].texto}`}</button>` : ""}
    <select class="buscador buscador--auto" id="cambiar-estado" aria-label="Cambiar estado">
      <option value="">Cambiar estado…</option>${opciones}
    </select>
    ${esPersonal() ? '<button type="button" class="boton boton--secundario" data-estado="cancelada">Cancelar orden</button>' : ""}`
}

const pintarFicha = () => {
  const { orden, mecanicos } = contexto
  const vehiculo = orden.expand?.vehiculo
  const cliente = orden.expand?.cliente
  const indiceActual = PASOS.indexOf(orden.estado)
  const selectorMecanico = esPersonal() && !estaCerrada(orden.estado)
    ? `<select class="buscador" id="cambiar-mecanico" aria-label="Mecánico asignado">${mecanicos
      .map((m) => `<option value="${m.id}" ${m.id === orden.mecanico ? "selected" : ""}>${escapar(m.name)}</option>`).join("")}</select>`
    : escapar(orden.expand?.mecanico?.name)

  $("#ficha-orden").innerHTML = `
    <dl class="datos">
      <div><dt>Cliente</dt><dd>${esPersonal() ? `<a href="cliente.html?id=${cliente?.id}">${escapar(cliente?.nombre)}</a>` : escapar(cliente?.nombre)}</dd></div>
      <div><dt>Teléfono</dt><dd><a href="tel:${escapar(cliente?.telefono)}">${escapar(cliente?.telefono)}</a></dd></div>
      <div><dt>Vehículo</dt><dd>${esPersonal() ? `<a href="vehiculo.html?id=${vehiculo?.id}">${escapar(vehiculo?.matricula)}</a>` : escapar(vehiculo?.matricula)} · ${escapar(vehiculo?.marca)} ${escapar(vehiculo?.modelo)} ${vehiculo?.anio ?? ""}</dd></div>
      <div><dt>Kilometraje de llegada</dt><dd>${orden.kilometraje ? `${entero(orden.kilometraje)} km` : "No registrado"}</dd></div>
      <div><dt>Mecánico</dt><dd>${selectorMecanico}</dd></div>
      <div><dt>Entrega</dt><dd>${orden.fecha_entrega ? fechaHora(orden.fecha_entrega) : "Pendiente"}</dd></div>
    </dl>
    <dl class="datos separado">
      <div><dt>Problema reportado</dt><dd class="texto-normal">${escapar(orden.problema)}</dd></div>
    </dl>
    ${orden.estado === "cancelada" ? "" : `<ol class="pasos" aria-label="Progreso de la orden">${PASOS.map((paso, i) => `
      <li class="paso ${i < indiceActual ? "paso--hecho" : ""} ${i === indiceActual ? "paso--actual" : ""}">${ESTADOS[paso].texto}</li>`).join("")}</ol>`}`
}

const botonEliminar = (coleccion, id, etiqueta) =>
  `<button type="button" class="boton boton--icono" data-eliminar="${coleccion}" data-id="${id}" aria-label="Quitar ${escapar(etiqueta)}">✕</button>`

const pintarTrabajos = () => {
  const editable = puedeEditar()
  const { trabajos, orden } = contexto
  $("#tabla-trabajos").innerHTML = trabajos.length === 0
    ? estadoVacio("Todavía no se han anotado trabajos.")
    : `<div class="tabla-contenedor"><table class="tabla">
        <thead><tr><th>Trabajo</th><th class="numero">Precio</th>${editable ? "<th></th>" : ""}</tr></thead>
        <tbody>${trabajos.map((t) => `
          <tr><td>${escapar(t.descripcion)}</td><td class="numero">${dinero(t.precio)}</td>
          ${editable ? `<td class="numero">${botonEliminar("trabajos", t.id, t.descripcion)}</td>` : ""}</tr>`).join("")}
        </tbody>
        <tfoot><tr><td>Total mano de obra</td><td class="numero">${dinero(orden.total_mano_obra)}</td>${editable ? "<td></td>" : ""}</tr></tfoot>
      </table></div>`
  $("#formulario-trabajo").classList.toggle("oculto", !editable)
}

const pintarRepuestos = () => {
  const editable = puedeEditar()
  const { repuestosUsados, orden } = contexto
  $("#tabla-repuestos").innerHTML = repuestosUsados.length === 0
    ? estadoVacio("No se han usado repuestos.")
    : `<div class="tabla-contenedor"><table class="tabla">
        <thead><tr><th>Repuesto</th><th class="numero">Cant.</th><th class="numero">Precio</th><th class="numero">Subtotal</th>${editable ? "<th></th>" : ""}</tr></thead>
        <tbody>${repuestosUsados.map((u) => `
          <tr><td>${escapar(u.expand?.repuesto?.nombre)}<br><small class="texto-suave">${escapar(u.expand?.repuesto?.codigo)}</small></td>
          <td class="numero">${entero(u.cantidad)}</td><td class="numero">${dinero(u.precio_unitario)}</td>
          <td class="numero">${dinero(u.cantidad * u.precio_unitario)}</td>
          ${editable ? `<td class="numero">${botonEliminar("orden_repuestos", u.id, u.expand?.repuesto?.nombre)}</td>` : ""}</tr>`).join("")}
        </tbody>
        <tfoot><tr><td colspan="3">Total repuestos</td><td class="numero">${dinero(orden.total_repuestos)}</td>${editable ? "<td></td>" : ""}</tr></tfoot>
      </table></div>`

  $("#selector-repuesto").innerHTML = '<option value="">Seleccione un repuesto</option>' + contexto.inventario.map((r) => `
    <option value="${r.id}" ${r.existencias === 0 ? "disabled" : ""}>${escapar(r.nombre)} · ${dinero(r.precio)} · ${r.existencias === 0 ? "agotado" : `${entero(r.existencias)} disp.`}</option>`).join("")
  $("#formulario-repuesto").classList.toggle("oculto", !editable)
}

const pintarResumen = () => {
  const { orden } = contexto
  const porcentaje = orden.total > 0 ? Math.min(100, Math.round((orden.pagado / orden.total) * 100)) : 0
  $("#resumen").innerHTML = `
    <dl class="resumen">
      <div><dt>Mano de obra</dt><dd>${dinero(orden.total_mano_obra)}</dd></div>
      <div><dt>Repuestos</dt><dd>${dinero(orden.total_repuestos)}</dd></div>
      <div class="resumen__total"><dt>Total</dt><dd>${dinero(orden.total)}</dd></div>
      <div><dt>Pagado</dt><dd>${dinero(orden.pagado)}</dd></div>
      <div class="resumen__saldo ${orden.saldo <= 0 ? "resumen__saldo--cero" : ""}"><dt>Saldo pendiente</dt><dd>${dinero(orden.saldo)}</dd></div>
    </dl>
    <div class="barra-progreso" role="progressbar" aria-valuenow="${porcentaje}" aria-valuemin="0" aria-valuemax="100" aria-label="Porcentaje pagado"><span style="width:${porcentaje}%"></span></div>
    <p class="texto-suave texto-pequeno">${porcentaje}% pagado</p>`
}

const pintarPagos = () => {
  if (!esPersonal()) return
  const { pagos, orden } = contexto
  $("#seccion-pagos").classList.remove("oculto")
  $("#lista-pagos").innerHTML = pagos.length === 0
    ? estadoVacio("Sin pagos registrados.")
    : `<ul class="lista">${pagos.map((p) => `
        <li class="fila fila--compacta">
          <span class="fila__titulo">${dinero(p.monto)}</span>
          ${esDueno() ? botonEliminar("pagos", p.id, `pago de ${dinero(p.monto)}`) : ""}
          <span class="fila__detalle">${fechaHora(p.created)} · ${p.metodo === "efectivo" ? "Efectivo" : "Transferencia"}${p.nota ? ` · ${escapar(p.nota)}` : ""}</span>
        </li>`).join("")}</ul>`
  const admitePagos = orden.estado !== "cancelada" && orden.saldo > 0
  $("#formulario-pago").classList.toggle("oculto", !admitePagos)
  $("#monto-pago").max = orden.saldo
}

const pintarTodo = () => {
  pintarCabecera()
  pintarAccionesEstado()
  pintarFicha()
  pintarTrabajos()
  pintarRepuestos()
  pintarResumen()
  pintarPagos()
}

const cargar = async () => {
  const filtro = pb.filter("orden = {:orden}", { orden: ordenId })
  const [orden, trabajos, repuestosUsados, pagos, inventario] = await Promise.all([
    pb.collection("ordenes").getOne(ordenId, { expand: "vehiculo,cliente,mecanico" }),
    pb.collection("trabajos").getFullList({ filter: filtro, sort: "created" }),
    pb.collection("orden_repuestos").getFullList({ filter: filtro, sort: "created", expand: "repuesto" }),
    esPersonal() ? pb.collection("pagos").getFullList({ filter: filtro, sort: "created" }) : Promise.resolve([]),
    pb.collection("repuestos").getFullList({ sort: "nombre", fields: "id,nombre,codigo,precio,existencias" }),
  ])
  Object.assign(contexto, { orden, trabajos, repuestosUsados, pagos, inventario })
  pintarTodo()
}

const recargar = async () => {
  try {
    await cargar()
  } catch (error) {
    aviso(mensajeError(error), "error")
  }
}

const cambiarEstado = async (boton, estado) => {
  const { orden } = contexto
  if (estado === "entregada") {
    const mensaje = orden.saldo > 0
      ? `El cliente todavía debe ${dinero(orden.saldo)}. ¿Entregar el vehículo de todas formas?`
      : "¿Confirmar la entrega del vehículo al cliente?"
    if (!(await confirmar(mensaje, "Entregar"))) return
  }
  if (estado === "cancelada" && !(await confirmar("¿Cancelar esta orden? Ya no se podrá modificar.", "Cancelar orden"))) return
  await conCarga(boton, async () => {
    try {
      await pb.collection("ordenes").update(orden.id, { estado })
      aviso(`Orden actualizada: ${ESTADOS[estado].texto}.`)
      await recargar()
    } catch (error) {
      aviso(mensajeError(error), "error")
    }
  })
}

const enviarFormulario = (formulario, accion) => {
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault()
    if (!formulario.checkValidity()) {
      formulario.reportValidity()
      return
    }
    const datos = datosFormulario(formulario)
    await conCarga(formulario.querySelector("button[type=submit]"), async () => {
      try {
        await accion(datos)
        formulario.reset()
        await recargar()
      } catch (error) {
        mostrarErrorFormulario(formulario, mensajeError(error))
      }
    })
  })
}

const conectarEventos = () => {
  $("#acciones-estado").addEventListener("click", (evento) => {
    const boton = evento.target.closest("button[data-estado]")
    if (boton) cambiarEstado(boton, boton.dataset.estado)
  })
  $("#acciones-estado").addEventListener("change", (evento) => {
    if (evento.target.id === "cambiar-estado" && evento.target.value) cambiarEstado(null, evento.target.value)
  })
  $("#ficha-orden").addEventListener("change", async (evento) => {
    if (evento.target.id !== "cambiar-mecanico") return
    try {
      await pb.collection("ordenes").update(ordenId, { mecanico: evento.target.value })
      aviso("Mecánico reasignado.")
      await recargar()
    } catch (error) {
      aviso(mensajeError(error), "error")
    }
  })
  document.addEventListener("click", async (evento) => {
    const boton = evento.target.closest("[data-eliminar]")
    if (!boton) return
    if (!(await confirmar(`¿Quitar este registro? ${boton.dataset.eliminar === "orden_repuestos" ? "El repuesto volverá al inventario." : ""}`, "Quitar"))) return
    await conCarga(boton, async () => {
      try {
        await pb.collection(boton.dataset.eliminar).delete(boton.dataset.id)
        aviso("Registro eliminado.")
        await recargar()
      } catch (error) {
        aviso(mensajeError(error), "error")
      }
    })
  })
  enviarFormulario($("#formulario-trabajo"), (datos) => pb.collection("trabajos").create({
    orden: ordenId,
    descripcion: datos.descripcion.trim(),
    precio: Number(datos.precio),
  }))
  enviarFormulario($("#formulario-repuesto"), (datos) => pb.collection("orden_repuestos").create({
    orden: ordenId,
    repuesto: datos.repuesto,
    cantidad: Number(datos.cantidad),
  }))
  enviarFormulario($("#formulario-pago"), async (datos) => {
    await pb.collection("pagos").create({
      orden: ordenId,
      monto: Number(datos.monto),
      metodo: datos.metodo,
      nota: datos.nota.trim(),
    })
    aviso("Pago registrado.")
  })
  $("#boton-saldo-completo").addEventListener("click", () => {
    $("#monto-pago").value = contexto.orden.saldo.toFixed(2)
  })
  $("#selector-repuesto").addEventListener("change", (evento) => {
    const repuesto = contexto.inventario.find((r) => r.id === evento.target.value)
    $("#cantidad-repuesto").max = repuesto?.existencias ?? ""
  })
}

const suscribirCambios = () => {
  const refrescar = retrasar(recargar, 400)
  suscribir("ordenes", refrescar, ordenId)
  for (const coleccion of ["trabajos", "orden_repuestos", "pagos"]) {
    suscribir(coleccion, ({ record }) => {
      if (record.orden === ordenId) refrescar()
    })
  }
}

contexto.usuario = await iniciarPagina("ordenes")

if (contexto.usuario) {
  if (!ordenId) {
    location.replace("ordenes.html")
  } else {
    try {
      contexto.mecanicos = await pb.collection("users").getFullList({ filter: 'rol = "mecanico"', sort: "name", fields: "id,name" })
      await cargar()
      conectarEventos()
      suscribirCambios()
    } catch (error) {
      $("#ficha-orden").innerHTML = `<p class="nota nota--alerta">${escapar(error.status === 404 ? "La orden no existe o no tiene acceso a ella." : mensajeError(error))}</p>`
    }
  }
}
