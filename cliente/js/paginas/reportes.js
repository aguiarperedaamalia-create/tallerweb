import { pb, esPersonal, mensajeError, suscribir } from "../api.js"
import { iniciarPagina } from "../plantilla.js"
import {
  $, $$, aIsoServidor, datosFormulario, dinero, entero, escapar, estadoVacio, esqueleto, fecha, retrasar,
  valorFechaLocal,
} from "../ui.js"

const formulario = $("#formulario-periodo")

const rangoAtajo = (tipo) => {
  const hoy = new Date()
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  switch (tipo) {
    case "hoy":
      return [hoy, hoy]
    case "semana":
      return [new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 6), hoy]
    case "anterior":
      return [new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1), new Date(hoy.getFullYear(), hoy.getMonth(), 0)]
    default:
      return [inicioMes, hoy]
  }
}

const limitesDelDia = (texto) => {
  const [anio, mes, dia] = texto.split("-").map(Number)
  return [new Date(anio, mes - 1, dia, 0, 0, 0, 0), new Date(anio, mes - 1, dia, 23, 59, 59, 999)]
}

const tarjetaKpi = (valor, etiqueta, variante = "") =>
  `<div class="kpi ${variante}"><span class="kpi__valor">${valor}</span><span class="kpi__etiqueta">${etiqueta}</span></div>`

const consultarFacturacion = async () => {
  const { desde, hasta } = datosFormulario(formulario)
  if (!desde || !hasta || desde > hasta) {
    $("#resultado-facturacion").innerHTML = '<p class="nota nota--alerta">Elija un período válido: la fecha inicial no puede ser posterior a la final.</p>'
    return
  }
  const inicio = aIsoServidor(limitesDelDia(desde)[0])
  const fin = aIsoServidor(limitesDelDia(hasta)[1])
  $("#periodo-impreso").textContent = `Período: ${fecha(limitesDelDia(desde)[0])} al ${fecha(limitesDelDia(hasta)[1])}`
  $("#resultado-facturacion").innerHTML = esqueleto(2)

  try {
    const [entregadas, pagos] = await Promise.all([
      pb.collection("ordenes").getFullList({
        filter: pb.filter('estado = "entregada" && fecha_entrega >= {:inicio} && fecha_entrega <= {:fin}', { inicio, fin }),
        sort: "fecha_entrega",
        expand: "vehiculo,cliente",
      }),
      pb.collection("pagos").getFullList({
        filter: pb.filter("created >= {:inicio} && created <= {:fin}", { inicio, fin }),
        fields: "monto",
      }),
    ])
    const facturado = entregadas.reduce((total, o) => total + o.total, 0)
    const manoObra = entregadas.reduce((total, o) => total + o.total_mano_obra, 0)
    const repuestos = entregadas.reduce((total, o) => total + o.total_repuestos, 0)
    const cobrado = pagos.reduce((total, p) => total + p.monto, 0)

    $("#resultado-facturacion").innerHTML = `
      <div class="kpis">
        ${tarjetaKpi(dinero(facturado), `Facturado (${entregadas.length} órdenes)`, "kpi--acento")}
        ${tarjetaKpi(dinero(cobrado), `Cobrado (${pagos.length} pagos)`)}
        ${tarjetaKpi(dinero(manoObra), "Mano de obra")}
        ${tarjetaKpi(dinero(repuestos), "Repuestos")}
      </div>
      ${entregadas.length === 0 ? estadoVacio("No se entregaron órdenes en este período.") : `
      <div class="tabla-contenedor"><table class="tabla">
        <thead><tr><th>Entrega</th><th>Vehículo</th><th>Cliente</th><th class="numero">Total</th><th class="numero">Saldo</th></tr></thead>
        <tbody>${entregadas.map((o) => `
          <tr>
            <td>${fecha(o.fecha_entrega)}</td>
            <td><a href="orden.html?id=${o.id}">${escapar(o.expand?.vehiculo?.matricula)}</a></td>
            <td>${escapar(o.expand?.cliente?.nombre)}</td>
            <td class="numero">${dinero(o.total)}</td>
            <td class="numero ${o.saldo > 0 ? "texto-peligro" : ""}">${dinero(o.saldo)}</td>
          </tr>`).join("")}
        </tbody>
        <tfoot><tr><td colspan="3">Total del período</td><td class="numero">${dinero(facturado)}</td><td></td></tr></tfoot>
      </table></div>`}`
  } catch (error) {
    $("#resultado-facturacion").innerHTML = `<p class="nota nota--alerta">${escapar(mensajeError(error))}</p>`
  }
}

const cargarSaldos = async () => {
  const contenedor = $("#tabla-saldos")
  if (!contenedor.innerHTML.trim()) contenedor.innerHTML = esqueleto(3)
  try {
    const filas = await pb.collection("saldos_clientes").getFullList({ sort: "-saldo" })
    const total = filas.reduce((suma, fila) => suma + fila.saldo, 0)
    contenedor.innerHTML = filas.length === 0
      ? estadoVacio("Ningún cliente tiene saldo pendiente.")
      : `<div class="tabla-contenedor"><table class="tabla">
          <thead><tr><th>Cliente</th><th class="numero">Órdenes</th><th class="numero">Debe</th></tr></thead>
          <tbody>${filas.map((f) => `
            <tr>
              <td><a href="cliente.html?id=${f.id}">${escapar(f.nombre)}</a><br><small class="texto-suave">${escapar(f.telefono)}</small></td>
              <td class="numero">${entero(f.ordenes_pendientes)}</td>
              <td class="numero texto-peligro">${dinero(f.saldo)}</td>
            </tr>`).join("")}
          </tbody>
          <tfoot><tr><td colspan="2">Total por cobrar</td><td class="numero">${dinero(total)}</td></tr></tfoot>
        </table></div>`
  } catch (error) {
    contenedor.innerHTML = `<p class="nota nota--alerta">${escapar(mensajeError(error))}</p>`
  }
}

const cargarCarga = async () => {
  const contenedor = $("#tabla-carga")
  if (!contenedor.innerHTML.trim()) contenedor.innerHTML = esqueleto(3)
  try {
    const filas = await pb.collection("carga_mecanicos").getFullList({ sort: "-abiertas,nombre" })
    contenedor.innerHTML = filas.length === 0
      ? estadoVacio("No hay mecánicos registrados.")
      : `<div class="tabla-contenedor"><table class="tabla">
          <thead><tr><th>Mecánico</th><th class="numero">Recib.</th><th class="numero">Diag.</th><th class="numero">Repar.</th><th class="numero">Listas</th><th class="numero">Total</th></tr></thead>
          <tbody>${filas.map((f) => `
            <tr>
              <td>${escapar(f.nombre)}</td>
              <td class="numero">${f.recibidas}</td>
              <td class="numero">${f.en_diagnostico}</td>
              <td class="numero">${f.en_reparacion}</td>
              <td class="numero">${f.listas}</td>
              <td class="numero"><strong>${entero(f.abiertas)}</strong></td>
            </tr>`).join("")}
          </tbody>
        </table></div>`
  } catch (error) {
    contenedor.innerHTML = `<p class="nota nota--alerta">${escapar(mensajeError(error))}</p>`
  }
}

const aplicarAtajo = (tipo) => {
  const [desde, hasta] = rangoAtajo(tipo)
  formulario.elements.desde.value = valorFechaLocal(desde)
  formulario.elements.hasta.value = valorFechaLocal(hasta)
  $$("[data-periodo]").forEach((chip) => chip.classList.toggle("chip--activo", chip.dataset.periodo === tipo))
  consultarFacturacion()
}

const conectarEventos = () => {
  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault()
    $$("[data-periodo]").forEach((chip) => chip.classList.remove("chip--activo"))
    consultarFacturacion()
  })
  $("#atajos-periodo").addEventListener("click", (evento) => {
    const chip = evento.target.closest("[data-periodo]")
    if (chip) aplicarAtajo(chip.dataset.periodo)
  })
  $("#boton-imprimir").addEventListener("click", () => window.print())
}

const usuario = await iniciarPagina("reportes")

if (usuario) {
  if (!esPersonal()) {
    location.replace("index.html")
  } else {
    conectarEventos()
    aplicarAtajo("mes")
    await Promise.allSettled([cargarSaldos(), cargarCarga()])
    const refrescar = retrasar(() => Promise.allSettled([cargarSaldos(), cargarCarga()]), 500)
    suscribir("ordenes", refrescar)
  }
}
