# Bodega analitica de Cuenti

## Objetivo

Construir una fuente historica propia en PostgreSQL para analizar ventas,
productos, precios, costos, utilidad, inventario, compras, gastos y pagos sin
consultar Cuenti cada vez que se abre un informe.

La bodega no reemplaza a Cuenti. Cuenti sigue siendo la fuente de los documentos
comerciales y la aplicacion conserva sus procesos operativos de bloques,
domicilios, transporte y pendientes por entregar.

## Capas

### Operacion

El esquema `public` conserva las tablas utilizadas por la aplicacion: productos,
clientes, bloques, domicilios, inventario y costos de transporte.

### Integracion

El esquema `integration` registra:

- El JSON original recibido desde Cuenti.
- El resultado y los errores de cada sincronizacion.
- La ventana de fechas y pagina pendiente.
- La ultima sincronizacion completada.

### Analitica

El esquema `analytics` contiene dimensiones de fechas, clientes y productos,
ademas de los hechos de ventas y productos vendidos.

Las vistas `daily_sales`, `monthly_sales` y `product_performance` son la base de
los primeros tableros.

## Reglas de sincronizacion

1. La carga historica comienza en `CUENTI_ANALYTICS_START_DATE`.
2. El historico avanza por ventanas mensuales.
3. Cada ejecucion procesa un numero limitado de paginas y guarda la siguiente.
4. Una ejecucion repetida actualiza los registros existentes y no crea
   duplicados.
5. Las facturas anuladas se marcan; no se eliminan de la historia.
6. Al alcanzar el dia actual, la carga cambia a modo incremental.
7. El modo incremental vuelve a consultar los ultimos dias configurados para
   capturar modificaciones, devoluciones o anulaciones.

## Reglas financieras

- Venta neta: valor antes de impuestos y despues de descuentos o devoluciones.
- Costo de venta: costo historico de la linea de factura.
- Utilidad bruta: venta neta menos costo de venta.
- Margen bruto: utilidad bruta dividida entre venta neta.
- Las compras de inventario no se registran como gasto operativo.
- Los gastos de transporte se presentan separados del costo del producto.
- Si Cuenti no entrega costo, se utiliza el costo local vigente y se identifica
  su origen.
- Las lineas sin costo quedan marcadas para evitar utilidades ficticias.

## Plan de implementacion

### Fase 1 - Fundacion y ventas

- Crear los esquemas de integracion y analitica.
- Sincronizar facturas y productos vendidos.
- Guardar costos, impuestos, pagos, saldos y anulaciones.
- Registrar el estado de cada sincronizacion.

### Fase 2 - Analisis comercial

- Tablero de ventas diarias y mensuales.
- Ranking de productos, categorias y lineas.
- Margen, productos con perdida y productos sin costo.
- Comparacion de precio actual contra precio y costo historicos.
- Recomendaciones de precio con margen objetivo administrable.

### Fase 3 - Inventario y compras

- Guardar inventario diario de Cuenti. Implementado.
- Incorporar compras y proveedores. Implementado por ID de compra.
- Analizar rotacion, dias de inventario y productos inmovilizados.
- Controlar quiebres de stock y sugerencias de compra.

### Fase 4 - Gastos, pagos y utilidad

- Sincronizar pagos disponibles en la API. Implementado.
- Incorporar gastos y compras mediante API o importacion controlada. Implementado.
- Unificar costos de transporte y gastos generales. Implementado.
- Calcular utilidad bruta, utilidad operativa y flujo de caja. Implementado.

### Fase 5 - Automatizacion y control

- Ejecutar la sincronizacion incremental en Render. Implementado cada hora.
- Agregar conciliacion contra totales de Cuenti.
- Notificar fallas, documentos duplicados y costos faltantes.
- Permitir reprocesar periodos historicos sin perder trazabilidad.

## Criterios de control

- Una factura de Cuenti solo puede existir una vez por sucursal.
- La suma de lineas debe conciliar con el encabezado de la factura.
- Toda diferencia queda visible y no se corrige silenciosamente.
- Los costos utilizados en ventas historicas no cambian al editar el producto.
- Cada indicador del tablero debe permitir llegar hasta la factura y sus lineas.

## Limitacion de compras en Cuenti

La documentacion disponible permite consultar el detalle de una compra por ID,
pero no ofrece un endpoint para listar compras. Por esa razon la aplicacion
permite registrar varios IDs desde Administracion > Integracion Cuenti y conserva
el JSON original para mantener la trazabilidad. La automatizacion de compras
quedara habilitada cuando Cuenti publique un listado paginado.

## Automatizacion

Render consulta periodicamente `/api/health`. La primera consulta inicia un
programador interno, protegido con bloqueos de PostgreSQL, que sincroniza ventas
y pagos por paginas y guarda una fotografia de inventario al dia. La frecuencia
se controla con `CUENTI_AUTO_SYNC_INTERVAL_MINUTES`.
