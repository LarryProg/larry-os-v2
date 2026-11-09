# Larry OS v2

Versión nueva del OS. La v1 (repo `LarryProg/larry-os`) **no se tocó** y sigue funcionando igual.

## Qué cambió

**Arreglos de datos**
- Sincronización con GitHub que **combina por módulo**. Si dos dispositivos cambian cosas distintas, junta ambas. Si cambian lo mismo, te pregunta qué conservar ("Juntar los dos", "Este dispositivo" o "GitHub"). Ya no pisa datos.
- Usa su propio archivo de datos (`larry-os-v2-data.json`), así la v1 y la v2 no chocan. La primera vez puede importar el de la v1.
- Los archivos de más de 1 MB ahora se leen bien.
- Las llamadas cargadas a mano y la configuración del calendario entran en el backup y en la sincronización.
- Aviso en todos los módulos cuando el almacenamiento está lleno. Las fotos de MyBoard se comprimen.
- Si un dato se corrompe, se guarda una copia aparte en vez de borrarse.
- Clientes:
  - los borrados ya no reaparecen;
  - los bonus no se pierden;
  - el vínculo entre módulos es por id, no por nombre;
  - lo cobrado vive en Finanzas.
- Fechas en hora local: medianoche ya no cuenta como ayer.
- Borrados con "Deshacer" o con confirmación.
- El valor de los leads entiende "1.200", "300,50" y "€400".

**Nuevo**
- **Hoy** (pantalla de inicio): seguimientos vencidos, cobros, llamadas, contenido del día, post-venta (pedir testimonio y ofrecer el siguiente tema) y leads de Meta sin contactar.
- **WhatsApp con plantillas** desde Hoy, el Pipeline y la ficha del lead. Las plantillas se editan.
- **Convertir lead → cliente** con un clic. Abre Finanzas ya completado y vincula los dos.
- Ficha del lead:
  - **Checklist de llamada**: presupuesto, nº de temas, fecha, decisor, objeción, Fathom, resultado y seña enviada.
  - **Motivo de pérdida** obligatorio.
  - **Modalidad**: Online 300 € o Con estudio 400 €.
- **Pipeline**:
  - primero lo que hay que seguir hoy;
  - avisos de vencidos;
  - filtros;
  - etapa "Llamada".
- **Métricas del CRM** por año:
  - cierre por fuente y por mes;
  - embudo;
  - ticket medio y días hasta cerrar;
  - Meta: costo por lead, costo por cliente y ROI real (solo ventas de Meta);
  - motivos de pérdida;
  - cobros de los próximos 30 días y pipeline ponderado.
- **Fiscal**:
  - datos de la SL;
  - facturas numeradas de cada cobro;
  - IVA según país y tipo de cliente;
  - resumen trimestral (303) y CSV para el gestor.
  - Es orientativo: confirmá los tipos de IVA con la gestoría.
- **Producción** vuelve a tener botón: es el módulo de tarjetas con etapas y bonus.
- Buscador (Ctrl/Cmd+K):
  - abre el lead;
  - también busca en leads de Meta y Networking;
  - se maneja con ↑ ↓ Enter.
- En el móvil, una barra superior evita que el ☰ tape los títulos.

**Seguridad**
- La **firma ya no está en el código**. Se carga una vez desde Contratos y viaja en tus datos privados. La original quedó en `privado/firma-larry.png` (esa carpeta no se publica).
- `noindex` para que Google no la indexe.
- Los links solo abren `http(s)`.
- El aviso del token recomienda uno *fine-grained* con acceso solo al repo de datos.

## Estructura

```
index.html          la página (estructura de los módulos)
css/app.css         estilos originales
css/v2.css          estilos nuevos (Hoy, Fiscal, móvil, foco)
js/storage.js       lista única de datos + protecciones (carga primero)
js/global.js        cambio de módulo, backup, deshacer
js/finanzas.js      Finanzas
js/clientes.js      Producción (tarjetas)
js/crm.js           CRM — GENERADO desde src/crm.jsx (no editar a mano)
js/ventas.js        WhatsApp, convertir lead, motivos de pérdida
js/hoy.js           pantalla Hoy
js/fiscal.js        facturas e IVA
js/sync.js          sincronización con GitHub
js/agenda.js, notas.js, recursos.js, confirm-search.js, mobile.js
myboard.html        MyBoard
contratos.html      Contratos
vendor/             React y Chart.js (ya no dependen de un CDN)
src/crm.jsx         código fuente del CRM
tools/build.mjs     compila src/crm.jsx → js/crm.js
```

## Cómo editar

- Cualquier archivo de `js/`, `css/` o los `.html`: se edita y se recarga. No hace falta compilar nada.
- **Solo el CRM** (`src/crm.jsx`): después de editarlo, doble clic en `build.bat` (o `node tools/build.mjs`).
- Para probar en local: `node .claude-serve.js` y abrir http://localhost:8944

## Cómo publicarla (cuando quieras)

1. Crear un repo nuevo (por ejemplo `LarryProg/larry-os-v2`) y subir esta carpeta **sin** `original/` ni `privado/` (ya están en `.gitignore`).
2. Activar GitHub Pages en `main`.
3. Si se publica en `larryprog.github.io`, comparte el navegador con la v1 y ve los mismos datos. Si se publica en un dominio propio, hay que configurar la sincronización una vez (⚙), y ahí descarga tus datos.
4. En Contratos, cargar la firma una vez desde `privado/firma-larry.png`.

## Pendiente que depende de vos

- Cambiar el token de GitHub por uno **fine-grained** con acceso solo a `larry-os-data`.
- Si usaste la opción ICS del calendario, **regenerar** la dirección secreta en Google Calendar: pasa por un proxy de terceros (corsproxy.io).
- La firma sigue en el **historial público** del repo v1. Para borrarla de ahí hay que reescribir ese historial o recrear el repo.
- Para separar el OS de las otras páginas de `larryprog.github.io` (que cargan el píxel de Meta y Clarity), lo ideal es un dominio propio.
