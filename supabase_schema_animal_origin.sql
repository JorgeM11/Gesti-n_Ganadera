-- ==============================================================================
-- MIGRACIÓN FASE 4: REQ 17 (ORIGEN Y PROCEDENCIA DEL ANIMAL)
-- ==============================================================================

-- 1. Agregar columna 'origin' para registrar la procedencia o hacienda de origen
ALTER TABLE animals 
ADD COLUMN IF NOT EXISTS origin TEXT;

-- 2. Índice opcional para búsquedas o consultas por procedencia
CREATE INDEX IF NOT EXISTS idx_animals_origin ON animals(origin);
