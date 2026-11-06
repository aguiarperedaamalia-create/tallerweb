import { MONEDA } from "./config.js"

export const ESTADOS = {
  recibida: { texto: "Recibida", siguiente: "diagnostico" },
  diagnostico: { texto: "En diagnóstico", siguiente: "reparacion" },
  reparacion: { texto: "En reparación", siguiente: "lista" },
  lista: { texto: "Lista para entregar", siguiente: "entregada" },
  entregada: { texto: "Entregada", siguiente: null },
  cancelada: { texto: "Cancelada", siguiente: null },
}

export const ESTADOS_ABIERTOS = ["recibida", "diagnostico", "reparacion", "lista"]

export const estaCerrada = (estado) => estado === "entregada" || estado === "cancelada"

export const $ = (selector, raiz = document) => raiz.querySelector(selector)
export const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)]

const ENTIDADES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }

export const escapar = (valor) => String(valor ?? "").replace(/[&<>"']/g, (c) => ENTIDADES[c])

const formatoNumero = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const formatoEntero = new Intl.NumberFormat("es-ES")

export const dinero = (valor) => `${formatoNumero.format(Number(valor) || 0)} ${MONEDA}`
export const entero = (valor) => formatoEntero.format(Number(valor) || 0)

const aFecha = (valor) => (valor ? new Date(String(valor).replace(" ", "T")) : null)

export const fecha = (valor) => {
  const f = aFecha(valor)
  return f ? f.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—"
}

export const fechaHora = (valor) => {
  const f = aFecha(valor)
  return f ? f.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"
}

export const aIsoServidor = (fechaLocal) => fechaLocal.toISOString().replace("T", " ")

export const valorFechaHoraLocal = (f = new Date()) => {
  const local = new Date(f.getTime() - f.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export const valorFechaLocal = (f = new Date()) => valorFechaHoraLocal(f).slice(0, 10)

export const insigniaEstado = (estado) =>
  `<span class="insignia insignia--${escapar(estado)}">${escapar(ESTADOS[estado]?.texto ?? estado)}</span>`

export const parametro = (nombre) => new URLSearchParams(location.search).get(nombre)

export const datosFormulario = (formulario) => Object.fromEntries(new FormData(formulario))

export const retrasar = (funcion, ms = 300) => {
  let temporizador
  return (...argumentos) => {
    clearTimeout(temporizador)
    temporizador = setTimeout(() => funcion(...argumentos), ms)
  }
}

export const aviso = (mensaje, tipo = "exito") => {
  const contenedor = $("#avisos")
  if (!contenedor) return
  const elemento = document.createElement("div")
  elemento.className = `aviso aviso--${tipo}`
  elemento.setAttribute("role", tipo === "error" ? "alert" : "status")
  elemento.textContent = mensaje
  contenedor.append(elemento)
  setTimeout(() => elemento.classList.add("aviso--saliendo"), 4200)
  setTimeout(() => elemento.remove(), 4600)
}

export const conCarga = async (boton, accion) => {
  if (!boton) return accion()
  const textoOriginal = boton.innerHTML
  boton.disabled = true
  boton.classList.add("boton--cargando")
  try {
    return await accion()
  } finally {
    boton.disabled = false
    boton.classList.remove("boton--cargando")
    boton.innerHTML = textoOriginal
  }
}

export const abrirDialogo = (dialogo) => {
  dialogo.showModal()
  const primerCampo = dialogo.querySelector("input:not([type=hidden]), select, textarea")
  primerCampo?.focus()
}

export const cerrarDialogo = (dialogo) => {
  dialogo.close()
  dialogo.querySelector("form")?.reset()
  const error = dialogo.querySelector(".formulario__error")
  if (error) error.textContent = ""
}

export const prepararDialogos = () => {
  $$("dialog").forEach((dialogo) => {
    $$("[data-cerrar]", dialogo).forEach((boton) =>
      boton.addEventListener("click", () => cerrarDialogo(dialogo)),
    )
    dialogo.addEventListener("click", (evento) => {
      if (evento.target === dialogo) cerrarDialogo(dialogo)
    })
  })
}

export const confirmar = (mensaje, textoAceptar = "Confirmar") =>
  new Promise((resolver) => {
    const dialogo = document.createElement("dialog")
    dialogo.className = "dialogo dialogo--confirmar"
    dialogo.innerHTML = `
      <p class="dialogo__mensaje">${escapar(mensaje)}</p>
      <div class="dialogo__acciones">
        <button type="button" class="boton boton--secundario" value="no">Volver</button>
        <button type="button" class="boton boton--peligro" value="si">${escapar(textoAceptar)}</button>
      </div>`
    const terminar = (respuesta) => {
      dialogo.close()
      dialogo.remove()
      resolver(respuesta)
    }
    dialogo.addEventListener("click", (evento) => {
      if (evento.target.value === "si") terminar(true)
      else if (evento.target.value === "no" || evento.target === dialogo) terminar(false)
    })
    dialogo.addEventListener("cancel", (evento) => {
      evento.preventDefault()
      terminar(false)
    })
    document.body.append(dialogo)
    dialogo.showModal()
  })

export const mostrarErrorFormulario = (formulario, mensaje) => {
  const destino = formulario.querySelector(".formulario__error")
  if (destino) destino.textContent = mensaje
  else aviso(mensaje, "error")
}

export const estadoVacio = (mensaje) => `<p class="vacio">${escapar(mensaje)}</p>`

export const esqueleto = (filas = 3) =>
  Array.from({ length: filas }, () => '<div class="esqueleto"></div>').join("")

export const paginacion = (contenedor, resultado, alCambiar) => {
  if (resultado.totalPages <= 1) {
    contenedor.innerHTML = ""
    return
  }
  contenedor.innerHTML = `
    <button type="button" class="boton boton--secundario boton--chico" data-pagina="${resultado.page - 1}" ${resultado.page <= 1 ? "disabled" : ""}>Anterior</button>
    <span>Página ${resultado.page} de ${resultado.totalPages}</span>
    <button type="button" class="boton boton--secundario boton--chico" data-pagina="${resultado.page + 1}" ${resultado.page >= resultado.totalPages ? "disabled" : ""}>Siguiente</button>`
  $$("[data-pagina]", contenedor).forEach((boton) =>
    boton.addEventListener("click", () => alCambiar(Number(boton.dataset.pagina))),
  )
}
