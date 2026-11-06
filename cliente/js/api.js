import PocketBase from "./lib/pocketbase.es.mjs"
import { PB_URL } from "./config.js"

export const pb = new PocketBase(PB_URL)
pb.autoCancellation(false)

export const ROLES = {
  dueno: "Dueño",
  recepcion: "Recepción",
  mecanico: "Mecánico",
}

export const usuarioActual = () => pb.authStore.record
export const rolActual = () => pb.authStore.record?.rol ?? ""
export const esDueno = () => rolActual() === "dueno"
export const esMecanico = () => rolActual() === "mecanico"
export const esPersonal = () => ["dueno", "recepcion"].includes(rolActual())

export const iniciarSesion = (email, password) =>
  pb.collection("users").authWithPassword(email, password)

export const cerrarSesion = () => {
  pb.realtime.unsubscribe()
  pb.authStore.clear()
  location.replace("login.html")
}

export const requerirSesion = async () => {
  if (!pb.authStore.isValid) {
    location.replace("login.html")
    return null
  }
  try {
    await pb.collection("users").authRefresh()
  } catch (error) {
    if ([401, 403, 404].includes(error.status)) {
      pb.authStore.clear()
      location.replace("login.html")
      return null
    }
  }
  return pb.authStore.record
}

const NOMBRES_CAMPOS = {
  nombre: "Nombre",
  telefono: "Teléfono",
  direccion: "Dirección",
  matricula: "Matrícula",
  marca: "Marca",
  modelo: "Modelo",
  anio: "Año",
  kilometraje: "Kilometraje",
  codigo: "Código",
  precio: "Precio",
  existencias: "Existencias",
  stock_minimo: "Stock mínimo",
  problema: "Problema",
  mecanico: "Mecánico",
  vehiculo: "Vehículo",
  descripcion: "Descripción",
  cantidad: "Cantidad",
  monto: "Monto",
  email: "Correo",
  password: "Contraseña",
  identity: "Correo",
}

const MENSAJES_VALIDACION = {
  validation_required: "es obligatorio",
  validation_not_unique: "ya está registrado",
  validation_invalid_format: "tiene un formato inválido",
  validation_min_greater_equal_than_required: "es menor que el mínimo permitido",
  validation_max_less_equal_than_required: "es mayor que el máximo permitido",
  validation_only_int_constraint: "debe ser un número entero",
  validation_length_out_of_range: "tiene una longitud no permitida",
  validation_min_text_constraint: "es demasiado corto",
  validation_max_text_constraint: "es demasiado largo",
}

export const mensajeError = (error) => {
  if (!error) return "Ocurrió un error inesperado."
  if (error.isAbort) return "La solicitud fue cancelada."
  if (error.status === 0) return "No hay conexión con el servidor. Verifique que PocketBase esté en ejecución."
  if (error.status === 403) return "No tiene permiso para realizar esta acción."
  const campos = Object.entries(error.response?.data ?? {})
    .map(([campo, detalle]) => `${NOMBRES_CAMPOS[campo] ?? campo} ${MENSAJES_VALIDACION[detalle.code] ?? detalle.message}`)
  if (campos.length > 0) return campos.join(" · ")
  return error.response?.message || error.message || "Ocurrió un error inesperado."
}

export const contar = async (coleccion, filtro = "") => {
  const resultado = await pb.collection(coleccion).getList(1, 1, { filter: filtro, fields: "id" })
  return resultado.totalItems
}

export const suscribir = async (coleccion, alCambiar, tema = "*") => {
  try {
    return await pb.collection(coleccion).subscribe(tema, alCambiar)
  } catch (_) {
    return () => {}
  }
}
