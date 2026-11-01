-- ==============================================================================
-- MIGRACIÓN FASE 4: REQS 14, 15 & 18 (ROLES PRODUCTIVOS Y EVIDENCIA DE MUERTE)
-- ==============================================================================

-- 1. Agregar columna 'productive_role' con valor por defecto 'Cría'
ALTER TABLE animals 
ADD COLUMN IF NOT EXISTS productive_role TEXT DEFAULT 'Cría';

-- 2. Agregar columna 'death_photo_path' para almacenar la URL de evidencia de muerte
ALTER TABLE animals 
ADD COLUMN IF NOT EXISTS death_photo_path TEXT;

-- 3. Crear índice para acelerar filtrados por rol productivo
CREATE INDEX IF NOT EXISTS idx_animals_productive_role ON animals(productive_role);
