import { pb, esMecanico, esPersonal, mensajeError, suscribir } from "../api.js"
import { POR_PAGINA } from "../config.js"
import { iniciarPagina } from "../plantilla.js"
import {
  $, ESTADOS, ESTADOS_ABIERTOS, abrirDialogo, aviso, aIsoServidor, cerrarDialogo, conCarga, datosFormulario, dinero, entero,
  escapar, estadoVacio, esqueleto, fechaHora, insigniaEstado, mostrarErrorFormulario, paginacion, parametro, retrasar,
  valorFechaHoraLocal,
} from "../ui.js"

const FILTROS_ESTADO = [
  { id: "abiertas", texto: "Abiertas" },
  ...Object.entries(ESTADOS).map(([id, { texto }]) => ({ id, texto })),
  { id: "todas", texto: "Todas" },
]

const estadoVista = {
  estado: parametro("estado") ?? "abiertas",
  busqueda: "",
  mecanico: "",
  pagina: 1,
}

const dialogo = $("#dialogo-orden")
const formulario = $("#formulario-orden")
const selectorCliente = $("#orden-cliente")
const selectorVehiculo = $("#orden-vehiculo")
let vehiculosCliente = []

const construirFiltro = () => {
  const partes = []
  if (estadoVista.estado === "abiertas") {
    partes.push(ESTADOS_ABIERTOS.map((estado) => pb.filter("estado = {:estado}", { estado })).join(" || "))
  } else if (estadoVista.estado !== "todas") {
    partes.push(pb.filter("estado = {:estado}", { estado: estadoVista.estado }))
  }
  if (estadoVista.mecanico) {
    partes.push(pb.filter("mecanico = {:mecanico}", { mecanico: estadoVista.mecanico }))
  }
  if (estadoVista.busqueda) {
    partes.push(pb.filter("vehiculo.matricula ~ {:q} || cliente.nombre ~ {:q}", { q: estadoVista.busqueda }))
  }
  return partes.map((parte) => `(${parte})`).join(" && ")
}

const pintarChips = () => {
  $("#chips-estado").innerHTML = FILTROS_ESTADO.map((filtro) => `
    <button type="button" role="tab" class="chip ${filtro.id === estadoVista.estado ? "chip--activo" : ""}"
      aria-selected="${filtro.id === estadoVista.estado}" data-estado="${filtro.id}">${filtro.texto}</button>`).join("")
}

const tarjetaOrden = (orden) => {
  const vehiculo = orden.expand?.vehiculo
  return `
    <a class="fila" href="orden.html?id=${orden.id}">
      <span class="fila__titulo">${escapar(vehiculo?.matricula)} · ${escapar(vehiculo?.marca)} ${escapar(vehiculo?.modelo)}</span>
      ${insigniaEstado(orden.estado)}
      <span class="fila__detalle">${escapar(orden.expand?.cliente?.nombre)} · ${escapar(orden.expand?.mecanico?.name)} · Entrada ${fechaHora(orden.fecha_entrada)}</span>
      <span class="fila__detalle">${escapar(orden.problema.length > 110 ? `${orden.problema.slice(0, 110)}…` : orden.problema)}</span>
      <span class="fila__detalle">Total ${dinero(orden.total)} ${orden.saldo > 0 ? `· <strong class="texto-peligro">Debe ${dinero(orden.saldo)}</strong>` : ""}</span>
    </a>`
}

const cargarOrdenes = async () => {
  const contenedor = $("#lista-ordenes")
  contenedor.innerHTML = esqueleto(4)
  try {
    const resultado = await pb.collection("ordenes").getList(estadoVista.pagina, POR_PAGINA, {
      filter: construirFiltro(),
      sort: "-fecha_entrada",
      expand: "vehiculo,cliente,mecanico",
    })
    $("#total-ordenes").textContent = `${entero(resultado.totalItems)} órdenes encontradas`
    contenedor.innerHTML = resultado.items.length
      ? `<div class="lista">${resultado.items.map(tarjetaOrden).join("")}</div>`
      : estadoVacio("No hay órdenes que coincidan con los filtros.")
    paginacion($("#paginacion"), resultado, (pagina) => {
      estadoVista.pagina = pagina
      cargarOrdenes()
    })
  } catch (error) {
    contenedor.innerHTML = `<p class="nota nota--alerta">${escapar(mensajeError(error))}</p>`
  }
}

const cargarMecanicos = async (usuario) => {
  const mecanicos = await pb.collection("users").getFullList({ filter: 'rol = "mecanico"', sort: "name", fields: "id,name" })
  const opciones = mecanicos.map((m) => `<option value="${m.id}">${escapar(m.name)}</option>`).join("")
  $("#filtro-mecanico").insertAdjacentHTML("beforeend", opciones)
  $("#orden-mecanico").insertAdjacentHTML("beforeend", opciones)
  if (esMecanico()) {
    estadoVista.mecanico = usuario.id
    $("#filtro-mecanico").value = usuario.id
  }
}

const cargarClientes = async () => {
  const clientes = await pb.collection("clientes").getFullList({ sort: "nombre", fields: "id,nombre,telefono" })
  selectorCliente.insertAdjacentHTML("beforeend", clientes
    .map((c) => `<option value="${c.id}">${escapar(c.nombre)} · ${escapar(c.telefono)}</option>`).join(""))
}

const cargarVehiculosCliente = async (clienteId, vehiculoId = "") => {
  selectorVehiculo.disabled = true
  selectorVehiculo.innerHTML = '<option value="">Cargando…</option>'
  if (!clienteId) {
    selectorVehiculo.innerHTML = '<option value="">Primero elija el cliente</option>'
    return
  }
  vehiculosCliente = await pb.collection("vehiculos").getFullList({
    filter: pb.filter("cliente = {:cliente}", { cliente: clienteId }),
    sort: "matricula",
  })
  if (vehiculosCliente.length === 0) {
    selectorVehiculo.innerHTML = '<option value="">El cliente no tiene vehículos</option>'
    mostrarErrorFormulario(formulario, "Registre primero un vehículo en la ficha del cliente.")
    return
  }
  mostrarErrorFormulario(formulario, "")
  selectorVehiculo.innerHTML = '<option value="">Seleccione el vehículo</option>' + vehiculosCliente
    .map((v) => `<option value="${v.id}">${escapar(v.matricula)} · ${escapar(v.marca)} ${escapar(v.modelo)} (${v.anio})</option>`).join("")
  selectorVehiculo.disabled = false
  selectorVehiculo.value = vehiculoId
  actualizarAyudaKilometraje()
}

const actualizarAyudaKilometraje = () => {
  const vehiculo = vehiculosCliente.find((v) => v.id === selectorVehiculo.value)
  $("#orden-km").min = vehiculo?.kilometraje ?? 0
  $("#orden-km-ayuda").textContent = vehiculo
    ? `Último registro: ${entero(vehiculo.kilometraje)} km`
    : "Opcional"
}

const abrirNuevaOrden = async (vehiculoId = "") => {
  formulario.reset()
  $("#orden-fecha").value = valorFechaHoraLocal()
  abrirDialogo(dialogo)
  if (!vehiculoId) return
  try {
    const vehiculo = await pb.collection("vehiculos").getOne(vehiculoId)
    selectorCliente.value = vehiculo.cliente
    await cargarVehiculosCliente(vehiculo.cliente, vehiculo.id)
  } catch (error) {
    mostrarErrorFormulario(formulario, mensajeError(error))
  }
}

const registrarOrden = async (evento) => {
  evento.preventDefault()
  mostrarErrorFormulario(formulario, "")
  if (!formulario.checkValidity()) {
    formulario.reportValidity()
    return
  }
  const datos = datosFormulario(formulario)
  await conCarga(formulario.querySelector("button[type=submit]"), async () => {
    try {
      const orden = await pb.collection("ordenes").create({
        vehiculo: datos.vehiculo,
        mecanico: datos.mecanico,
        fecha_entrada: aIsoServidor(new Date(datos.fecha_entrada)),
        kilometraje: datos.kilometraje ? Number(datos.kilometraje) : 0,
        problema: datos.problema.trim(),
        estado: "recibida",
      })
      cerrarDialogo(dialogo)
      location.href = `orden.html?id=${orden.id}`
    } catch (error) {
      mostrarErrorFormulario(formulario, mensajeError(error))
    }
  })
}

const conectarEventos = () => {
  $("#chips-estado").addEventListener("click", (evento) => {
    const chip = evento.target.closest("[data-estado]")
    if (!chip) return
    estadoVista.estado = chip.dataset.estado
    estadoVista.pagina = 1
    pintarChips()
    cargarOrdenes()
  })
  $("#buscador").addEventListener("input", retrasar((evento) => {
    estadoVista.busqueda = evento.target.value.trim()
    estadoVista.pagina = 1
    cargarOrdenes()
  }))
  $("#filtro-mecanico").addEventListener("change", (evento) => {
    estadoVista.mecanico = evento.target.value
    estadoVista.pagina = 1
    cargarOrdenes()
  })
  $("#boton-nueva").addEventListener("click", () => abrirNuevaOrden())
  selectorCliente.addEventListener("change", () => cargarVehiculosCliente(selectorCliente.value))
  selectorVehiculo.addEventListener("change", actualizarAyudaKilometraje)
  formulario.addEventListener("submit", registrarOrden)
}

const usuario = await iniciarPagina("ordenes")

if (usuario) {
  pintarChips()
  conectarEventos()
  $("#boton-nueva").classList.toggle("oculto", !esPersonal())
  const tareas = [cargarMecanicos(usuario)]
  if (esPersonal()) tareas.push(cargarClientes())
  const resultados = await Promise.allSettled(tareas)
  resultados
    .filter((r) => r.status === "rejected")
    .forEach((r) => aviso(mensajeError(r.reason), "error"))
  await cargarOrdenes()
  suscribir("ordenes", retrasar(cargarOrdenes, 400))
  if (esPersonal() && (parametro("nueva") || parametro("vehiculo"))) {
    abrirNuevaOrden(parametro("vehiculo") ?? "")
  }
}
