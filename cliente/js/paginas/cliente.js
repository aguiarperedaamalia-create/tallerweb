import { pb, esPersonal, mensajeError } from "../api.js"
import { iniciarPagina } from "../plantilla.js"
import { guardarCliente, guardarVehiculo, rellenarFormulario } from "../registros.js"
import {
  $, abrirDialogo, aviso, cerrarDialogo, conCarga, datosFormulario, dinero, entero, escapar, estaCerrada, estadoVacio,
  fecha, insigniaEstado, mostrarErrorFormulario, parametro,
} from "../ui.js"

const clienteId = parametro("id")
let cliente = null

const pintarCliente = () => {
  document.title = `${cliente.nombre} · El Pistón`
  $("#nombre-cliente").textContent = cliente.nombre
  $("#contacto-cliente").innerHTML = `<a href="tel:${escapar(cliente.telefono)}">${escapar(cliente.telefono)}</a>${cliente.direccion ? ` · ${escapar(cliente.direccion)}` : ""}`
}

const pintarVehiculos = (vehiculos) => {
  $("#lista-vehiculos").innerHTML = vehiculos.length === 0
    ? estadoVacio("Este cliente no tiene vehículos registrados.")
    : `<div class="lista">${vehiculos.map((v) => `
        <a class="fila" href="vehiculo.html?id=${v.id}">
          <span class="fila__titulo">${escapar(v.matricula)}</span>
          <span class="fila__monto">${entero(v.kilometraje)} km</span>
          <span class="fila__detalle">${escapar(v.marca)} ${escapar(v.modelo)} · ${v.anio}</span>
        </a>`).join("")}</div>`
}

const pintarHistorial = (ordenes) => {
  $("#historial").innerHTML = ordenes.length === 0
    ? estadoVacio("Todavía no hay órdenes de servicio.")
    : `<div class="lista">${ordenes.map((o) => `
        <a class="fila" href="orden.html?id=${o.id}">
          <span class="fila__titulo">${fecha(o.fecha_entrada)} · ${escapar(o.expand?.vehiculo?.matricula)}</span>
          ${insigniaEstado(o.estado)}
          <span class="fila__detalle">${escapar(o.problema)}</span>
          <span class="fila__detalle">Total ${dinero(o.total)}${o.saldo > 0 && o.estado !== "cancelada" ? ` · <strong class="texto-peligro">Debe ${dinero(o.saldo)}</strong>` : ""}</span>
        </a>`).join("")}</div>`
}

const pintarIndicadores = (ordenes, vehiculos) => {
  const validas = ordenes.filter((o) => o.estado !== "cancelada")
  const abiertas = ordenes.filter((o) => !estaCerrada(o.estado)).length
  const facturado = validas.reduce((total, o) => total + o.total, 0)
  const saldo = validas.reduce((total, o) => total + o.saldo, 0)
  $("#kpis-cliente").innerHTML = `
    <div class="kpi"><span class="kpi__valor">${vehiculos.length}</span><span class="kpi__etiqueta">Vehículos</span></div>
    <div class="kpi"><span class="kpi__valor">${abiertas}</span><span class="kpi__etiqueta">Órdenes abiertas</span></div>
    <div class="kpi"><span class="kpi__valor">${dinero(facturado)}</span><span class="kpi__etiqueta">Total facturado</span></div>
    <div class="kpi ${saldo > 0 ? "kpi--alerta" : ""}"><span class="kpi__valor">${dinero(saldo)}</span><span class="kpi__etiqueta">Saldo pendiente</span></div>`
}

const cargar = async () => {
  const filtro = pb.filter("cliente = {:cliente}", { cliente: clienteId })
  const [datos, vehiculos, ordenes] = await Promise.all([
    pb.collection("clientes").getOne(clienteId),
    pb.collection("vehiculos").getFullList({ filter: filtro, sort: "matricula" }),
    pb.collection("ordenes").getFullList({ filter: filtro, sort: "-fecha_entrada", expand: "vehiculo" }),
  ])
  cliente = datos
  pintarCliente()
  pintarVehiculos(vehiculos)
  pintarHistorial(ordenes)
  pintarIndicadores(ordenes, vehiculos)
}

const alEnviar = (formulario, accion) => {
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault()
    if (!formulario.checkValidity()) {
      formulario.reportValidity()
      return
    }
    await conCarga(formulario.querySelector("button[type=submit]"), async () => {
      try {
        await accion(datosFormulario(formulario))
        cerrarDialogo(formulario.closest("dialog"))
        await cargar()
      } catch (error) {
        mostrarErrorFormulario(formulario, mensajeError(error))
      }
    })
  })
}

const conectarEventos = () => {
  $("#boton-editar").addEventListener("click", () => {
    abrirDialogo($("#dialogo-cliente"))
    rellenarFormulario($("#formulario-cliente"), cliente)
  })
  $("#boton-vehiculo").addEventListener("click", () => abrirDialogo($("#dialogo-vehiculo")))
  alEnviar($("#formulario-cliente"), async (datos) => {
    await guardarCliente(datos, clienteId)
    aviso("Datos del cliente actualizados.")
  })
  alEnviar($("#formulario-vehiculo"), async (datos) => {
    await guardarVehiculo({ ...datos, cliente: clienteId })
    aviso("Vehículo registrado.")
  })
}

const usuario = await iniciarPagina("clientes")

if (usuario) {
  if (!esPersonal() || !clienteId) {
    location.replace(esPersonal() ? "clientes.html" : "index.html")
  } else {
    try {
      await cargar()
      conectarEventos()
      if (parametro("nuevo")) {
        aviso("Cliente registrado. Ahora agregue su vehículo.")
        abrirDialogo($("#dialogo-vehiculo"))
      }
    } catch (error) {
      $("#nombre-cliente").textContent = "Cliente no encontrado"
      aviso(mensajeError(error), "error")
    }
  }
}
