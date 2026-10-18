-- ==============================================================================
-- PROYECTO: GESTIÓN GANADERA
-- ACTUALIZACIÓN: SNAPSHOT INMUTABLE DE VAQUERÍAS FINALIZADAS Y LIMPIEZA
-- ==============================================================================
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase (Dashboard -> SQL Editor -> New Query)

-- 1. Añadir columna snapshot_data tipo JSONB en la tabla vaquerias (si no existe)
ALTER TABLE vaquerias 
ADD COLUMN IF NOT EXISTS snapshot_data JSONB NULL;

-- 2. Documentar el propósito de la columna
COMMENT ON COLUMN vaquerias.snapshot_data IS 'Fotografía congelada (snapshot) inmutable de presentes, faltantes y métricas al momento de finalizar la vaquería.';

-- 3. Limpiar todos los registros de vaquerías para empezar completamente en limpio
-- (NOTA: Solo limpia las sesiones y asistencias de vaquerías; los animales, fincas y potreros NO se tocan)
TRUNCATE TABLE vaqueria_animals, vaquerias CASCADE;
