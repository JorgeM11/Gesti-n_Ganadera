# Historial de Cambios - Gestión Ganadera

Este documento registra de forma cronológica todas las modificaciones, mejoras, nuevas funcionalidades y correcciones aplicadas sobre el sistema **Gestión Ganadera**.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [1.7.23-complete-animal-arete-o-chip] - 2026-10-19

### Corregido (Identificación Flexible: Arete o Microchip Alternativo al Completar Animal en Vaquería)
- **Validación Alternativa de Identificadores ([`CompleteAnimalModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/vaqueria/CompleteAnimalModal.jsx), [`vaqueriaUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/vaqueriaUtils.js))**:
  - *Problema resuelto*: El modal para completar información de un animal no registrado en vaquería exigía obligatoriamente el número de arete (`if (!number.trim())`), bloqueando el guardado de animales que únicamente cuentan con microchip RFID o que fueron escaneados por primera vez mediante chip.
  - *Comportamiento corregido*: Siguiendo la regla global del sistema (establecida en [`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx)), el animal ahora puede registrarse con **número de arete, con microchip RFID (15 dígitos), o con ambos**. Solo se bloquea si ambos campos están vacíos.
  - *Validación inteligente de duplicados*:
    - Si se ingresa arete: se valida que no exista otro animal activo con el mismo arete en la finca.
    - Si se ingresa microchip: se valida su longitud de 15 dígitos numéricos y que ningún otro animal en el sistema tenga ese chip asignado.
  - *Prellenado según tipo de escaneo*: Al abrir el modal, si el animal fue detectado por chip (`identification_type === 'chip'`), el microchip se coloca automáticamente en el campo de chip y el campo de arete queda libre para que el usuario decida si asignarle uno o no.
  - *Interfaz y visualización ([`CompleteAnimalModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/vaqueria/CompleteAnimalModal.jsx), [`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))*:
    - Etiquetas contextuales (`o chip` / `o arete`) e indicación visible de que al menos uno de los dos es requerido.
    - Subtítulo del modal y notificación de éxito adaptados dinámicamente según el identificador provisto (`Arete #...` o `Microchip ...`).
    - En la lista de presentes de la vaquería, si un animal solo tiene microchip, se muestra claramente como `Chip ...` en lugar de `Sin arete`.

---

## [1.7.22-fix-remove-last-vaqueria-animal] - 2026-10-19

### Corregido (Eliminación Inmediata al Retirar el Último Animal de la Vaquería)
- **Corrección de Eliminación al Primer Clic ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx), [`vaqueriaUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/vaqueriaUtils.js))**:
  - *Problema resuelto*: Al retirar el último animal presente en una vaquería (cuando solo quedaba 1 registro en la lista), al pulsar "Quitar" el sistema iniciaba la sincronización pero el animal no desaparecía de la pantalla, requiriendo pulsar el botón de borrar una segunda vez para que se eliminara efectivamente. Cuando había varios animales, el problema no ocurría.
  - *Causa raíz*: El buffer de persistencia reactiva (`lastPresentRecordsRef`) evaluaba `(presentRecords && presentRecords.length > 0) ? presentRecords : lastPresentRecordsRef.current`. Cuando se eliminaba el último animal, `presentRecords` pasaba legítimamente a tener longitud 0 (`[]`), pero la condición interpretaba el array vacío como un fallo transitorio y reinyectaba el animal en caché (`lastPresentRecordsRef.current`), impidiendo que la interfaz pasara a estado vacío hasta un segundo intento de borrado.
  - *Solución*: Se eliminó la sobreescritura del buffer sobre listas vacías legítimas, enlazando `effectivePresentRecords` de manera directa a la consulta reactiva de Dexie (`presentRecords`). Ahora el último animal se retira instantáneamente en el primer clic y la pantalla muestra correctamente el estado vacío sin necesidad de confirmaciones repetidas. Se sincronizó también `updated_at` en el payload de actualización para Supabase.

---

## [1.7.21-mobile-farm-select-filter] - 2026-10-19

### Añadido y Mejorado (Filtro Select de Finca en Móvil para Dashboard y Vaquerías)
- **Filtro de Finca como `CustomSelect` en Móvil ([`Dashboard.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Dashboard.jsx), [`Vaquerias.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Vaquerias.jsx))**:
  - *Comportamiento adaptable*: En pantallas móviles (`block md:hidden`), el selector de finca horizontal ahora se muestra como un selector estilizado flotante `CustomSelect` con los estilos estándar del sistema (fondo `bg-neutral-50`, bordes redondeados, menú animado y checkmark de selección).
  - *Preservación en escritorio*: En pantallas de escritorio (`hidden md:flex` / `hidden md:block`), se preserva el carrusel de píldoras horizontales con conteo individual de cabezas y vaquerías.
- **Reposicionamiento en Vaquería ([`Vaquerias.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Vaquerias.jsx))**:
  - En la vista de vaquerías para móviles, el selector `CustomSelect` de fincas se posicionó estratégicamente **por encima de la barra de búsqueda**, permitiendo delimitar primero la finca de trabajo antes de filtrar o buscar por texto.

---

## [1.7.20-mobile-keyboard-and-vaqueria-defaults] - 2026-10-19

### Mejorado y Corregido (Experiencia Móvil y Formularios de Vaquería)
- **Nombre Predeterminado "Vaquería" al Crear ([`VaqueriaModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/vaqueria/VaqueriaModal.jsx))**:
  - Al abrir el modal de nueva vaquería, el nombre predeterminado ahora se inicializa simplemente como `"Vaquería"` (en lugar de componer automáticamente `"Vaquería Mes Año"`), otorgando al usuario un punto de partida directo y limpio.
- **Eliminación de Autoenfoque en Modales de Vaquería ([`VaqueriaModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/vaqueria/VaqueriaModal.jsx), [`CompleteAnimalModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/vaqueria/CompleteAnimalModal.jsx), [`ManualAddModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/vaqueria/ManualAddModal.jsx))**:
  - Se eliminó el atributo `autoFocus` y los enfoques automáticos programáticos al abrir los modales de creación de vaquería, edición de vaquería, completar información de animal y asistencia manual.
  - Esto evita que el teclado virtual en dispositivos móviles o tablets se abra automáticamente tapando el formulario o los botones de acción, permitiendo que el operario revise la información y decida libremente cuándo tocar el input para enfocarlo.
- **Prevención de Despliegue Involuntario del Teclado en Móvil tras Escaneo ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx), [`BarcodeScannerModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/BarcodeScannerModal.jsx))**:
  - *Problema resuelto*: Al escanear un animal mediante la cámara del móvil o lector RFID, el sistema enfocaba automáticamente el campo de escaneo tras procesar la asistencia (`setTimeout(focusScanInput, 60)`), forzando al navegador móvil a desplegar el teclado en pantalla y tapar la lista de animales y métricas.
  - *Solución*:
    1. Se incorporó detección de entorno móvil/táctil (`isMobileOrTouchDevice`).
    2. En dispositivos móviles y táctiles, se omite cualquier autoenfoque forzado en montado y toques sobre la pantalla (`pointerdown`).
    3. En el bloque de finalización de escaneo (`handleProcessScan.finally`), en móviles se ejecuta un desenfoque explícito atómico (`scanInputRef.current?.blur()` y `document.activeElement?.blur()`), asegurando que el teclado virtual permanezca oculto en todo momento tras registrar cada animal.
    4. En el modal de escáner con cámara (`BarcodeScannerModal`), se desenfoca cualquier elemento activo previo al cierre del modal.
    5. Se agregó `virtualKeyboardPolicy="manual"` en el campo de escaneo continuo.

---

## [1.7.19-fix-vaqueria-sync-flicker] - 2026-10-18

### Corregido (Persistencia Continua de Animales en Lista de Vaquería durante Sincronización)
- **Eliminación de Desaparición Transitoria de Animales ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx), [`syncUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/syncUtils.js), [`vaqueriaUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/vaqueriaUtils.js))**:
  - *Problema resuelto*: Al escanear un animal con el lector RFID, este se registraba y aparecía correctamente en la lista de presentes. Sin embargo, cuando el motor de sincronización iniciaba la subida y descarga en segundo plano (`syncStatus === 'SYNCING'`), el animal desaparecía momentáneamente de la pantalla y regresaba únicamente al finalizar la sincronización (`UP_TO_DATE`).
  - *Causas identificadas*:
    1. La consulta `useLiveQuery` de `currentVaqueria` utilizaba una promesa con `setTimeout(120)` interno, lo que rompía la zona de Dexie durante las operaciones `bulkPut` de la sincronización y devolvía transitoriamente `null`, provocando que `analysis` se reseteara a `null` y vaciara la lista (`classifiedPresent = []`).
    2. La reconciliación de borrados en `syncUtils.js` (`pullFromServer`) no contaba con ventana de gracia para registros recién creados/escaneados tras su eliminación de la cola de subida (`sync_queue`), exponiéndolos a carreras temporales con Supabase.
    3. `addAnimalToVaqueria` y `createVaqueria` guardaban localmente `user_id = workerId` para obreros en vez de `effectiveUserId` (el ID del administrador asignado), provocando que la sincronización con Supabase mutara el registro al descargarlo y reiniciara las consultas reactivas.
  - *Solución integral implementada*:
    1. **Eliminación del `setTimeout` en `useLiveQuery`**: La consulta de `currentVaqueria` ahora se ejecuta directamente sobre Dexie sin demoras artificiales, vinculándose a `effectiveVaqueria = currentVaqueria || initialVaqueria`.
    2. **Buffers de Persistencia Reactiva (`lastPresentRecordsRef` y `lastAnalysisRef`)**: Si durante una ráfaga de escritura transaccional en IndexedDB `presentRecords` o `analysis` llegaran a evaluarse temporalmente vacíos, el componente mantiene en pantalla los registros activos de la vaquería actual hasta que la nueva evaluación confirme los datos.
    3. **Protección en Reconciliación de Borrados**: Todo registro local creado en los últimos 90 segundos queda estrictamente protegido contra eliminación en `pullFromServer`, eliminando cualquier carrera temporal.
    4. **Titularidad Consistente de Datos**: `createVaqueria` y `addAnimalToVaqueria` utilizan desde el momento de su inserción local el `effectiveUserId`, garantizando 100% de coherencia entre Dexie y Supabase.

---

## [1.7.18-farm-isolation-vaqueria] - 2026-10-18

### Añadido y Validado (Aislamiento Estricto de Animales por Finca en Vaquería)
- **Validación de Pertenencia de Finca ([`vaqueriaUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/vaqueriaUtils.js), [`ManualAddModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/vaqueria/ManualAddModal.jsx), [`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - *Problema resuelto*: Al realizar una sesión de vaquería en una finca (ej. Finca 1), si el usuario escaneaba un chip RFID, leía un código de barras con la cámara o ingresaba manualmente un animal registrado en otra finca (ej. Finca 2), el sistema lo registraba en la asistencia como si fuera nuevo de la vaquería.
  - *Solución*: Se implementó validación centralizada en `addAnimalToVaqueria` y preventiva en `ManualAddModal`. Si el animal encontrado en inventario pertenece a otra finca (`targetAnimal.farm_id !== effectiveFarmId`), se rechaza la operación inmediatamente con sonido de error `playErrorBeep()` y el mensaje explícito: `El animal [Arete # / Chip] no pertenece a esta finca (pertenece a la finca "[Nombre de Finca]").`
  - *Feedback Visual Específico*: El banner flotante muestra el título `"Animal de Otra Finca"` en rojo con ícono de error y se extiende su tiempo en pantalla a 3.5 segundos para facilitar la lectura del operario.
  - *Historial y Trazabilidad*: En caso de animales que hubiesen sido registrados previamente durante pruebas, se identifican con la insignia `"Otra finca"` en color rosa en la lista de presentes para facilitar su remoción.

---

## [1.7.17-react-hooks-order-vaqueria] - 2026-10-18

### Corregido (Cumplimiento Estricto de Reglas de Hooks de React en Detalle de Vaquería)
- **Eliminación de Retornos Tempranos Previos a Hooks ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - *Problema resuelto*: Al crear una nueva vaquería o abrirla directamente, la pantalla se ponía en blanco con el error `Uncaught Error: Rendered fewer hooks than expected. This may be caused by an accidental early return statement.` en `<VaqueriaDetallePage>`. Esto ocurría porque los estados condicionales de carga (`if (currentVaqueria === undefined) return ...`) y vaquería no encontrada (`if (currentVaqueria === null) return ...`) estaban posicionados antes de 7 llamadas a `useMemo` (`filteredPresent`, `filteredMissing`, `uncompletedList`, `filteredUncompleted`, `paginatedPresent`, `paginatedMissing`, `paginatedUncompleted`), alterando el orden y la cantidad de hooks entre renders.
  - *Solución*: Se reordenaron todas las definiciones de hooks (`useMemo`, `useRef`, `useEffect`) hacia el nivel superior incondicional del componente, garantizando que cada render invoque exactamente el mismo conjunto de hooks en idéntico orden antes de cualquier sentencia `return`.
- **Estabilización de Dependencias en `useEffect` ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - *Problema resuelto*: Error `The final argument passed to useEffect changed size between renders. The order and size of this array must remain constant. Previous: [false, ..., En progreso] Incoming: [false, ..., En progreso, ]`.
  - *Solución*: Se estabilizó el array de dependencias a un tamaño constante de 3 elementos (`[isAnyModalOpen, currentVaqueria?.id, currentVaqueria?.status]`), eliminando dependencias transitorias como `scanInputValue`. La lectura del código escaneado se realiza directamente desde la referencia del input DOM (`scanInputRef.current.value`) y el despachador se desacopló mediante `handleProcessScanRef`.

---

## [1.7.16-scanner-antirebound-input-clear] - 2026-10-18

### Corregido y Perfeccionado (Estabilidad de Escáner Físico RFID / Código de Barras en Vaquería e Inventario)
- **Eliminación de Carrera y Doble Registro por Escáner ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - *Problema resuelto*: Al escanear con lectores físicos Bluetooth o USB-OTG, la detección automática de 15 dígitos y el evento final de tecla `Enter` disparaban dos consultas simultáneas. La primera registraba con éxito la asistencia y la segunda fracción de segundo después arrojaba una falsa alarma de error *"Animal ya registrado"*.
  - *Solución*: Implementado candado de concurrencia (`isProcessingScanRef`) y protección antirrebote (`lastProcessedScanRef`) con ventana de 1200ms que descarta disparos duplicados del mismo microchip. Cancelación inmediata del temporizador al recibir `Enter`.
- **Limpieza Garantizada del Input de Escaneo ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx), [`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx))**:
  - *Problema resuelto*: Cuando un animal resultaba duplicado o el código era inválido, el texto permanecía atrapado en la caja de texto, haciendo que lecturas posteriores acumularan caracteres (30 dígitos) o fallaran de forma repetitiva.
  - *Solución*: Creación de `clearAllScanInputs()` que borra atómicamente tanto el estado React como el elemento físico del DOM (`scanInputRef.current.value = ''`) y los buffers internos, ejecutándose incondicionalmente en el bloque `finally` para cualquier resultado (éxito, duplicado, inactivo, error de formato o descarte).

---

## [1.7.15-daily-weight-gain-events] - 2026-10-18

### Añadido y Perfeccionado (Ganancia y Pérdida Diaria de Peso en Eventos de Evolución)
- **Tasa de Ganancia o Pérdida Diaria ([`EvolutionTab.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/EvolutionTab.jsx))**:
  - Al lado de la insignia de ganancia/pérdida total de peso (`+XX.X kg` o `-XX.X kg`), ahora se calcula y muestra la **ganancia de peso por día o pérdida de peso por día** (ej. `+0.65 kg/día` o `-0.20 kg/día`).
  - Cálculo robusto de GDP (Ganancia Diaria de Peso): busca automáticamente el pesaje cronológicamente previo con peso válido, calculando los días transcurridos (`daysBetween`) y la tasa diaria con 2 decimales de precisión.
  - Formato visual adaptativo: renderizado en paralelo con envoltura responsiva (`flex-wrap`) para una lectura limpia tanto en teléfonos móviles como en computadoras de escritorio.

---

## [1.7.14-audit-trail-obrero-dashboard] - 2026-10-18

### Añadido y Corregido (Auditoría de Modificaciones por Obrero en Historial de Cambios)
- **Trazabilidad de Autoría en Animales ([`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx), [`EventForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/EventForm.jsx), [`vaqueriaUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/vaqueriaUtils.js))**:
  - Al crear o editar un animal, se registra el ID del usuario actuante (`localStorage.getItem('ganadera_user_id')`) en los campos `created_by_user_id` y `updated_by_user_id`.
  - La titularidad global (`user_id`) se mantiene intacta como el titular de la explotación (`effectiveUserId`), garantizando que la propiedad del rebaño pertenezca al administrador.
- **Historial de Cambios en Dashboard ([`Dashboard.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Dashboard.jsx))**:
  - En la tabla de "Actividad Reciente / Modificado Por", la autoría se resuelve prioritariamente desde `animal.updated_by_user_id || animal.created_by_user_id || animal.user_id`.
  - Al ser modificado por un obrero, el historial muestra explícitamente el nombre del obrero (ej. "Obrero Bomzai 1") y su placa de rol correspondiente en color ámbar (`OBRERO`), en lugar del administrador principal.
- **Esquema Dexie v10 ([`db.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/db.js))**:
  - Añadida versión 10 con índices para `created_by_user_id` y `updated_by_user_id` en el almacén `animals`.
- **Sincronización Resiliente y Descarga de Usuarios ([`syncUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/syncUtils.js))**:
  - Descarga del equipo: la tabla `usuarios` ahora descarga permanentemente al administrador y todos sus obreros asociados (`or(id.eq.adminId,admin_id.eq.adminId)`), asegurando que los nombres y roles de los obreros estén siempre disponibles localmente para resolver la auditoría en la UI.
  - Tolerancia a esquemas desfasados: captura de código `PGRST204` en caso de que la columna remota `updated_by_user_id` aún no haya sido creada en Supabase, reintentando automáticamente sin bloquear la cola de sincronización.

---

## [1.7.13-roles-obrero-system] - 2026-10-18

### Añadido y Perfeccionado (Sistema de Roles para Obrero / Operador y Asignación de Fincas)
- **Modelo Relacional de Asignación de Fincas (`usuario_farms`, Opción A)**:
  - Script SQL [`supabase_schema_usuario_farms.sql`](file:///C:/Users/joses/appganadera/gestion-ganadera/supabase_schema_usuario_farms.sql) con la tabla relacional `usuario_farms (id, user_id, farm_id, created_at, updated_at, deleted_at)`, índices de optimización, triggers para `updated_at` y políticas RLS.
  - Almacenamiento local en Dexie v9 (`usuario_farms: 'id, user_id, farm_id, updated_at, deleted_at'`) en [`db.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/db.js) para garantizar el funcionamiento 100% offline de las restricciones de campo.
  - Sincronización en [`syncUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/syncUtils.js): descarga de `usuario_farms` para el usuario activo y consulta de datos del titular (`effectiveOwnerId = admin_id`).
- **Control de Rutas y Redirecciones por Rol ([`App.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/App.jsx), [`Login.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Login.jsx))**:
  - `AdminOnlyRoute`: Bloquea acceso a `/dashboard`, `/vaquerias` y `/vaquerias/:id` para cuentas con rol de obrero u operador, redirigiéndolas inmediatamente a `/inventario`.
  - `DefaultRedirect`: En la ruta raíz (`/`) y rutas no encontradas (`*`), los administradores van a `/dashboard` y los obreros van directamente a `/inventario`.
  - En `Login.jsx`, tanto al iniciar sesión como si ya existía una sesión guardada, el obrero es dirigido directamente a `/inventario`.
- **Restricción de Menú Lateral ([`NavigationDrawer.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/NavigationDrawer.jsx))**:
  - Para obreros se ocultan los enlaces a **Dashboard** y **Vaquería**.
  - Se ocultan los accesos y modales de gestión administrativa de **Fincas**, **Potreros** y **Dueños**.
  - Se mantienen visibles únicamente **Inventario**, botón de **Respaldo** manual y **Cerrar Sesión**.
- **Filtros Restringidos en Inventario ([`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx))**:
  - La lista de animales solo incluye los que pertenecen a las fincas asignadas al obrero.
  - El filtro de Finca solo lista las fincas asignadas y oculta la opción "Sin finca asignada".
  - El filtro de Potrero solo muestra potreros pertenecientes a las fincas asignadas.
  - El filtro de Dueño solo muestra dueños que tienen animales presentes en las fincas asignadas.
- **Formulario de Registro y Edición de Animales ([`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx))**:
  - Ocultados los botones de creación `"+ Nuevo"` / `"+ Fincas"` para Dueño, Finca y Potrero cuando el usuario es obrero.
  - Selector de Finca restringido a las fincas asignadas (con auto-selección automática si el obrero solo tiene 1 finca asignada).
  - Selector de Potreros restringido a potreros de las fincas asignadas.
  - Selector de Dueños restringido a propietarios con ganado en las fincas asignadas.
  - Titularidad de datos: al registrar o editar animales y eventos de nacimiento, `user_id` se asigna automáticamente al `admin_id` titular para preservar la propiedad centralizada del rebaño.
- **Protección de Ficha de Animal y Eventos ([`PerfilAnimal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/PerfilAnimal.jsx), [`PerfilEvento.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/PerfilEvento.jsx), [`PerfilTratamiento.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/PerfilTratamiento.jsx), [`EventForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/EventForm.jsx), [`HealthForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/HealthForm.jsx))**:
  - Validación de acceso: si un obrero intenta abrir la ficha o registrar eventos/tratamientos para un animal fuera de sus fincas asignadas, se bloquea el acceso mostrando animal no encontrado.
  - Persistencia de eventos de crecimiento y tratamientos sanitarios bajo el `user_id` del administrador titular.

---

## [1.7.12-vaqueria-immutable-snapshot] - 2026-10-18

### Añadido y Perfeccionado (Instantánea Inmutable para Vaquerías Finalizadas)
- **Instantánea Congelada al Finalizar ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx), [`vaqueriaUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/vaqueriaUtils.js))**:
  - Al hacer clic en **"Finalizar Vaquería"**, el sistema genera y almacena una instantánea (`snapshot_data`) inmutable con el censo exacto de presentes, faltantes y métricas de ese día.
  - Cuando una vaquería tiene estado `Finalizada`, las listas y contadores se leen directamente de la instantánea congelada, asegurando que futuros movimientos de ganado entre fincas, ventas o muertes no alteren el reporte histórico.
  - Al pulsar **"Reabrir Vaquería"**, se restablece el modo dinámico y reactivo en tiempo real para permitir continuar el trabajo de campo.
- **Protección de Interfaz en Modo Finalizado ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - Se sustituyó la barra de escaneo continuo por un banner informativo de sólo lectura con icono de candado (`Lock`).
  - Se desactiva el listener de escaneo por teclado RFID para prevenir ingresos accidentales.
  - Se ocultan los botones destructivos o de edición (Quitar, Inactivar, Completar) en las tres pestañas mientras la vaquería esté finalizada.
- **Soporte en Base de Datos y Sincronización Cloud ([`supabase_update_vaqueria_snapshot.sql`](file:///C:/Users/joses/appganadera/gestion-ganadera/supabase_update_vaqueria_snapshot.sql), [`db.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/db.js), [`Vaquerias.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Vaquerias.jsx))**:
  - Se añadió la columna `snapshot_data JSONB NULL` en Supabase para sincronizar la instantánea inmutable entre dispositivos.
  - En la lista de tarjetas de vaquerías, las sesiones finalizadas obtienen su conteo de animales presentes directamente del snapshot.
- **Preservación de Textos del Usuario**:
  - Se conservó la simplificación del botón de acción en `VaqueriaModal` a `"Guardar"` y `"Comenzar"`.

---

## [1.7.11-vaqueria-ui-enhancements] - 2026-10-16

### Perfeccionado y Corregido (Identificación en Pestaña Nuevos, Iconos en Móvil/Tablet y Finca Bloqueada en Edición)
- **Visualización Limpia en Pestaña Nuevos ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - Si un animal no registrado carece de arete pero posee microchip, el sistema ahora muestra `"Sin arete"` en su columna principal y el microchip en su badge correspondiente, evitando la duplicación visual del número de chip uno al lado del otro.
- **Acciones Visibles con Color en Móvil y Tablet ([`Vaquerias.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Vaquerias.jsx))**:
  - En la vista general de vaquerías para pantallas táctiles (móviles y tablets), los botones de acción de cada tarjeta ahora cuentan con color de fondo y texto claramente diferenciados (Editar en verde esmeralda, Eliminar en rojo y Navegación en verde institucional), eliminando la dependencia del evento `hover` de ratón.
- **Bloqueo del Selector de Finca al Editar ([`CustomSelect.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/ui/CustomSelect.jsx), [`VaqueriaModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/vaqueria/VaqueriaModal.jsx))**:
  - Se añadió la propiedad `disabled` a `CustomSelect` con estilos deshabilitados claros y bloqueo de interacción.
  - En el modal de edición de vaquería, la finca asociada queda inmutable para garantizar la integridad histórica del inventario evaluado.
- **Preservación de Ajustes de Texto**:
  - Se mantuvieron intactas las personalizaciones de texto directo del usuario en los encabezados y diálogos de confirmación (`confirmText="Quitar"` y `confirmText="Eliminar"`).

---

## [1.7.10-user-text-refinements] - 2026-10-16

### Perfeccionado y Simplificado (Restauración de Textos y Etiquetas Concisas en Modales)
- **Modales de Asistencia y Registro ([`CompleteAnimalModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/vaqueria/CompleteAnimalModal.jsx), [`ManualAddModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/vaqueria/ManualAddModal.jsx))**:
  - En `CompleteAnimalModal`: se simplificó el título a `"Completar Registro"`, etiquetas a `"Microchip"`, `"Nombre (Opcional)"`, `"Color (Opcional)"`, `"Dueño"`, y el botón de acción principal a `"Guardar"`.
  - En `ManualAddModal`: se simplificó el título a `"Asistencia Manual"`, la pestaña a `"Chip"`, la etiqueta a `"Código de Microchip"`, y el botón de acción principal a `"Registrar"`.

---

## [1.7.9-vaqueria-chip-validation-and-sync-fix] - 2026-10-16

### Corregido y Optimizado (Validación Exclusiva de Chip en Escáner y Saneamiento de Sincronización)
- **Validación Estricta de Microchip RFID ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - El input de escaneo continuo y el lector de bastón RFID ahora admiten **únicamente** códigos de microchip de 15 dígitos numéricos (estándar ISO).
  - Se bloquea el ingreso de números pequeños o cadenas cortas en este input, impidiendo que se detecten o guarden erróneamente como aretes.
  - Al ingresar un código no válido, el sistema emite sonido de error, feedback visual inmediato y reenfoca el campo para escanear de nuevo, orientando al usuario a usar el botón "Manual" si desea registrar aretes o nombres.
- **Corrección de Error 400 y Auto-saneamiento de Cola ([`syncUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/syncUtils.js), [`vaqueriaUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/vaqueriaUtils.js))**:
  - Se corrigió la restricción `identification_type` en Supabase: ahora se garantiza estrictamente que todo registro enviado a la tabla `vaqueria_animals` pertenezca al dominio válido (`'chip'`, `'arete'`, `'name'`, `'manual'`), eliminando el valor `'auto'` que provocaba el fallo HTTP 400 (Bad Request).
  - Se implementó la rutina de auto-reparación `healVaqueriaAnimalsSyncQueue` al procesar la cola de sincronización, reparando automáticamente registros locales previos que se encontraban atascados y permitiendo su subida exitosa a la nube.

---

## [1.7.8-vaqueria-pagination] - 2026-10-16

### Añadido y Optimizado (Paginación Ligera y Rendimiento para Grandes Rebaños)
- **Paginación Reactiva en Detalle de Vaquería ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - Se implementó paginación configurable (25, 50, 100 animales por página, por defecto 25) para las listas de Presentes, Faltantes y Nuevos por completar.
  - Diseñado específicamente para rebaños grandes (ej. 600+ cabezas), evitando la saturación del DOM y garantizando una navegación ágil y sin tirones en móviles y tablets.
  - La barra de paginación incluye botones de navegación rápida ("Anterior" / "Siguiente"), indicador de página actual y total de registros mostrados.
  - Al cambiar de pestaña, realizar una búsqueda o registrar un nuevo animal escaneado, la vista se reinicia automáticamente a la página 1 para mantener la visibilidad inmediata de los registros recién ingresados.

---

## [1.7.7-vaqueria-badge-simplification] - 2026-10-16

### Perfeccionado (Etiqueta de Animal Nuevo)
- **Simplificación de Distintivo a "Nuevo" ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx), [`vaqueriaUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/vaqueriaUtils.js))**:
  - Al escanear o registrar un animal nuevo en la vaquería, la etiqueta de identificación ahora dice concisamente `"Nuevo"` en lugar de `"Nuevo en Vaquería"`.

---

## [1.7.6-vaqueria-tabs-and-priority] - 2026-10-16

### Perfeccionado y Optimizado (Prioridad de Nuevos No Registrados y Pestañas Minimalistas)
- **Prioridad de Nuevos No Registrados en Lista de Presentes ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx), [`vaqueriaUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/vaqueriaUtils.js))**:
  - En la lista de presentes (y en búsquedas filtradas), los animales nuevos no registrados en el sistema (`UNREGISTERED_IN_SYSTEM`) siempre se posicionan de primero en la parte superior, garantizando su rápida visualización y completado de datos.
- **Pestañas Minimalistas y Responsive Móvil ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - Se removieron los iconos de las tres pestañas (Presentes, Faltantes, Nuevos) para una apariencia más limpia y enfocada.
  - La tipografía en móviles se ajustó a `text-[11px]` con espaciado y márgenes optimizados para que las pestañas se muestren en una sola línea sin desbordamientos.

---

## [1.7.5-vaqueria-loading-fix] - 2026-10-16

### Corregido (Eliminación de Parpadeo y Falso Aviso de "Vaquería no encontrada")
- **Diferenciación de Estado de Carga vs No Encontrado ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - Se corrigió la condición reactiva de `useLiveQuery` en IndexedDB: mientras la consulta asíncrona está en progreso (`undefined`), se presenta un spinner institucional `#1B4820` en lugar de evaluar erróneamente la pantalla de error.
  - La vista de "Vaquería no encontrada" ahora se despliega única y exclusivamente cuando la consulta culmina y confirma fehacientemente que el registro no existe en la base de datos (`null`), incluyendo un reintento de seguridad ante micro-retrasos de I/O.
- **Paso de Estado en Navegación Inmediata ([`Vaquerias.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Vaquerias.jsx), [`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - Al crear una nueva vaquería o abrir una tarjeta existente, se transfiere el objeto de la sesión en el `state` del enrutador.
  - La pantalla de detalle consume dicho estado de forma instantánea en el primer fotograma (`initialVaqueria`), suprimiendo por completo el parpadeo de 1 milisegundo y previniendo salidas en falso al navegar.

---

## [1.7.4-vaqueria-sync-and-ux] - 2026-10-16

### Perfeccionado y Optimizado (Fase 3 - Inclusión de Animales Nuevos en Segunda Vaquería, Notificaciones Flotantes y Filtros)
- **Inclusión de Animales Nuevos en Vaquerías Posteriores ([`vaqueriaUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/vaqueriaUtils.js))**:
  - Los animales activos creados o incorporados a la finca después de la vaquería anterior ahora forman parte del rebaño esperado de la vaquería actual, apareciendo listos para ser verificados/agregados sin figurar como faltantes en la primera sesión.
- **Notificaciones Flotantes Superpuestas Sin Salto de Layout ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - El banner de feedback visual de escaneo ahora se muestra como un toast flotante superpuesto (`fixed top-16 md:top-20 z-50 pointer-events-none`) con backdrop-blur y sombra profunda.
  - No empuja ni desplaza ningún componente de la vista al aparecer o desaparecer.
  - La duración en pantalla se redujo a 1.6 segundos para una experiencia ultrarrápida en campo.
- **Contador de Vaquerías Reubicado ([`Vaquerias.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Vaquerias.jsx))**:
  - El contador de vaquerías se trasladó debajo de los selectores de fincas y alineado a la izquierda en dispositivos móviles.
- **Protección y Distintivo de Inactivos ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx), [`vaqueriaUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/vaqueriaUtils.js), [`ManualAddModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/vaqueria/ManualAddModal.jsx))**:
  - En la lista de faltantes, los animales inactivos muestran la etiqueta `"INACTIVO"` al final de su fila.
  - Se bloquea totalmente el registro de animales inactivos en la asistencia (tanto por escaneo como manual), emitiendo sonido de advertencia.
  - Los animales inactivos ya no aparecen en las recomendaciones ni sugerencias del modal de agregar manual.
- **Estatus Antes del Nombre de la Finca ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - En la barra superior de información del detalle de vaquería, la insignia de estatus (*En progreso* / *Finalizada*) ahora se ubica antes del nombre de la finca.

---

## [1.7.3-vaqueria-ui-refinements] - 2026-10-16

### Mejorado y Depurado (Fase 3 - Simplificación de Filas, Chips en Móvil, Botón de Finalizar y Línea Base Temporal)
- **Simplificación Extrema de Filas y Chip Visible en Móvil ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - Se eliminaron las etiquetas redundantes de "Esperado", "Faltante Activo" e "Inactivo previo" de las filas de la lista, manteniendo una vista despejada y ligera.
  - Se suprimió la visualización de género (iconos de Marte/Venus y texto de sexo) en presentes y faltantes.
  - El microchip RFID ahora es 100% visible tanto en teléfonos móviles como en computadoras y tablets.
- **Iconografía Temática y Pestaña de Nuevos ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - Se sustituyó el icono genérico de destellos (`Sparkles`) por la planilla de registro ganadero (`ClipboardPlus`) para las acciones de completar y registrar animales.
  - La tercera pestaña se renombró de "Por Registrar" a "Nuevos".
- **Botón de Finalizar/Reabrir Full-Width y Remoción de Edición Interna ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - Se eliminó el botón de editar información de la vaquería dentro del pase de asistencia.
  - El botón de "Finalizar Vaquería" y "Reabrir Vaquería" ahora ocupa el 100% del ancho disponible en dispositivos móviles (`w-full sm:w-auto`).
- **Línea Base Histórica y Exclusión de Animales Posteriores ([`vaqueriaUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/vaqueriaUtils.js))**:
  - En la primera vaquería de una finca, se comparan solo los animales que ya existían o habían llegado a la finca en la fecha y momento en que se creó la vaquería.
  - Cualquier animal creado posteriormente no se marca como faltante de la primera vaquería al ingresar en sesiones posteriores.

---

## [1.7.2-vaqueria-fixes] - 2026-10-16

### Corregido y Perfeccionado (Fase 3 - Reglas de Inactivos, Eliminación de Texto de No Registrados y Asignación de Nombre)
- **Regla Estricta de Faltantes e Inactivos de Finca ([`vaqueriaUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/vaqueriaUtils.js))**:
  - En la línea base inicial (primera vaquería de una finca), se incluyen todos los animales de la propiedad (activos e inactivos).
  - Los animales inactivos figuran en la lista de faltantes únicamente con el distintivo "Inactivo previo", sin botón para inactivar.
  - Si un animal (activo o inactivo) falta a una vaquería, no formará parte de los registros de asistencia de dicha sesión, por lo que en la vaquería siguiente ya no aparecerá como esperado ni faltante ("si ya faltó antes, en la siguiente no aparece").
- **KPIs y Lista Sin Texto de No Registrado ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx), [`vaqueriaUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/vaqueriaUtils.js))**:
  - Se eliminó completamente el texto de "no registrado" y sub-conteo de las tarjetas de KPI superiores, conservando únicamente Nombre y Número exacto.
  - En las listas (Presentes y Por Registrar), los animales no registrados ahora se resaltan exclusivamente mediante un borde de color lateral (`border-l-4 border-rose-500`) y fondo tenue, suprimiendo las insignias y textos redundantes de "No registrado" / "Pendiente Registro".
- **Corrección en Registro de Animal Nuevo por Nombre ([`vaqueriaUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/vaqueriaUtils.js), [`CompleteAnimalModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/vaqueria/CompleteAnimalModal.jsx))**:
  - Al ingresar un animal nuevo en la vaquería mediante la pestaña de Nombre, el texto capturado se almacena correctamente en la propiedad `name` y el campo `number` permanece vacío.
  - Al pulsar "Completar", el modal asigna el nombre ingresado en el campo de Nombre del formulario y deja el campo de Arete despejado para su asignación formal.

---

## [1.7.1-vaqueria-refinements] - 2026-10-16

### Mejorado y Refinado (Fase 3 - Ajustes Visuales, Ergonómicos y de Campo en Vaquería)
- **KPIs Simplificados y 100% Responsivos ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - En móviles y tablets, las tarjetas de KPI ahora muestran únicamente Nombre y Número para un ajuste fluido y sin saturación.
  - Se eliminó el KPI de "Efectividad" para concentrar la atención en Presentes, Nuevos y Faltantes.
- **Header Minimalista y Reorganización de Vista ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - El encabezado superior ahora muestra exclusivamente el nombre de la vaquería y el botón/estado de sincronización.
  - La información complementaria (nombre de la finca, fecha, estado en progreso/finalizada, botón de edición y botón de finalizar/reabrir) se trasladó al primer bloque visible del cuerpo principal.
- **Vista en Lista Horizontal Compacta ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - Presentes, faltantes y animales no registrados se visualizan en formato de lista horizontal ultra-compacta para maximizar la densidad de información y soportar rebaños numerosos sin desplazamiento vertical excesivo.
  - Datos distribuidos horizontalmente: arete, nombre, microchip RFID, distintivos de condición, sexo y botones de acción agrupados al final de cada fila.
- **Sugerencias Filtradas por Finca y Límite de 5 ([`ManualAddModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/vaqueria/ManualAddModal.jsx))**:
  - En el modal de registro manual, las sugerencias en tiempo real (por arete, chip o nombre) están estrictamente limitadas a los animales de la finca activa (`farmId === currentVaqueria.farm_id`).
  - Límite máximo de 5 recomendaciones coincidentes para facilitar la selección de chips RFID con prefijos idénticos.
- **Botón Flotante Universal (FAB) ([`Vaquerias.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Vaquerias.jsx))**:
  - El botón "Nueva Vaquería" es ahora flotante (FAB) en todas las resoluciones (móvil, tablet y escritorio).
- **Consistencia en Animales Faltantes Inactivos ([`vaqueriaUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/vaqueriaUtils.js))**:
  - Los animales inactivos continúan reflejándose como faltantes si y solo si estuvieron presentes en la vaquería inmediatamente anterior.
  - Dejan de figurar una vez que se realiza una vaquería donde ya no formaron parte del pase de asistencia.
- **Remoción de Opción Redundante "Dejar como Faltó" ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - Se retiró el botón "Dejar como Faltó", dejando la lista limpia con la acción directa de "Inactivar" para los faltantes activos.
- **Foco Continuo de Escáner sin Teclado Virtual en Dispositivos Móviles ([`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - Implementado `inputMode="none"` en el input de escaneo para mantener el foco activo y recibir lecturas de bastones RFID físicos (HID / USB-OTG) sin desplegar el teclado en pantalla en teléfonos y tablets.
  - Integrado listener de `pointerdown` y `preventScroll: true` para mantener el foco en campo tras cualquier interacción general fuera de botones o modales.

---

## [1.7.0-phase3-vaqueria-attendance] - 2026-10-16

### Añadido y Lanzado (Fase 3 - Apartado 2: Módulo de Vaquería y Asistencia de Campo)
- **Nuevo Módulo de Vaquería ([`Vaquerias.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Vaquerias.jsx), [`VaqueriaDetalle.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/VaqueriaDetalle.jsx))**:
  - **Concepto y Propósito**: Sistema integral de pase de asistencia periódica para verificar la presencia física de los animales en cada finca de manera independiente, 100% funcional con o sin conexión a internet (Offline-First).
  - **Comparación Inteligente de Rebaño**:
    - Si no existe una vaquería previa para la finca, se compara automáticamente contra los animales activos de dicha propiedad en el inventario.
    - Si ya existen sesiones de vaquería previas, la sesión actual se compara contra la vaquería inmediatamente anterior de esa misma finca.
  - **Clasificación Automática de Animales Presentes**:
    - **Esperados**: Animales que estaban en la línea base y confirmaron asistencia.
    - **Nuevos en Vaquería**: Animales ya existentes en el inventario pero que no estuvieron en la vaquería anterior.
    - **No Registrados en Sistema (Crítico / Resaltado Principal)**: Animales cuyo arete o microchip RFID no existe en la base de datos, resaltados con distintivo especial y permitiendo completar sus datos al finalizar para ingresarlos directamente al inventario.
  - **Gestión de Animales Faltantes**:
    - **Faltantes Ya Inactivos**: Animales de la vaquería anterior que fueron desactivados previamente (por muerte, venta, etc.), informados pero sin alarma activa.
    - **Faltantes Activos**: Animales que debían presentarse y no aparecieron, con opción directa para inactivarlos con su motivo ('Muerte', 'Venta', 'Descarte', 'Pérdida/Extravío', 'Otro') o dejarlos como ausencia simple conservando su estado activo.
  - **Experiencia de Captura Ultrarrápida y Ergonómica en Campo**:
    - **Foco Continuo para RFID**: Entrada de escaneo siempre enfocada para disparar ráfagas con bastón lector físico sin requerir toques en pantalla.
    - **Buffer Anti-Jitter y Detección ISO de 15 Dígitos**: Soporte para lectores Bluetooth HID y USB-OTG emulando teclado con tolerancia de 300 ms y despachado instantáneo al acumular 15 cifras.
    - **Entrada Manual Multifacética ([`ManualAddModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/vaqueria/ManualAddModal.jsx))**: Selección segmentada por Arete, Chip RFID o Nombre con autocompletado en tiempo real y validación estricta de no repetición y 15 dígitos.
    - **Lector de Código de Barras por Cámara ([`BarcodeScannerModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/BarcodeScannerModal.jsx))**: Integración del escáner óptico multi-fotograma.
    - **Retroalimentación Instantánea (Audio + Visual)**:
      - Sonido agradable ascendente (Web Audio API) y check visual animado en registros exitosos.
      - Doble tono de advertencia y señal de alerta en lecturas duplicadas.
      - Tono grave ante formatos erróneos.
      - Cero popups bloqueantes que interrumpan la velocidad del operario en la manga.
  - **Modelos de Datos y Sincronización Local / Nube**:
    - Dexie versión 8 ([`db.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/db.js)): Nuevas tablas `vaquerias` y `vaqueria_animals`.
    - Script de migración en Supabase ([`supabase_schema_vaqueria.sql`](file:///C:/Users/joses/appganadera/gestion-ganadera/supabase_schema_vaqueria.sql)) con llaves foráneas, triggers de `updated_at` y políticas RLS.
    - Sincronización bidireccional ([`syncUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/syncUtils.js)) con subida por cola `sync_queue` y descarga reactiva `pullFromServer`.
  - **Navegación e Integración UI**:
    - Acceso directo a Vaquería en la barra lateral ([`NavigationDrawer.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/NavigationDrawer.jsx)) con icono `ClipboardCheck`.
    - Rutas protegidas `/vaquerias` y `/vaquerias/:id` en [`App.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/App.jsx).

---

## [1.6.1-dashboard-refinements] - 2026-10-12

### Perfeccionado y Depurado (Fase 3 - Dashboard y Remoción de Alerta de 8 Meses)
- **Refinamientos del Dashboard ([`Dashboard.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Dashboard.jsx))**:
  - **Tabla de Auditoría e Historial de Modificaciones (Últimos 10 Animales)**: Se sustituyó la cuadrícula de tarjetas de actividad reciente por una tabla moderna y responsive que lista los últimos 10 animales registrados o editados, reflejando Número con Nombre debajo (sin iconos de género), Microchip RFID, Quién hizo el cambio (Usuario responsable con badge de rol: Admin, Obrero, Operador), Fecha/Hora de modificación y acceso directo con fila clickeable a la ficha técnica del animal.
  - **Skeleton Loader Offline/Online ([`DashboardSkeleton.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/dashboard/DashboardSkeleton.jsx))**: Creado componente de skeleton con animación `animate-pulse` que replica la geometría exacta del Dashboard (fincas, subfiltros, KPIs, pirámide de edad, fincas/potreros, dueños/razas y tabla de 10 registros de auditoría) mientras se leen los datos desde IndexedDB (`useLiveQuery`), funcionando fluidamente con y sin conexión a internet.
  - **Header Minimalista**: Removido el botón "Ver Inventario", el icono ilustrativo junto a "Dashboard" y el subtítulo inferior ("Resumen General del Rebaño") para un diseño más limpio y directo.
  - **Control e Identificación con Animales Sin Chip**: Incorporado el conteo de animales no identificados ("Sin Chip") en la tarjeta de KPI de Control & Identificación, junto a los animales con chip RFID y con observaciones registradas.
  - **Selección Libre de Potreros**: Corregido el reseteo anticipado de potreros al no tener finca seleccionada (`Todas las Fincas`), permitiendo ahora seleccionar libremente cualquier potrero individual (mostrando el nombre del potrero y su finca entre paréntesis) sin forzar la elección previa de una finca.
  - **Selectores Estéticos y Consistentes**: Sustituidos los selects nativos por el componente [`CustomSelect.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/ui/CustomSelect.jsx) para los filtros de Potrero, Dueño y Estatus, manteniendo coherencia visual con los modales y formularios de la aplicación.
  - **Distribución por Sexo Directa**: Rediseñada la tarjeta de sexo para mostrar 2 números limpios e independientes (Hembras y Machos) con sus iconos respectivos, suprimiendo la barra bicolor.
  - **Remoción de KPI de Peso**: Eliminada la tarjeta de "Peso Promedio & Biomasa" de la cuadrícula superior de KPIs.
  - **Resumen por Fincas sin Peso**: Retirado el promedio de peso (`Prom: ... kg`) de la lista de fincas para mantener el resumen centrado en cabezas, potreros y desglose de hembras/machos.
  - **Tarjetas Informativas No Clickeables**: Retirada la interactividad y cursores clickeables en los módulos de "Rebaño por Dueño" y "Ocupación de Potreros", consolidándolos como paneles puramente informativos.
- **Eliminación Total de la Alerta de 8 Meses del Sistema ([`Dashboard.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Dashboard.jsx), [`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx))**:
  - En Dashboard: Removida la métrica de alerta de destete de 8 meses del KPI de control y de los cálculos estadísticos.
  - En Inventario: Suprimido el helper de detección `is8MonthsOld`, el estado persistente `viewedHighlights`, la alteración de prioridad de ordenamiento en `filteredAnimals`, la banda amarilla superior en vista de tarjetas y las insignias `8M` en la vista lista (tanto en escritorio como en móvil).
- **Integridad Absoluta de Datos**:
  - Supabase e IndexedDB 100% preservados sin alteración ni pérdida de información.

---

## [1.6.0-phase3-dashboard-v1] - 2026-10-12

### Añadido y Lanzado (Fase 3 - Apartado 1: Dashboard General Ganadero)
- **Nueva Página de Dashboard General ([`Dashboard.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Dashboard.jsx))**:
  - **Vista General Ejecutiva**: Presentación consolidada de todos los datos esenciales del rebaño mediante consultas reactivas 100% offline-first con IndexedDB (`Dexie.js`).
  - **Selector Prominente de Fincas**: Selector tipo carrusel horizontal interactivo que permite conmutar entre "Todas las Fincas", fincas individuales y animales "Sin Finca".
  - **Subfiltros Dinámicos**: Filtro de potrero contextual a la finca seleccionada, filtro por dueño/propietario y filtro por estatus (Todos / Activos / Inactivos) con botón para restablecer filtros secundarios.
  - **Tarjetas de KPIs Principales**:
    - **Población Total**: Conteo general de animales con desglose de activos e inactivos.
    - **Distribución de Sexo**: Cantidad y porcentaje de Hembras vs Machos, con barra visual bicolor y ratio de cría.
    - **Peso y Biomasa**: Peso promedio del lote, biomasa total en toneladas métricas y porcentaje de cobertura de pesaje.
    - **Control y Alertas**: Conteo y porcentaje de animales identificados con chip RFID, animales con observaciones registradas y alerta de 8 meses (edad de destete).
  - **Estructura Etaria del Rebaño**: Pirámide biológica por categorías ganaderas (Becerros, Mautes Macho, Mautes Hembra, Novillas, Adultos y Desconocida) con barras de progreso visuales y porcentajes relativos.
  - **Resumen por Fincas y Ocupación de Potreros**: Desglose de carga animal por propiedad y distribución porcentual por potreros.
  - **Tenencia y Genética**: Métricas del rebaño agrupadas por propietario y composición racial del ganado.
  - **Actividad Reciente**: Accesos directos a las fichas técnicas de los últimos animales registrados o actualizados.
- **Integración de Navegación y Rutas ([`App.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/App.jsx), [`Login.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Login.jsx), [`NavigationDrawer.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/NavigationDrawer.jsx))**:
  - **Primera Opción en la Barra Lateral**: Dashboard posicionado en el tope de la navegación con icono `LayoutDashboard`.
  - **Apartado de Entrada Inicial**: Configurada la ruta `/dashboard` como destino predeterminado al ingresar al sistema, abrir la aplicación con sesión iniciada o redirigir desde la raíz `/`.
- **Integridad Absoluta de Datos**:
  - Supabase e IndexedDB 100% preservados sin alteración ni pérdida de datos.

---

## [1.5.3-filter-observations] - 2026-10-11

### Añadido y Perfeccionado (Filtros de Inventario: Observaciones)
- **Filtro de Animales por Observaciones ([`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx))**:
  - Incorporada nueva sección de filtro **"Observaciones"** en el panel lateral/bottom sheet de filtros de inventario.
  - Ofrece opciones con contadores en tiempo real:
    - **Con observaciones**: Filtra y visualiza exclusivamente los animales que tienen notas u observaciones registradas.
    - **Sin observaciones**: Muestra los animales sin observaciones pendientes.
  - Integrado al contador dinámico de filtros activos (`activeFiltersCount`), a la barra de píldoras de filtros activos (`pills` con botón de eliminación rápida `×`) y al botón de restablecer/borrar filtros (`clearFilters`).
- **Icono Visual de Observaciones Unificado en Vista Lista ([`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx))**:
  - Se replicó el distintivo visual `FileText` ámbar junto al identificador del animal tanto en la vista de escritorio como en la vista móvil de tipo lista, garantizando coherencia visual inmediata con la vista tarjetas.
- **Integridad Absoluta de Datos**:
  - Todos los datos en Supabase e IndexedDB se mantienen 100% íntegros y preservados sin alteraciones.

---

## [1.5.2-anti-truncated-scan-protection] - 2026-10-11

### Protegido y Blindado (Escaneo por Cámara y Escáner Físico / RFID)
- **Protección Anti-Lectura Truncada en Escáner de Cámara ([`BarcodeScannerModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/BarcodeScannerModal.jsx))**:
  - **Confirmación Multi-Fotograma**: Sustituido el despacho inmediato al primer fotograma por un sistema de compuerta y estabilidad óptica que exige concordancia y estabilidad antes de enviar el valor.
  - **Detección Dinámica de Prefijos y Auto-Reemplazo**: Si la cámara empieza capturando una parte del código de barras al enfocar rápidamente y en el siguiente fotograma captura la cadena completa que contiene dicho prefijo (ej. de 6 dígitos a los 15 dígitos completos), el sistema promociona automáticamente la lectura más larga y completa.
  - **Descarte de Fragmentos y Ruido Óptico**: Se rechazan lecturas espurias de menos de 4 caracteres y lecturas truncadas que sean subcadenas cortas de un código ya detectado.
  - **Reconocimiento Prioritario de Microchips ISO**: Algoritmo optimizado para microchips ganaderos estándar de 15 dígitos numéricos (`/^\d{15}$/`), garantizando lectura íntegra y sin cortes.
- **Blindaje de Buffer para Escáner Físico / Bluetooth HID ([`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx), [`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx))**:
  - **Tolerancia a Jitter Bluetooth Ampliada**: Se incrementó la tolerancia entre caracteres de 200 ms a 300 ms para absorber pausas entre paquetes HID en lectores inalámbricos sin reiniciar prematuramente el buffer.
  - **Temporizador de Silencio Prolongado**: El tiempo de espera para escáneres que no envían la tecla `Enter` se amplió de 120 ms a 280 ms, impidiendo que el buffer se vacíe a mitad de una ráfaga.
  - **Detección Directa de Ráfaga ISO de 15 Dígitos**: Al acumularse los 15 dígitos continuos de un microchip, se despacha tras una micro-ventana de 50 ms.
  - **Filtro Mínimo de Caracteres**: Bloquea el procesamiento de fragmentos o pulsaciones accidentales incompletas.
- **Integridad Absoluta de Datos**:
  - Datos de Supabase y esquemas locales de Dexie preservados al 100% intactos.

---

## [1.5.1-inventory-dual-view-cards-list] - 2026-10-11

### Añadido y Perfeccionado (Vistas de Inventario: Tarjetas y Lista)
- **Doble Modalidad de Vista en Catálogo de Inventario ([`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx))**:
  - Incorporada nueva **Vista Tipo Lista** sin imágenes, orientada a una navegación ultrarrápida, cómoda y enfocada en métricas esenciales.
  - Añadido selector segmentado / conmutador con iconos `LayoutGrid` (Tarjetas) y `List` (Lista), acompañado del contador total y filtrado de animales.
  - Persistencia permanente de la preferencia del usuario en `localStorage` (`ganadera_inventory_view_mode`), conservándose al recargar o cerrar la aplicación.
- **Refinamiento de Datos en Vista Lista ([`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx))**:
  - **Identificadores Destacados**: Número de arete ampliado a `text-lg sm:text-xl font-black` y número de microchip a `text-xs sm:text-sm font-bold`.
  - **Depuración de Métricas**: Retiradas la Raza y el Peso de la vista tipo lista, focalizando la atención en los datos críticos de control ganadero.
  - **Badges Minimalistas en Móvil**: En pantallas móviles, el Género y el Estatus se muestran exclusivamente con icono y color en formato circular (`w-6 h-6 rounded-full`), ahorrando espacio horizontal y evitando saltos de línea.
  - **Reubicación de Campo y Dueño**: Finca/Potrero y Dueño se posicionan directamente en la cuadrícula de datos clave en el lugar que ocupaban raza y peso, unificando el elemento en 2 niveles limpios y ultracompactos.
- **Visualización Tabular en Pantallas de Escritorio ([`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx))**:
  - En monitores de escritorio (`lg:`), la lista se alinea con una cabecera de 8 columnas optimizada: Arete / Nombre, Microchip, Sexo, Estado, Edad, Campo y Dueño.
- **Estado de Carga Adaptativo ([`AnimalCardSkeleton.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalCardSkeleton.jsx))**:
  - Esqueleto de lista alineado a la estructura de 2 niveles compactos.
- **Indicador de Observaciones en Vista Tarjetas ([`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx))**:
  - Incorporado un icono visual (`FileText` en tono ámbar) ubicado inmediatamente al lado de la píldora de peso en las tarjetas de inventario cuando el animal cuenta con observaciones o notas registradas, con tooltip accesible para consultar la observación al posar el cursor.
- **Integridad Absoluta de Datos**:
  - La base de datos en Supabase y el almacenamiento IndexedDB local se mantienen 100% intactos y protegidos sin alteraciones.

---

## [1.5.0-phase3-dashboard-events-obreros-planning] - 2026-10-07

### Culminado (Cierre de la Parte 2 de 3: Compatibilidad RFID en Software)
- **Cierre Formal de Software para Escáner RFID**:
  - Toda la adaptación de software queda 100% completada y probada (buffer anti-jitter de 200 ms, modo ráfaga, prevención de submits involuntarios por Enter, auto-selección al enfocar, sanitización de pegado, botones de borrado rápido en arete y chip, y búsqueda reactiva instantánea).
  - Pruebas físicas de campo en manga y calibración de hardware en pausa natural a la espera de recepción del dispositivo e informe del cliente.

### Planificado e Iniciado (Parte 3 de 3)
- **Apertura de la Parte 3 de 3 en Planificación ([`planificacion.md`](file:///C:/Users/joses/appganadera/gestion-ganadera/planificacion.md))**:
  - Dashboard
  - Apartado de Eventos en Inventario
  - Módulo de Obreros
  - Despliegue en Producción

---

## [1.4.1-rfid-scanner-resilience] - 2026-10-07

### Corregido y Perfeccionado (Parte 2: Compatibilidad RFID y Entradas de Identificación)
- **Buffer de Escáner Resiliente contra Jitter y Retardos ([`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx), [`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx))**:
  - Resuelto el truncamiento intermitente de códigos escaneados con lectores RFID físicos (Bluetooth HID / cuña de teclado).
  - Umbral de tiempo inter-caracter ampliado a 200 ms para acumulación en buffer, evitando que una latencia momentánea o jitter de Bluetooth borre el inicio del código (como los 15 dígitos estándar ISO).
  - Supresión de re-renders continuos durante la ráfaga de escaneo (`isScanning`), impidiendo que el motor de filtrado del inventario sature el hilo principal de JavaScript y provoque pérdida de pulsaciones de teclado.
  - Temporizador de respaldo de 120 ms para inyectar automáticamente el código escaneado en dispositivos que no envíen el carácter `Enter` al final.
- **Soporte Completo de Escáner y Pegado en Arete y Chip ([`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx))**:
  - Incorporada la lógica de buffer de escáner físico y sanitización de pegado tanto en el campo **1. Arete o Lomo** (`number`) como en **2. Chip** (`chip_number`).
  - Auto-selección completa del contenido al enfocar el campo (`onFocus -> e.target.select()`) para permitir sobrescribir o limpiar el valor instantáneamente con un solo toque o escaneo.
  - Añadidos botones dedicados de borrado rápido (`X`) en los campos de arete y chip cuando contienen texto, facilitando vaciar el valor sin borrar carácter por carácter.

---

## [1.4.0-phase2-rfid-planning] - 2026-10-07

### Planificado e Iniciado (Parte 2 de 3: Conexión con Escáner RFID Físico)
- **Apertura de la Parte 2 de 3 en Planificación ([`planificacion.md`](file:///C:/Users/joses/appganadera/gestion-ganadera/planificacion.md))**:
  - Aprobación formal de la Parte 1 por parte del cliente registrada.
  - Planificación técnica de la compatibilidad del teléfono inteligente con el escáner RFID (Bluetooth HID/BLE, USB-OTG/Serial y PWA en smartphones).
  - Planificación de la adaptación del software (listener global de lectura, detección en mangas, prevención de chips duplicados y búsqueda instantánea en inventario).
  - En espera de recepción del informe técnico con modelo y especificaciones del escáner.

### Añadido y Perfeccionado (Cierre de la Parte 1)
- **Identificación Esencial Alternativa de Animales ([`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx))**:
  - Obligatoriedad flexible: el animal debe contar con al menos número de arete/lomo o número de chip (o ambos a la vez).
  - Soporte de visualización y búsqueda para ejemplares registrados exclusivamente con chip electrónico o nombre en tarjetas, detalles y genealogía.
- **Número de Chip Único e Irrepetible ([`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx))**:
  - Detección en tiempo real de duplicidad de chip con advertencia visual inmediata y bloqueo del botón de guardado.
  - Bloqueo en escáner óptico: si un código escaneado ya pertenece a otro animal, no se inserta en el input y emite una alerta descriptiva.
  - Prevención de falsos positivos al registrar: exclusión de chequeo contra el propio animal recién guardado durante la transacción local.
- **Reorganización Estructural del Formulario**:
  - Sección **Raza** reubicada inmediatamente por debajo de **Ubicación y Propiedad** (Dueño, Finca y Potrero).
- **Nuevo Filtro por Categorías de Edad Ganadera ([`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx))**:
  - Becerros (0 a 12 meses), Maute macho (+12 a 36 meses), Maute Hembra (+12 a 24 meses), Novillas (+24 a 36 meses), Adulto Toro/Vaca (+36 meses) y Edad Desconocida, con contadores en tiempo real y tags removibles.

---

## [1.3.2-sync-status-offline-adjustment] - 2026-10-06

### Ajustado y Optimizado
- **Comportamiento del Botón de Sincronización en Modo Offline ([`SyncStatus.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/ui/SyncStatus.jsx))**:
  - Desactivada la animación de pulso/titilado (`scale`) y el resplandor/anillo amarillo de pendientes cuando el dispositivo no tiene conexión a internet (`!isOnline`).
  - El estado pendiente amarillo e interactivo ahora se activa exclusivamente cuando se detecta conexión activa (`isOnline`), manteniendo una visualización limpia y neutra en campo durante el trabajo offline.

---

## [1.3.1-ui-and-scanner-enhancements] - 2026-10-04

### Mejorado y Corregido (Perfeccionamiento Previo a QA)
- **Estabilización Total del Escáner de Código de Barras ([`BarcodeScannerModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/BarcodeScannerModal.jsx))**:
  - Resuelto el ciclo de reinicio infinito de cámara aislando dependencias y protegiendo callbacks con `useRef`.
  - Priorizada la cámara trasera física (`environment`) por defecto en teléfonos móviles y tablets.
  - Alternancia inteligente entre cámaras (trasera ↔ delantera) y soporte continuo de linterna/flash.
  - Eliminados decodificadores de códigos QR y matrices 2D, optimizando la lectura exclusivamente para códigos lineales 1D (Code 128, Code 39, EAN-13, UPC, ITF) con inicio instantáneo.
  - Diseñados los botones de escaneo como botones táctiles dedicados en vistas móvil y tablet en formularios y barra de búsqueda.
- **Ajustes Estéticos en Inventario y Formularios**:
  - **Cards de Inventario ([`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx))**: Número de arete en verde destacado, número de microchip en negrita, datos limpios (código, chip, raza, dueño, edad, peso, tags de género y estatus).
  - **Formulario de Registro y Edición ([`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx))**: Ancho del formulario optimizado en pantallas de escritorio, y registro de evento de nacimiento limpio (solo fecha de nacimiento sin descripciones o pesos automáticos).
  - **Ficha de Perfil ([`PerfilAnimal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/PerfilAnimal.jsx))**: Visualización rápida depurada debajo de la foto del ejemplar (número, chip, raza, peso y edad).
  - **Notificación Móvil**: Toast de guardado en modal de edición renderizado en una sola línea en pantallas pequeñas.

---

## [1.3.0-phase3-phase4-supabase-integration] - 2026-10-04

### Añadido y Desplegado (Fases 3 y 4)
- **Nueva Instancia de Supabase Cloud (`mdyycsydocenrauzvalu`)**:
  - Aprovisionada y desplegada la nueva base de datos en PostgreSQL con soporte nativo para potreros obligatorios por finca, dueños de ganado, número de microchip RFID, nombres de animales y trazabilidad de eventos.
  - Diseñada la arquitectura relacional preparada para el futuro rol de **Obrero** (`role: 'obrero'`, `admin_id` jerárquico y `created_by_user_id` para auditoría de acciones sin alterar la UI actual).
  - Activadas políticas de Row Level Security (RLS) en todas las tablas con permisos integrales para el cliente PWA offline-first.
  - Sembrado el usuario administrador inicial (`admin@campo.com`).
- **Almacenamiento Multimedia (Storage `ganadera_images`)**:
  - Bucket público `ganadera_images` verificado y configurado con límite de 10 MB, tipos MIME permitidos y políticas de subida, consulta y sobreescritura de imágenes de animales y pesajes.
- **Conexión Frontend y Sincronización Adaptada**:
  - Actualizadas las credenciales en `.env.local` con la nueva Project URL y Anon Key.
  - Modificado el motor de sincronización ([`syncUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/syncUtils.js)) para realizar PULL, PUSH y reconciliación de las nuevas tablas (`potreros`, `owners`) y purga de tablas heredadas.
  - Ejecutadas pruebas de integración E2E automatizadas verificando con éxito al 100%: login, inserción de fincas, potreros, dueños, animales con chip, consultas relacionales con joins, subida de fotos a Storage y borrado limpio.

---

## [1.2.6-phase2-refinements] - 2026-10-03

### Corregido y Perfeccionado
- **Limpieza Visual del Escáner de Código de Barras ([`BarcodeScannerModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/BarcodeScannerModal.jsx))**:
  - Retirado el marco verde superpuesto y la animación láser para mantener exclusivamente el visor nativo con esquinas blancas de la librería `html5-qrcode`.
  - Reubicado el texto de instrucción ("Apunta la barra al centro del recuadro") en la parte inferior del recuadro del visor con fondo oscuro translúcido para no obstaculizar la visión del código.
- **Reorganización de Campos en Registro y Edición ([`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx))**:
  - Reubicada la sección **8. Raza** inmediatamente después de las **Características Biológicas** (género, nacimiento, peso y color), unificando los atributos biológicos del animal.
  - Renumeradas coherentemente las secciones subsiguientes: **9. Dueño**, **10. Finca**, **11. Potrero**, **12. Madre y Padre**, **13. Estado**, **14. Foto y Descripción**.
- **Escáner de Código de Barras en Barra de Búsqueda ([`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx))**:
  - Integrado botón de escáner óptico directamente en la barra de búsqueda (tanto en vista móvil como en escritorio).
  - Al escanear el código de barras o chip, el valor detectado se coloca instantáneamente en el buscador, filtrando los animales en tiempo real y desplegando un toast de confirmación.

---

## [1.2.5-phase2-barcode-scanner] - 2026-10-03

### Añadido y Perfeccionado (Cierre de Fase 2)
- **Escáner Óptico de Código de Barras para Microchips RFID ([`BarcodeScannerModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/BarcodeScannerModal.jsx) y [`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx))**:
  - Implementado sistema de escaneo de código de barras en tiempo real mediante cámara del dispositivo, optimizado para etiquetas físicas y jeringas de microchips ganaderos (Code 128, Code 39, EAN, UPC, ITF, DataMatrix, QR).
  - Integrado botón de acceso rápido "Escanear" en la cabecera del campo "2. Número de Chip" y botón con icono dentro del mismo input.
  - Al detectar el código de barras, se emite un pitido nítido de confirmación sonora (Web Audio API) y vibración háptica en dispositivos móviles, asignando el número automáticamente en el campo de chip y cerrando el escáner.
  - Incluye visor rectangular apaisado con animación láser, soporte para linterna/flash en mangas o corrales oscuros, cambio entre cámaras (trasera/frontal) y manejo amigable de permisos.

---

## [1.2.4-phase2-modals-and-autofill-fix] - 2026-10-03

### Corregido y Perfeccionado
- **Limpieza de Modal de Fincas ([`FarmModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/FarmModal.jsx))**:
  - Retirada la sección expandible de ver y crear potreros de las tarjetas de fincas.
  - El modal de fincas ahora está exclusivamente dedicado a la administración de fincas (nombre, ubicación y descripción general).
- **Selector Estilizado de Finca en Modal de Potrero ([`PotreroModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/PotreroModal.jsx))**:
  - Sustituido el `<select>` HTML nativo genérico por el componente [`CustomSelect.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/ui/CustomSelect.jsx), garantizando coherencia visual, soporte de búsqueda y dropdown flotante.
- **Corrección de Difuminado de Botones en Modales Recursivos ([`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx), [`BottomSheet.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/ui/BottomSheet.jsx), [`NuevoAnimal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/NuevoAnimal.jsx) y [`PerfilAnimal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/PerfilAnimal.jsx))**:
  - Se redujo el Z-Index de la barra de botones fija del formulario a `z-30`.
  - Se elevó el Z-Index base y el fondo/backdrop de [`BottomSheet.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/ui/BottomSheet.jsx) a `z-70+` (backdrop en `z-69+`), y se montó en portal directamente al `document.body` mediante `createPortal`.
  - Al abrirse el modal para registrar padre o madre, el telón oscuro difumina completamente toda la pantalla subyacente, incluyendo los botones fijos de acción que antes quedaban indebidamente resaltados.
- **Apertura de Modal Completo para Dueños ([`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx), [`OwnerModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/OwnerModal.jsx))**:
  - En los formularios de registro y edición de animal, el botón "Nuevo" en la sección de Dueño ahora abre el modal completo [`OwnerModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/OwnerModal.jsx), homologándolo exactamente al comportamiento de Finca y Potrero.
  - Al registrar un nuevo dueño desde el modal, este se autoselecciona de inmediato en el formulario y el modal se cierra fluidamente.
  - Removidos los inputs inline temporales y estados locales redundantes para una experiencia de usuario limpia y unificada.
- **Prevención Definitiva de Autocompletado de Pago/Tarjetas ([`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx))**:
  - Los campos de número de arete, número de chip y nombre de animal eran falsamente clasificados por las heurísticas de Chromium/Google Chrome como números y titulares de tarjetas bancarias.
  - Se integraron con `Controller` de React Hook Form dotando a los inputs en el DOM de atributos anti-autofill (`autoComplete="one-time-code"`, `data-form-type="other"`, `data-lpignore="true"`, `data-1p-ignore="true"`, `data-bwignore="true"` y nombres semánticos de identificación animal), neutralizando por completo el cuadro de diálogo de sugerencia de pagos.

---

## [1.2.3-phase2-potreros-and-ux] - 2026-10-03

### Añadido y Mejorado
- **Modal Independiente para Potreros ([`PotreroModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/PotreroModal.jsx))**:
  - Implementado modal dedicado para la administración de potreros idéntico a los de Fincas y Dueños.
  - Al registrar o editar un potrero, se exige obligatoriamente tanto el **Nombre del Potrero** como la **Finca Asociada**.
  - Integrado acceso directo a "Potreros" con su contador y opción en la barra lateral ([`NavigationDrawer.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/NavigationDrawer.jsx)), en [`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx) y en [`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx).
- **Ampliación de Modales de Progenitores en Laptop ([`NuevoAnimal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/NuevoAnimal.jsx) y [`PerfilAnimal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/PerfilAnimal.jsx))**:
  - Configurado `maxWidth="max-w-4xl lg:max-w-5xl"` en los modales recursivos de creación de Padre y Madre, ofreciendo el mismo espacio visual cómodo y organizado que el modal principal de edición.
- **Desactivación de Autocompletado en Formulario Animal ([`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx))**:
  - Se desactivó el autocompletado del navegador (`autoComplete="off"`) en los tres primeros campos: **Número de arete**, **Número de chip** y **Nombre**.
- **Sustitución de Emoji por Icono SVG en Filtros ([`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx))**:
  - Se reemplazó el emoji `ℹ️` por el icono SVG `Info` de Lucide en el mensaje orientativo del filtro por potrero.

---

## [1.2.2-phase2-ux-polish] - 2026-10-02

### Mejorado y Corregido
- **Botón Flotante (FAB) de Edición en Vista Móvil ([`DetailsTab.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/DetailsTab.jsx))**:
  - Implementado botón flotante animado de edición fijado a la parte inferior derecha (`fixed bottom-20 right-4 z-30 md:hidden`), alineado exactamente al estilo de los botones de acción de `EvolutionTab` y `HealthTab`.
- **Modal de Edición Más Ancho en Laptop ([`BottomSheet.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/ui/BottomSheet.jsx), [`PerfilAnimal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/PerfilAnimal.jsx) y [`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx))**:
  - Configurado ancho expandido `max-w-4xl lg:max-w-5xl` en el modal de edición de perfil en laptop.
  - Formulario adaptado a `max-w-4xl` con distribución en 3 columnas para datos básicos (Arete, Chip, Nombre) y ubicación (Dueño, Finca, Potrero), proporcionando una visualización despejada y espaciosa.
- **Llamado de Atención Visual en Sincronización ([`SyncStatus.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/ui/SyncStatus.jsx))**:
  - Animación continua de crecimiento y reducción (`scale: [1, 1.09, 1]`) en el botón del encabezado cuando el estado es pendiente (`pendingItemsCount > 0`), con resaltado en tono ámbar para indicar cambios pendientes por respaldar.
- **Eliminación de Registro de Raza Nueva ([`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx))**:
  - Retirado el campo de ingreso manual de raza libre, dejando exclusivamente la selección desde la lista predeterminada con "Sin raza".
- **Alineación de Pills de Género y Estado en Cards ([`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx))**:
  - Se alinearon perfectamente las pills de género y estado en una fila flex compartida sobre la foto (`flex items-center justify-between`), estandarizando sus alturas, iconos (`FaVenus`/`FaMars` y `CheckCircle2`/`XCircle`) y alineación vertical.
- **Filtro Contextual por Potrero y Filtro por Dueño ([`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx))**:
  - En el panel lateral de filtros se incorporó la selección de potreros activada al escoger una finca, mostrando el listado con conteo de animales por potrero.
  - Se añadió el filtro por Dueño/Propietario con opciones para todos los dueños, cada dueño particular y animales sin dueño asignado.
- **Búsqueda por Número de Chip ([`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx))**:
  - La barra de búsqueda filtra de forma robusta por número de chip electrónico (limpiando espacios y guiones), complementando la búsqueda por arete, nombre o dueño con botón de borrado rápido.
- **Banner Interactivo de Filtros Activos ([`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx))**:
  - Se despliegan chips individuales interactivos para remover selectivamente filtros de finca, potrero, dueño, sexo, raza o categoría.
- **Scroll Unificado en Panel de Filtros ([`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx))**:
  - Se removieron los scrolls internos (`max-h-* overflow-y-auto`) de las listas de Fincas, Potreros, Dueños y Razas, permitiendo un desplazamiento vertical natural y unificado a través de un único scroll normal para todo el panel.
- **Botones de Cancelar y Guardar Equitativos y Fijados al Fondo del Modal ([`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx), [`BottomSheet.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/ui/BottomSheet.jsx) y [`PerfilAnimal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/PerfilAnimal.jsx))**:
  - Tanto en Registrar como en Editar, los botones de "Cancelar" y "Guardar / Registrar" ahora tienen exactamente el mismo tamaño (50% de ancho con `flex-1` cada uno).
  - En el modal de edición, los botones permanecen siempre visibles fijados directamente al borde inferior del modal (`sticky bottom-0 -mx-6 px-6 py-3.5`) y sin margen inferior sobrante, apoyados por la propiedad `noPaddingBottom` en `BottomSheet`.
- **Botón de Acción en Estado Vacío de Modales ([`OwnerModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/OwnerModal.jsx) y [`FarmModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/FarmModal.jsx))**:
  - Al abrir el modal de gestión de dueños sin registros previos, la opción para registrar el primer/nuevo dueño ahora es un botón destacado (`bg-[#1B4820]` con icono `+`), reemplazando el enlace de texto plano subrayado. Se aplicó la misma mejora en el modal de fincas para mantener consistencia.
- **Protección de Datos: Eliminación Restringida ([`OwnerModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/OwnerModal.jsx) y [`FarmModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/FarmModal.jsx))**:
  - Se eliminaron las opciones y botones de borrado para Dueños, Potreros y Fincas; únicamente pueden crearse y editarse para salvaguardar la integridad de las relaciones históricas.
- **Nuevo Icono en Barra Lateral ([`NavigationDrawer.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/NavigationDrawer.jsx))**:
  - En la cabecera del drawer ("Ganadera - Gestión & Control") se sustituyó el icono de escudo (`ShieldCheck`) por la silueta de una vaca (`GiCow`).

---

## [1.2.1-phase2-corrections] - 2026-10-02

### Corregido y Mejorado
- **Reflejo Automático de Fecha de Nacimiento en Eventos ([`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx))**:
  - Al registrar o actualizar la fecha de nacimiento de un animal, se genera o actualiza automáticamente el evento de tipo `Nacimiento` en `growth_events` con su peso correspondiente y encolado en `sync_queue`, mostrándose de inmediato en la pestaña de Evolución/Eventos.
- **Botones de Guardar y Cancelar Fijados al Fondo de Pantalla ([`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx))**:
  - Se configuró la barra de acciones como `fixed bottom-0 inset-x-0 z-50` con fondo translúcido y bordes delimitados para que permanezca visible y accesible en todo momento durante el scroll, complementado con padding inferior (`pb-28 sm:pb-24`) en el formulario para no tapar los campos finales.
- **Botón de Edición de Perfil en Vista Móvil Restaurado ([`DetailsTab.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/DetailsTab.jsx) y [`PerfilAnimal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/PerfilAnimal.jsx))**:
  - Se eliminó la restricción `hidden md:flex` en [`DetailsTab.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/DetailsTab.jsx), haciendo visible el botón de edición para cualquier dispositivo móvil.
  - Se incorporó un botón de acceso directo "Editar" con icono de lápiz en el header superior fijo de [`PerfilAnimal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/PerfilAnimal.jsx) para vista móvil.
- **Distribución Visual en Modal de Fincas y Potreros ([`FarmModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/FarmModal.jsx))**:
  - Se reubicó el botón de administración de potreros en una fila dedicada debajo de la información principal de cada finca, dejando libre y limpio el encabezado superior con el nombre, ubicación y acciones principales.

---

## [1.2.0-phase2-features] - 2026-10-02

### Agregado
- **Nivel de Potreros dentro de Fincas**:
  - Nueva entidad `potreros` asociada a cada `farm_id` en IndexedDB ([`db.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/db.js) v7) y utilidades CRUD ([`potreroUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/potreroUtils.js)).
  - Panel expandible en cada finca dentro de [`FarmModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/FarmModal.jsx) para ver, agregar, editar y eliminar potreros.
  - Sub-filtro reactivo de potreros en el drawer de filtros de [`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx) al seleccionar una finca.
  - Creación rápida de potreros inline desde el formulario animal ([`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx)).
- **Gestión de Dueños de Animales**:
  - Nueva entidad `owners` en IndexedDB ([`db.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/db.js) v7) y utilidades CRUD ([`ownerUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/ownerUtils.js)).
  - Nuevo modal [`OwnerModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/OwnerModal.jsx) para gestión de dueños (creación, edición de nombre, listado con conteo de animales y eliminación).
  - Acceso directo a Dueños desde la barra lateral [`NavigationDrawer.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/NavigationDrawer.jsx).
  - Creación rápida de dueños inline desde [`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx).
  - Búsqueda en catálogo de inventario por nombre de dueño.

### Modificado
- **Reestructuración Completa de Formulario de Registro y Edición Animal ([`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx))**:
  - Nuevo orden estricto de campos:
    1. Número de arete (obligatorio)
    2. Número de chip
    3. Nombre (opcional)
    4. Género (Hembra / Macho)
    5. Fecha de nacimiento
    6. Peso (opcional)
    7. Color (opcional)
    8. Dueño (con selector y creación rápida)
    9. Finca (con selector y gestión de fincas)
    10. Potrero (habilitado y dependiente de la finca seleccionada, con creación rápida)
    11. Madre y Padre (Genealogía)
    12. Raza sin porcentaje (eliminada barra de pureza; añadida la opción explícita "Sin raza")
    13. Estado (Activo / Inactivo con motivo de baja)
    14. Foto + Descripción (opcional)
  - Removidos completamente los acordeones de eventos de nacimiento y destete (ahora centralizados únicamente en el módulo de eventos).
- **Catálogo de Animales ([`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx))**:
  - Tarjetas de animales actualizadas para mostrar chip electrónico, dueño, finca con potrero asociado y raza limpia sin porcentaje.
  - Búsqueda global extendida para coincidir con número de arete, nombre, número de chip y nombre del dueño.
- **Ficha Técnica del Perfil ([`DetailsTab.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/DetailsTab.jsx))**:
  - Presentación clara de arete, chip, nombre, dueño, finca, potrero, raza limpia y observaciones.

---

## [1.1.0-phase2-cleanup] - 2026-10-02

### Eliminado
- **Módulo de Ordeño en todo el sistema**:
  - Removida la pestaña de ordeño en el perfil del animal ([`PerfilAnimal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/PerfilAnimal.jsx)).
  - Removido el acceso directo de ordeño en las tarjetas del catálogo de animales ([`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx)).
  - Removido el botón de acceso a ordeño en el menú lateral ([`NavigationDrawer.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/NavigationDrawer.jsx)).
  - Eliminados los componentes [`MilkingTab.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/MilkingTab.jsx) y [`MilkingModal.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/MilkingModal.jsx).
- **Módulo de Reproducción (Tactos y Servicios)**:
  - Removidos los sub-módulos y pestañas de Tactos (Palpación) y Servicios reproductivos en [`ReproductionTab.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/ReproductionTab.jsx), dejando exclusivamente el historial de Partos/Crías ([`PartosTab.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/reproduction/PartosTab.jsx)).
  - Removido el acordeón y selector de "Servicio de Origen" en el formulario de creación/edición de animales ([`AnimalForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/AnimalForm.jsx)).
  - Removida la tarjeta informativa de servicio de origen en la ficha técnica ([`DetailsTab.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/DetailsTab.jsx)).
  - Eliminadas las rutas `/inventario/perfil/servicio` y `/inventario/perfil/tacto` en [`App.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/App.jsx).
  - Eliminados los archivos huérfanos: [`TactosTab.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/reproduction/TactosTab.jsx), [`ServiciosTab.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/reproduction/ServiciosTab.jsx), [`TactoForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/TactoForm.jsx), [`ServicioForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/ServicioForm.jsx), [`PerfilTacto.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/PerfilTacto.jsx) y [`PerfilServicio.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/PerfilServicio.jsx).
- **Vacunación por Lotes y Modo Selección**:
  - Removida la modalidad de selección múltiple por lotes en catálogo ([`Inventario.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/Inventario.jsx)), checkboxes en tarjetas y barra inferior de acciones de lote.
  - Eliminada la ruta `/inventario/tratamiento-lote` en [`App.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/App.jsx) y el archivo de página [`TratamientoLote.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/pages/TratamientoLote.jsx).
  - Simplificado el formulario sanitario [`HealthForm.jsx`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/components/inventario/HealthForm.jsx) para operaciones sanitarias individuales.

### Modificado
- **Botón Flotante (`+`) en Inventario**:
  - Ahora redirige de forma directa a la pantalla de nuevo registro animal (`/inventario/nuevo`), eliminando el menú flotante emergente.

---

## [1.0.0-baseline] - 2026-10-02

### Agregado
- **Inicialización del Proyecto `gestion-ganadera`**:
  - Creación del nuevo repositorio de trabajo desacoplado a partir de la arquitectura y código fuente base de `App-ganadera-v2`.
  - Configuración completa del stack tecnológico: **React 19**, **Vite 8**, **Tailwind CSS v4**, **Dexie 4 (IndexedDB)** y **Supabase JS v2**.
  - Conservación íntegra de la base de datos local [`GanaderaDB`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/db.js) con soporte para animales, fincas, pesajes, eventos de crecimiento, servicios reproductivos, tactos/palpaciones, tratamientos sanitarios y control de ordeño.
  - Conservación del motor de sincronización offline-first [`syncUtils.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/syncUtils.js) con cola local de operaciones (`sync_queue`), reconciliación bidireccional y compresión de imágenes en el cliente con Canvas.
  - Conservación del sistema de autenticación permanente offline con SHA-256 en [`authService.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/src/lib/authService.js).
  - Conexión provisional activa a la base de datos Supabase existente a través de [`.env.local`](file:///C:/Users/joses/appganadera/gestion-ganadera/.env.local).
  - Configuración del manifiesto de la aplicación web progresiva (**PWA**) y service worker en [`vite.config.js`](file:///C:/Users/joses/appganadera/gestion-ganadera/vite.config.js) bajo la denominación *"Gestión Ganadera"*.
  - Creación del documento de control y hoja de ruta [`planificacion.md`](file:///C:/Users/joses/appganadera/gestion-ganadera/planificacion.md).
