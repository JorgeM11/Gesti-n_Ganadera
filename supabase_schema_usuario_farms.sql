-- ==============================================================================
-- PROYECTO: GESTIÓN GANADERA
-- FASE 3 - PARTE 3: ASIGNACIÓN DE FINCAS A OBREROS / USUARIOS (usuario_farms)
-- ==============================================================================
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase (Dashboard -> SQL Editor -> New Query)

-- 1. Tabla relacional: usuario_farms
CREATE TABLE IF NOT EXISTS usuario_farms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    UNIQUE(user_id, farm_id)
);

-- 2. Trigger para updated_at automático
CREATE TRIGGER trg_usuario_farms_updated_at
BEFORE UPDATE ON usuario_farms
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Índices de optimización para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_usuario_farms_user_id ON usuario_farms(user_id);
CREATE INDEX IF NOT EXISTS idx_usuario_farms_farm_id ON usuario_farms(farm_id);
CREATE INDEX IF NOT EXISTS idx_usuario_farms_updated_at ON usuario_farms(updated_at);

-- 4. Habilitar y configurar Row Level Security (RLS)
ALTER TABLE usuario_farms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuario_farms_select_all" ON usuario_farms;
CREATE POLICY "usuario_farms_select_all" ON usuario_farms
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "usuario_farms_insert_all" ON usuario_farms;
CREATE POLICY "usuario_farms_insert_all" ON usuario_farms
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "usuario_farms_update_all" ON usuario_farms;
CREATE POLICY "usuario_farms_update_all" ON usuario_farms
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "usuario_farms_delete_all" ON usuario_farms;
CREATE POLICY "usuario_farms_delete_all" ON usuario_farms
    FOR DELETE TO anon, authenticated USING (true);

-- 5. Documentación de tabla
COMMENT ON TABLE usuario_farms IS 'Relación de fincas asignadas a cada obrero u operador para restringir su inventario.';
