import { pb, contar, esMecanico, esPersonal, mensajeError, suscribir } from "../api.js"
import { iniciarPagina } from "../plantilla.js"
import {
  $, ESTADOS, ESTADOS_ABIERTOS, dinero, entero, escapar, estadoVacio, esqueleto, fechaHora, insigniaEstado, retrasar,
} from "../ui.js"

const FILTRO_ABIERTAS = 'estado != "entregada" && estado != "cancelada"'

let filtroPropio = ""

const cargarSeccion = async (contenedor, obtenerHtml) => {
  if (!contenedor.innerHTML.trim()) contenedor.innerHTML = esqueleto(2)
  try {
    contenedor.innerHTML = await obtenerHtml()
  } catch (error) {
    contenedor.innerHTML = `<p class="nota nota--alerta">${escapar(mensajeError(error))}</p>`
  }
}

const kpi = (valor, etiqueta, enlace, variante = "") =>
  `<a class="kpi ${variante}" href="${enlace}"><span class="kpi__valor">${valor}</span><span class="kpi__etiqueta">${etiqueta}</span></a>`

const pintarKpis = async () => {
  const [abiertas, listas, stockBajo, saldos] = await Promise.all([
    contar("ordenes", FILTRO_ABIERTAS + filtroPropio),
    contar("ordenes", 'estado = "lista"' + filtroPropio),
    contar("repuestos", "existencias <= stock_minimo"),
    esPersonal() ? pb.collection("saldos_clientes").getFullList({ fields: "saldo" }) : Promise.resolve(null),
  ])
  const tarjetas = [
    kpi(entero(abiertas), esMecanico() ? "Mis órdenes abiertas" : "Órdenes abiertas", "ordenes.html", "kpi--acento"),
    kpi(entero(listas), "Listas para entregar", "ordenes.html?estado=lista"),
    kpi(entero(stockBajo), "Repuestos por agotarse", "repuestos.html?bajos=1", stockBajo > 0 ? "kpi--alerta" : ""),
  ]
  if (saldos) {
    const pendiente = saldos.reduce((total, fila) => total + fila.saldo, 0)
    tarjetas.push(kpi(dinero(pendiente), "Saldo pendiente de cobro", "reportes.html#saldos", pendiente > 0 ? "kpi--alerta" : ""))
  }
  return tarjetas.join("")
}

const pintarRecientes = async () => {
  const resultado = await pb.collection("ordenes").getList(1, 6, {
    filter: FILTRO_ABIERTAS + filtroPropio,
    sort: "-fecha_entrada",
    expand: "vehiculo,cliente,mecanico",
  })
  if (resultado.items.length === 0) return estadoVacio("No hay órdenes abiertas.")
  return `<div class="lista">${resultado.items.map((orden) => `
    <a class="fila" href="orden.html?id=${orden.id}">
      <span class="fila__titulo">${escapar(orden.expand?.vehiculo?.matricula)} · ${escapar(orden.expand?.vehiculo?.marca)} ${escapar(orden.expand?.vehiculo?.modelo)}</span>
      ${insigniaEstado(orden.estado)}
      <span class="fila__detalle">${escapar(orden.expand?.cliente?.nombre)} · ${escapar(orden.expand?.mecanico?.name)} · ${fechaHora(orden.fecha_entrada)}</span>
    </a>`).join("")}</div>`
}

const pintarEstados = async () => {
  const conteos = await Promise.all(
    ESTADOS_ABIERTOS.map((estado) => contar("ordenes", pb.filter("estado = {:estado}", { estado }) + filtroPropio)),
  )
  return `<div class="lista">${ESTADOS_ABIERTOS.map((estado, i) => `
    <a class="fila fila--compacta" href="ordenes.html?estado=${estado}">
      <span>${insigniaEstado(estado)}</span>
      <span class="fila__monto">${entero(conteos[i])}</span>
    </a>`).join("")}</div>`
}

const pintarCarga = async () => {
  const mecanicos = await pb.collection("carga_mecanicos").getFullList({ sort: "-abiertas,nombre" })
  if (mecanicos.length === 0) return estadoVacio("No hay mecánicos registrados.")
  const maximo = Math.max(1, ...mecanicos.map((m) => m.abiertas))
  return `<div class="lista">${mecanicos.map((m) => `
    <div class="fila fila--compacta">
      <span class="fila__titulo">${escapar(m.nombre)}</span>
      <span class="fila__monto">${entero(m.abiertas)} abiertas</span>
      <span class="fila__detalle">
        ${ESTADOS.recibida.texto}: ${m.recibidas} · Diagnóstico: ${m.en_diagnostico} · Reparación: ${m.en_reparacion} · Listas: ${m.listas}
        <span class="barra-progreso"><span style="width:${Math.round((m.abiertas / maximo) * 100)}%"></span></span>
      </span>
    </div>`).join("")}</div>`
}

const pintarStock = async () => {
  const repuestos = await pb.collection("repuestos").getFullList({ filter: "existencias <= stock_minimo", sort: "existencias,nombre" })
  if (repuestos.length === 0) return estadoVacio("Todo el inventario está por encima del mínimo.")
  return `<div class="lista">${repuestos.map((r) => `
    <div class="fila fila--compacta fila--alerta">
      <span class="fila__titulo">${escapar(r.nombre)}</span>
      <span class="insignia insignia--bajo">${entero(r.existencias)} / mín. ${entero(r.stock_minimo)}</span>
      <span class="fila__detalle">${escapar(r.codigo)}</span>
    </div>`).join("")}</div>`
}

const cargar = () =>
  Promise.allSettled([
    cargarSeccion($("#kpis"), pintarKpis),
    cargarSeccion($("#recientes"), pintarRecientes),
    cargarSeccion($("#estados"), pintarEstados),
    cargarSeccion($("#carga"), pintarCarga),
    cargarSeccion($("#stock"), pintarStock),
  ])

const saludar = (usuario) => {
  const hora = new Date().getHours()
  const momento = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches"
  $("#saludo").textContent = `${momento}, ${(usuario.name || "").split(" ")[0]}`
  $("#fecha-hoy").textContent = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
}

const usuario = await iniciarPagina("panel")

if (usuario) {
  saludar(usuario)
  if (esMecanico()) {
    filtroPropio = pb.filter(" && mecanico = {:id}", { id: usuario.id })
    $("#titulo-recientes").textContent = "Mis órdenes en curso"
  }
  $("#boton-nueva-orden").classList.toggle("oculto", !esPersonal())
  await cargar()
  const recargar = retrasar(cargar, 400)
  suscribir("ordenes", recargar)
  suscribir("repuestos", recargar)
}
