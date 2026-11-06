const servidor = location.hostname || "127.0.0.1"

export const PB_URL = `${location.protocol === "https:" ? "https" : "http"}://${servidor}:8090`
export const MONEDA = "USD"
export const POR_PAGINA = 10
