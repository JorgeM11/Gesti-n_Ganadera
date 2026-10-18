-- ==============================================================================
-- MIGRACIÓN: AGREGAR updated_by_user_id A LA TABLA animals PARA AUDITORÍA
-- ==============================================================================

-- 1. Agregar columna updated_by_user_id que referencia a usuarios(id)
ALTER TABLE animals 
ADD COLUMN IF NOT EXISTS updated_by_user_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL;

-- 2. Crear índice para optimizar consultas de auditoría
CREATE INDEX IF NOT EXISTS idx_animals_updated_by_user_id ON animals(updated_by_user_id);
