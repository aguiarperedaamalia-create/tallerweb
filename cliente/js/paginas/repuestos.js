import { pb, esPersonal, mensajeError, suscribir } from "../api.js"
import { iniciarPagina } from "../plantilla.js"
import { guardarRepuesto, rellenarFormulario } from "../registros.js"
import {
  $, abrirDialogo, aviso, cerrarDialogo, conCarga, datosFormulario, dinero, entero, escapar, estadoVacio, esqueleto,
  mostrarErrorFormulario, parametro, retrasar,
} from "../ui.js"

const vista = { busqueda: "", soloBajos: Boolean(parametro("bajos")) }
let repuestos = []

const construirFiltro = () => {
  const partes = []
  if (vista.soloBajos) partes.push("existencias <= stock_minimo")
  if (vista.busqueda) partes.push(pb.filter("(nombre ~ {:q} || codigo ~ {:q})", { q: vista.busqueda }))
  return partes.join(" && ")
}

const pintarTabla = () => {
  const editable = esPersonal()
  $("#tabla-repuestos").innerHTML = repuestos.length === 0
    ? estadoVacio(vista.soloBajos ? "No hay repuestos por agotarse." : "No se encontraron repuestos.")
    : `<div class="tabla-contenedor"><table class="tabla">
        <thead><tr>
          <th>Repuesto</th><th class="numero">Precio</th><th class="numero">Existencias</th><th class="numero">Mínimo</th>${editable ? "<th></th>" : ""}
        </tr></thead>
        <tbody>${repuestos.map((r) => `
          <tr>
            <td><strong>${escapar(r.nombre)}</strong><br><small class="texto-suave">${escapar(r.codigo)}</small></td>
            <td class="numero">${dinero(r.precio)}</td>
            <td class="numero"><span class="insignia ${r.existencias <= r.stock_minimo ? "insignia--bajo" : "insignia--ok"}">${entero(r.existencias)}</span></td>
            <td class="numero">${entero(r.stock_minimo)}</td>
            ${editable ? `<td class="numero">
              <div class="acciones acciones--derecha">
                <button type="button" class="boton boton--secundario boton--chico" data-entrada="${r.id}">+ Entrada</button>
                <button type="button" class="boton boton--secundario boton--chico" data-editar="${r.id}">Editar</button>
              </div></td>` : ""}
          </tr>`).join("")}
        </tbody>
      </table></div>`
}

const cargar = async () => {
  if (!repuestos.length) $("#tabla-repuestos").innerHTML = esqueleto(4)
  try {
    const [lista, total, bajos] = await Promise.all([
      pb.collection("repuestos").getFullList({ filter: construirFiltro(), sort: "nombre" }),
      pb.collection("repuestos").getList(1, 1, { fields: "id" }),
      pb.collection("repuestos").getList(1, 1, { filter: "existencias <= stock_minimo", fields: "id" }),
    ])
    repuestos = lista
    $("#resumen-inventario").textContent = `${entero(total.totalItems)} repuestos · ${entero(bajos.totalItems)} por agotarse`
    pintarTabla()
  } catch (error) {
    $("#tabla-repuestos").innerHTML = `<p class="nota nota--alerta">${escapar(mensajeError(error))}</p>`
  }
}

const abrirRepuesto = (repuesto = null) => {
  const formulario = $("#formulario-repuesto")
  $("#titulo-dialogo-repuesto").textContent = repuesto ? "Editar repuesto" : "Nuevo repuesto"
  abrirDialogo($("#dialogo-repuesto"))
  formulario.elements.id.value = ""
  if (repuesto) rellenarFormulario(formulario, repuesto)
}

const abrirEntrada = (repuesto) => {
  const formulario = $("#formulario-entrada")
  abrirDialogo($("#dialogo-entrada"))
  formulario.elements.id.value = repuesto.id
  $("#detalle-entrada").textContent = `${repuesto.nombre} · existencias actuales: ${entero(repuesto.existencias)}`
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
  $("#buscador").addEventListener("input", retrasar((evento) => {
    vista.busqueda = evento.target.value.trim()
    cargar()
  }))
  $("#chip-bajos").addEventListener("click", (evento) => {
    vista.soloBajos = !vista.soloBajos
    evento.currentTarget.classList.toggle("chip--activo", vista.soloBajos)
    evento.currentTarget.setAttribute("aria-pressed", String(vista.soloBajos))
    cargar()
  })
  $("#boton-nuevo").addEventListener("click", () => abrirRepuesto())
  $("#tabla-repuestos").addEventListener("click", (evento) => {
    const editar = evento.target.closest("[data-editar]")
    const entrada = evento.target.closest("[data-entrada]")
    if (editar) abrirRepuesto(repuestos.find((r) => r.id === editar.dataset.editar))
    if (entrada) abrirEntrada(repuestos.find((r) => r.id === entrada.dataset.entrada))
  })
  alEnviar($("#formulario-repuesto"), async (datos) => {
    await guardarRepuesto(datos, datos.id)
    aviso(datos.id ? "Repuesto actualizado." : "Repuesto agregado al inventario.")
  })
  alEnviar($("#formulario-entrada"), async (datos) => {
    await pb.collection("repuestos").update(datos.id, { "existencias+": Number(datos.cantidad) })
    aviso("Existencias actualizadas.")
  })
}

const usuario = await iniciarPagina("repuestos")

if (usuario) {
  $("#boton-nuevo").classList.toggle("oculto", !esPersonal())
  $("#chip-bajos").classList.toggle("chip--activo", vista.soloBajos)
  $("#chip-bajos").setAttribute("aria-pressed", String(vista.soloBajos))
  conectarEventos()
  await cargar()
  suscribir("repuestos", retrasar(cargar, 400))
}
