# Historial de Cambios - Gestión Ganadera

Este documento registra de forma cronológica todas las modificaciones, mejoras, nuevas funcionalidades y correcciones aplicadas sobre el sistema **Gestión Ganadera**.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
