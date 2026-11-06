import { pb, esPersonal, mensajeError } from "../api.js"
import { POR_PAGINA } from "../config.js"
import { iniciarPagina } from "../plantilla.js"
import { guardarCliente } from "../registros.js"
import {
  $, abrirDialogo, conCarga, datosFormulario, entero, escapar, estadoVacio, esqueleto, mostrarErrorFormulario,
  paginacion, parametro, retrasar,
} from "../ui.js"

const vista = { busqueda: "", pagina: 1 }
const dialogo = $("#dialogo-cliente")
const formulario = $("#formulario-cliente")

const cargarClientes = async () => {
  const contenedor = $("#lista-clientes")
  contenedor.innerHTML = esqueleto(4)
  try {
    const resultado = await pb.collection("clientes").getList(vista.pagina, POR_PAGINA, {
      filter: vista.busqueda ? pb.filter("nombre ~ {:q} || telefono ~ {:q}", { q: vista.busqueda }) : "",
      sort: "nombre",
      expand: "vehiculos_via_cliente",
    })
    $("#total-clientes").textContent = `${entero(resultado.totalItems)} clientes registrados`
    contenedor.innerHTML = resultado.items.length === 0
      ? estadoVacio("No se encontraron clientes.")
      : `<div class="lista">${resultado.items.map((cliente) => {
        const vehiculos = cliente.expand?.vehiculos_via_cliente ?? []
        return `
          <a class="fila" href="cliente.html?id=${cliente.id}">
            <span class="fila__titulo">${escapar(cliente.nombre)}</span>
            <span class="fila__monto">${vehiculos.length} ${vehiculos.length === 1 ? "vehículo" : "vehículos"}</span>
            <span class="fila__detalle">${escapar(cliente.telefono)}${cliente.direccion ? ` · ${escapar(cliente.direccion)}` : ""}</span>
            ${vehiculos.length ? `<span class="fila__detalle">${vehiculos.map((v) => escapar(v.matricula)).join(" · ")}</span>` : ""}
          </a>`
      }).join("")}</div>`
    paginacion($("#paginacion"), resultado, (pagina) => {
      vista.pagina = pagina
      cargarClientes()
    })
  } catch (error) {
    contenedor.innerHTML = `<p class="nota nota--alerta">${escapar(mensajeError(error))}</p>`
  }
}

const conectarEventos = () => {
  $("#buscador").addEventListener("input", retrasar((evento) => {
    vista.busqueda = evento.target.value.trim()
    vista.pagina = 1
    cargarClientes()
  }))
  $("#boton-nuevo").addEventListener("click", () => abrirDialogo(dialogo))
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault()
    if (!formulario.checkValidity()) {
      formulario.reportValidity()
      return
    }
    await conCarga(formulario.querySelector("button[type=submit]"), async () => {
      try {
        const cliente = await guardarCliente(datosFormulario(formulario))
        location.href = `cliente.html?id=${cliente.id}&nuevo=1`
      } catch (error) {
        mostrarErrorFormulario(formulario, mensajeError(error))
      }
    })
  })
}

const usuario = await iniciarPagina("clientes")

if (usuario) {
  if (!esPersonal()) {
    location.replace("index.html")
  } else {
    conectarEventos()
    await cargarClientes()
    if (parametro("nuevo")) abrirDialogo(dialogo)
  }
}
