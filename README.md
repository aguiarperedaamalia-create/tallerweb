# Taller automotriz "El Pistón" — versión web

Sistema web para controlar el trabajo diario de un taller mecánico de barrio: clientes, vehículos, órdenes de servicio, trabajos, repuestos, inventario, pagos y reportes.

- **Servidor:** PocketBase v0.40 (colecciones, relaciones, reglas de acceso, vistas SQL y hooks en JavaScript).
- **Cliente:** HTML, CSS y JavaScript sin frameworks, usando el SDK oficial de PocketBase (`pocketbase.es.mjs`).

## Estructura

```
taller-el-piston/
├── servidor/
│   ├── pb_migrations/      Colecciones, reglas, vistas y datos de demostración
│   └── pb_hooks/           Lógica de negocio del lado del servidor
│       ├── taller.pb.js
│       └── lib/taller.js
├── cliente/
│   ├── *.html              Una página por pantalla
│   ├── css/estilos.css
│   ├── img/logo.svg
│   └── js/
│       ├── config.js       URL del servidor, moneda, tamaño de página
│       ├── api.js          Instancia del SDK, sesión, roles y errores
│       ├── ui.js           Utilidades de interfaz (formatos, avisos, diálogos)
│       ├── plantilla.js    Barra superior, menú por rol y alertas en tiempo real
│       ├── registros.js    Normalización y guardado de clientes, vehículos y repuestos
│       ├── lib/            SDK de PocketBase
│       └── paginas/        Un módulo por página
├── capturas/
└── README.md
```

## Cómo ejecutar

1. Descargar PocketBase **v0.40.x** para su sistema desde <https://pocketbase.io/docs/> y colocar el ejecutable dentro de `servidor/`.
2. Abrir una terminal en `servidor/` y ejecutar:

   ```bash
   ./pocketbase serve --http=0.0.0.0:8090 --publicDir=../cliente
   ```

   En Windows: `pocketbase.exe serve --http=0.0.0.0:8090 --publicDir=../cliente`

   Al iniciar, PocketBase aplica automáticamente las migraciones de `pb_migrations` (crea las colecciones y los datos de demostración) y carga los hooks de `pb_hooks`.

3. Abrir <http://127.0.0.1:8090> en el navegador. Desde un teléfono en la misma red Wi-Fi, abrir `http://IP-DE-LA-PC:8090`.
4. Panel de administración de PocketBase: <http://127.0.0.1:8090/_/> con `admin@elpiston.cu` / `admin-piston-2026`.

**Alternativa con VS Code:** ejecutar solo `./pocketbase serve --http=0.0.0.0:8090` y abrir la carpeta `cliente/` con la extensión Live Server (puerto 5500). El cliente se conecta al puerto 8090 del mismo equipo.

> El cliente usa módulos ES (`type="module"`), por eso debe abrirse desde un servidor HTTP y no con doble clic sobre el archivo.

### Cuentas de demostración

| Rol       | Correo                | Contraseña |
| --------- | --------------------- | ---------- |
| Dueño     | dueno@elpiston.cu     | piston2026 |
| Recepción | recepcion@elpiston.cu | piston2026 |
| Mecánico  | raul@elpiston.cu      | piston2026 |
| Mecánico  | yoandry@elpiston.cu   | piston2026 |

Para empezar sin datos de ejemplo, borrar `servidor/pb_migrations/1793837000_datos_demo.js` antes del primer arranque (o borrar `pb_data/` y volver a iniciar).

## Modelo de datos

| Colección                 | Campos principales                                                                                                  | Relaciones                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `users` (auth)            | name, email, **rol** (dueno, recepcion, mecanico)                                                                   | —                                                          |
| `clientes`                | nombre, telefono, direccion                                                                                         | —                                                          |
| `vehiculos`               | matricula (única), marca, modelo, anio, kilometraje                                                                 | cliente → clientes                                         |
| `repuestos`               | nombre, codigo (único), precio, existencias, stock_minimo                                                           | —                                                          |
| `ordenes`                 | fecha_entrada, fecha_entrega, problema, kilometraje, estado, total_mano_obra, total_repuestos, total, pagado, saldo | vehiculo → vehiculos, cliente → clientes, mecanico → users |
| `trabajos`                | descripcion, precio                                                                                                 | orden → ordenes (borrado en cascada)                       |
| `orden_repuestos`         | cantidad, precio_unitario                                                                                           | orden → ordenes (cascada), repuesto → repuestos            |
| `pagos`                   | monto, metodo, nota                                                                                                 | orden → ordenes                                            |
| `saldos_clientes` (vista) | nombre, telefono, ordenes_pendientes, saldo                                                                         | —                                                          |
| `carga_mecanicos` (vista) | nombre, abiertas, recibidas, en_diagnostico, en_reparacion, listas                                                  | —                                                          |

Un cliente tiene muchos vehículos; un vehículo tiene muchas órdenes; una orden tiene muchos trabajos, repuestos usados y pagos.

## Reglas de acceso

| Colección                      | Ver                           | Crear / editar                                                                                                  | Eliminar        |
| ------------------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------- |
| clientes, vehiculos, repuestos | Cualquier usuario autenticado | Dueño y recepción                                                                                               | Dueño           |
| ordenes                        | Autenticados                  | Crear: dueño y recepción. Editar: dueño, recepción o el mecánico asignado (sin reasignar, entregar ni cancelar) | Dueño           |
| trabajos, orden_repuestos      | Autenticados                  | Dueño, recepción o el mecánico asignado a esa orden                                                             | Igual que crear |
| pagos                          | Dueño y recepción             | Dueño y recepción                                                                                               | Dueño           |
| users                          | Autenticados                  | Dueño (el registro público queda cerrado)                                                                       | Dueño           |
| saldos_clientes                | Dueño y recepción             | —                                                                                                               | —               |
| carga_mecanicos                | Autenticados                  | —                                                                                                               | —               |

## Decisiones de diseño

1. **Roles en el usuario.** Se agregó el campo `rol` a la colección `users`. Las reglas de PocketBase usan `@request.auth.rol` para decidir qué puede hacer cada quien. Ningún usuario puede cambiarse su propio rol y el registro público quedó desactivado.
2. **La orden guarda el cliente.** Además del vehículo, la orden guarda el cliente que lo trajo (se copia en el servidor desde el dueño del vehículo). Así el historial y la deuda de cada cliente no cambian si el vehículo se vende más adelante.
3. **Los totales los calcula el servidor.** Mano de obra, repuestos, total, pagado y saldo se recalculan en los hooks cada vez que cambia un trabajo, un repuesto o un pago. Si el cliente web envía otros valores, se ignoran.
4. **El precio del repuesto se congela.** Al usar un repuesto se copia su precio actual a `precio_unitario`. Si el precio de venta sube después, las órdenes viejas no cambian.
5. **El inventario se descuenta en el servidor y dentro de una transacción.** Al agregar un repuesto a una orden, se valida que haya existencias, se guarda la línea, se descuentan las unidades y se recalcula la orden en una sola transacción. Al quitarlo, las unidades vuelven al inventario.
6. **Ciclo de estados.** recibida → en diagnóstico → en reparación → lista para entregar → entregada. También puede quedar cancelada. Mientras está abierta se puede mover a cualquier estado abierto. Entregada y cancelada son finales: ya no admiten trabajos ni repuestos. Una orden entregada sí admite pagos pendientes.
7. **Pagos parciales.** Una orden acepta varios pagos y ninguno puede superar el saldo. Se permite entregar el vehículo con saldo pendiente, avisando antes al usuario, porque hay clientes que pagan en dos partes.
8. **Cancelación segura.** No se puede cancelar una orden con repuestos (hay que retirarlos para devolverlos al inventario) ni con pagos. Tampoco se puede reducir el total de una orden por debajo de lo ya pagado.
9. **Kilometraje.** La orden registra el kilometraje de llegada y actualiza el del vehículo. Se rechaza un valor menor al último registrado.
10. **Reportes con vistas SQL.** El saldo por cliente y la carga por mecánico son colecciones de tipo vista: PocketBase hace la agregación en la base de datos y el cliente solo las lee.
11. **Facturación.** "Facturado" es el total de las órdenes entregadas en el período y "cobrado" es la suma de los pagos recibidos en el período.
12. **Aviso de stock bajo.** Cada repuesto tiene un stock mínimo. El panel y el inventario muestran los que están en el mínimo o por debajo, y todas las pantallas muestran una alerta en tiempo real cuando un repuesto llega a ese nivel.
13. **Tiempo real.** Las pantallas se suscriben a los cambios de PocketBase (SSE). Si recepción registra una orden, el teléfono del mecánico la ve sin recargar.
14. **Interfaz pensada para el móvil.** El diseño parte de la pantalla del teléfono, con menú inferior y botones grandes. En pantallas anchas pasa a menú lateral y a dos columnas. Incluye diálogos nativos (`<dialog>`), validación en los formularios, esqueletos de carga, avisos y estados vacíos.
15. **Sin dependencias externas.** El SDK está incluido en `cliente/js/lib` y se usan fuentes del sistema, así que la aplicación funciona en una red local sin internet.
