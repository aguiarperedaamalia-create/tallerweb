import { pb, ROLES, requerirSesion, cerrarSesion, esPersonal, suscribir } from "./api.js"
import { $, escapar, aviso, prepararDialogos } from "./ui.js"

const ICONOS = {
  panel: '<path d="M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z"/>',
  ordenes: '<path d="M19 3h-4.2A3 3 0 0 0 12 1a3 3 0 0 0-2.8 2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2m-7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2m2 14H7v-2h7zm3-4H7v-2h10zm0-4H7V7h10z"/>',
  clientes: '<path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6m-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6m0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13m8 0c-.3 0-.6 0-1 .1 1.2.8 2 2 2 3.4V19h6v-2.5c0-2.3-4.7-3.5-7-3.5"/>',
  repuestos: '<path d="M22.7 19 13.6 9.9c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4"/>',
  reportes: '<path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/>',
}

const SECCIONES = [
  { id: "panel", texto: "Panel", enlace: "index.html", visible: () => true },
  { id: "ordenes", texto: "Órdenes", enlace: "ordenes.html", visible: () => true },
  { id: "clientes", texto: "Clientes", enlace: "clientes.html", visible: esPersonal },
  { id: "repuestos", texto: "Repuestos", enlace: "repuestos.html", visible: () => true },
  { id: "reportes", texto: "Reportes", enlace: "reportes.html", visible: esPersonal },
]

const icono = (id) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS[id]}</svg>`

const pintarBarra = (usuario) => {
  $("#barra").innerHTML = `
    <a class="barra__marca" href="index.html">
      <img src="img/logo.svg" alt="" width="34" height="34">
      <span>El Pistón</span>
    </a>
    <div class="barra__usuario">
      <span class="barra__nombre">${escapar(usuario.name || usuario.email)}</span>
      <span class="barra__rol">${escapar(ROLES[usuario.rol] ?? usuario.rol)}</span>
    </div>
    <button type="button" class="boton boton--fantasma boton--chico" id="salir">Salir</button>`
  $("#salir").addEventListener("click", cerrarSesion)
}

const pintarMenu = (activa) => {
  $("#menu").innerHTML = SECCIONES.filter((seccion) => seccion.visible())
    .map((seccion) => `
      <a href="${seccion.enlace}" class="menu__enlace ${seccion.id === activa ? "menu__enlace--activo" : ""}" ${seccion.id === activa ? 'aria-current="page"' : ""}>
        ${icono(seccion.id)}<span>${seccion.texto}</span>
      </a>`)
    .join("")
}

const vigilarExistencias = () =>
  suscribir("repuestos", ({ action, record }) => {
    if (action !== "update") return
    if (record.existencias <= record.stock_minimo) {
      aviso(`Atención: quedan ${record.existencias} unidades de ${record.nombre}.`, "alerta")
    }
  })

const vigilarConexion = () => {
  window.addEventListener("offline", () => aviso("Se perdió la conexión de red.", "error"))
  window.addEventListener("online", () => aviso("Conexión restablecida.", "exito"))
}

export const iniciarPagina = async (activa) => {
  const usuario = await requerirSesion()
  if (!usuario) return null
  pintarBarra(usuario)
  pintarMenu(activa)
  prepararDialogos()
  vigilarConexion()
  vigilarExistencias()
  window.addEventListener("pagehide", () => pb.realtime.unsubscribe())
  document.body.classList.add("listo")
  return usuario
}
