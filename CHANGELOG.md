# Historial de Cambios - Gestión Ganadera

Este documento registra de forma cronológica todas las modificaciones, mejoras, nuevas funcionalidades y correcciones aplicadas sobre el sistema **Gestión Ganadera**.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
