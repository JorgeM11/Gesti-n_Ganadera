# Historial de Cambios - Gestión Ganadera

Este documento registra de forma cronológica todas las modificaciones, mejoras, nuevas funcionalidades y correcciones aplicadas sobre el sistema **Gestión Ganadera**.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
