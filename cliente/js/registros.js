import { pb } from "./api.js"

const limpiarTexto = (valor) => String(valor ?? "").trim().replace(/\s+/g, " ")

export const normalizarMatricula = (valor) => String(valor ?? "").toUpperCase().replace(/\s+/g, "")

export const guardarCliente = (datos, id = "") => {
  const cuerpo = {
    nombre: limpiarTexto(datos.nombre),
    telefono: limpiarTexto(datos.telefono),
    direccion: limpiarTexto(datos.direccion),
  }
  return id ? pb.collection("clientes").update(id, cuerpo) : pb.collection("clientes").create(cuerpo)
}

export const guardarVehiculo = (datos, id = "") => {
  const cuerpo = {
    cliente: datos.cliente,
    matricula: normalizarMatricula(datos.matricula),
    marca: limpiarTexto(datos.marca),
    modelo: limpiarTexto(datos.modelo),
    anio: Number(datos.anio),
    kilometraje: datos.kilometraje ? Number(datos.kilometraje) : 0,
  }
  return id ? pb.collection("vehiculos").update(id, cuerpo) : pb.collection("vehiculos").create(cuerpo)
}

export const guardarRepuesto = (datos, id = "") => {
  const cuerpo = {
    nombre: limpiarTexto(datos.nombre),
    codigo: normalizarMatricula(datos.codigo),
    precio: Number(datos.precio),
    existencias: Number(datos.existencias || 0),
    stock_minimo: Number(datos.stock_minimo || 0),
  }
  return id ? pb.collection("repuestos").update(id, cuerpo) : pb.collection("repuestos").create(cuerpo)
}

export const rellenarFormulario = (formulario, registro) => {
  for (const elemento of formulario.elements) {
    if (elemento.name && elemento.name in registro) elemento.value = registro[elemento.name] ?? ""
  }
}
