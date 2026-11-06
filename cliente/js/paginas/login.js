import { pb, iniciarSesion, mensajeError } from "../api.js"
import { $, conCarga, datosFormulario, mostrarErrorFormulario } from "../ui.js"

if (pb.authStore.isValid) {
  location.replace("index.html")
}

const formulario = $("#formulario-acceso")

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault()
  mostrarErrorFormulario(formulario, "")

  if (!formulario.checkValidity()) {
    mostrarErrorFormulario(formulario, "Escriba un correo válido y una contraseña de al menos 8 caracteres.")
    return
  }

  const { email, password } = datosFormulario(formulario)

  await conCarga(formulario.querySelector("button[type=submit]"), async () => {
    try {
      await iniciarSesion(email.trim(), password)
      location.replace("index.html")
    } catch (error) {
      const mensaje = error.status === 400 ? "Correo o contraseña incorrectos." : mensajeError(error)
      mostrarErrorFormulario(formulario, mensaje)
    }
  })
})
