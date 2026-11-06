import { pb, esPersonal, mensajeError } from "../api.js"
import { iniciarPagina } from "../plantilla.js"
import { guardarVehiculo, rellenarFormulario } from "../registros.js"
import {
  $, abrirDialogo, aviso, cerrarDialogo, conCarga, datosFormulario, dinero, entero, escapar, estadoVacio, fecha,
  insigniaEstado, mostrarErrorFormulario, parametro,
} from "../ui.js"

const vehiculoId = parametro("id")
let vehiculo = null

const pintarVehiculo = (ordenes) => {
  const propietario = vehiculo.expand?.cliente
  const validas = ordenes.filter((o) => o.estado !== "cancelada")
  document.title = `${vehiculo.matricula} · El Pistón`
  $("#matricula").textContent = vehiculo.matricula
  $("#descripcion-vehiculo").textContent = `${vehiculo.marca} ${vehiculo.modelo} · ${vehiculo.anio}`
  $("#enlace-propietario").href = `cliente.html?id=${vehiculo.cliente}`
  $("#enlace-propietario").textContent = `← ${propietario?.nombre ?? "Cliente"}`
  $("#boton-orden").href = `ordenes.html?vehiculo=${vehiculo.id}`
  $("#ficha-vehiculo").innerHTML = `
    <dl class="datos">
      <div><dt>Propietario</dt><dd><a href="cliente.html?id=${vehiculo.cliente}">${escapar(propietario?.nombre)}</a></dd></div>
      <div><dt>Teléfono</dt><dd>${escapar(propietario?.telefono)}</dd></div>
      <div><dt>Último kilometraje</dt><dd>${entero(vehiculo.kilometraje)} km</dd></div>
      <div><dt>Visitas</dt><dd>${validas.length}</dd></div>
      <div><dt>Total invertido</dt><dd>${dinero(validas.reduce((total, o) => total + o.total, 0))}</dd></div>
      <div><dt>Última visita</dt><dd>${ordenes[0] ? fecha(ordenes[0].fecha_entrada) : "—"}</dd></div>
    </dl>`
}

const detalleOrden = (orden) => {
  const trabajos = orden.expand?.trabajos_via_orden ?? []
  const repuestos = orden.expand?.orden_repuestos_via_orden ?? []
  const lineas = [
    ...trabajos.map((t) => `${escapar(t.descripcion)} (${dinero(t.precio)})`),
    ...repuestos.map((r) => `${entero(r.cantidad)} × ${escapar(r.expand?.repuesto?.nombre)}`),
  ]
  return lineas.length ? lineas.join(" · ") : "Sin trabajos registrados"
}

const pintarHistorial = (ordenes) => {
  $("#historial").innerHTML = ordenes.length === 0
    ? estadoVacio("Este vehículo no tiene servicios registrados.")
    : `<div class="lista">${ordenes.map((o) => `
        <a class="fila" href="orden.html?id=${o.id}">
          <span class="fila__titulo">${fecha(o.fecha_entrada)} · ${o.kilometraje ? `${entero(o.kilometraje)} km` : "km no registrado"}</span>
          ${insigniaEstado(o.estado)}
          <span class="fila__detalle"><strong>Problema:</strong> ${escapar(o.problema)}</span>
          <span class="fila__detalle"><strong>Realizado:</strong> ${detalleOrden(o)}</span>
          <span class="fila__detalle">Mecánico: ${escapar(o.expand?.mecanico?.name)} · Total ${dinero(o.total)}</span>
        </a>`).join("")}</div>`
}

const cargar = async () => {
  const [datos, ordenes] = await Promise.all([
    pb.collection("vehiculos").getOne(vehiculoId, { expand: "cliente" }),
    pb.collection("ordenes").getFullList({
      filter: pb.filter("vehiculo = {:vehiculo}", { vehiculo: vehiculoId }),
      sort: "-fecha_entrada",
      expand: "mecanico,trabajos_via_orden,orden_repuestos_via_orden.repuesto",
    }),
  ])
  vehiculo = datos
  pintarVehiculo(ordenes)
  pintarHistorial(ordenes)
}

const conectarEventos = () => {
  const formulario = $("#formulario-vehiculo")
  $("#boton-editar").addEventListener("click", () => {
    abrirDialogo($("#dialogo-vehiculo"))
    rellenarFormulario(formulario, vehiculo)
  })
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault()
    if (!formulario.checkValidity()) {
      formulario.reportValidity()
      return
    }
    await conCarga(formulario.querySelector("button[type=submit]"), async () => {
      try {
        await guardarVehiculo(datosFormulario(formulario), vehiculoId)
        cerrarDialogo($("#dialogo-vehiculo"))
        aviso("Vehículo actualizado.")
        await cargar()
      } catch (error) {
        mostrarErrorFormulario(formulario, mensajeError(error))
      }
    })
  })
}

const usuario = await iniciarPagina("clientes")

if (usuario) {
  if (!esPersonal() || !vehiculoId) {
    location.replace("index.html")
  } else {
    try {
      await cargar()
      conectarEventos()
    } catch (error) {
      $("#ficha-vehiculo").innerHTML = `<p class="nota nota--alerta">${escapar(mensajeError(error))}</p>`
    }
  }
}
