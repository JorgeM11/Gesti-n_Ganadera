-- ==============================================================================
-- PROYECTO: GESTIÓN GANADERA
-- ESQUEMA DE BASE DE DATOS: MÓDULO DE VAQUERÍA (ASISTENCIA Y CONTROL DE CAMPO)
-- Tablas nuevas: vaquerias, vaqueria_animals
-- ==============================================================================

-- 1. TABLA: vaquerias (Sesión de asistencia por Finca)
CREATE TABLE IF NOT EXISTS vaquerias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'En progreso' CHECK (status IN ('En progreso', 'Finalizada')),
    observations TEXT NULL,
    snapshot_data JSONB NULL,
    created_by_user_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TRIGGER trg_vaquerias_updated_at
BEFORE UPDATE ON vaquerias
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_vaquerias_user_id ON vaquerias(user_id);
CREATE INDEX IF NOT EXISTS idx_vaquerias_farm_id ON vaquerias(farm_id);
CREATE INDEX IF NOT EXISTS idx_vaquerias_date ON vaquerias(date);
CREATE INDEX IF NOT EXISTS idx_vaquerias_updated_at ON vaquerias(updated_at);

-- 2. TABLA: vaqueria_animals (Registro de animales presentes en la Vaquería)
CREATE TABLE IF NOT EXISTS vaqueria_animals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vaqueria_id UUID NOT NULL REFERENCES vaquerias(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    animal_id UUID NULL REFERENCES animals(id) ON DELETE SET NULL,
    scanned_code TEXT NULL,
    identification_type VARCHAR(20) NOT NULL DEFAULT 'chip' CHECK (identification_type IN ('chip', 'arete', 'name', 'manual')),
    number TEXT NULL,
    chip_number TEXT NULL,
    name TEXT NULL,
    is_unregistered BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TRIGGER trg_vaqueria_animals_updated_at
BEFORE UPDATE ON vaqueria_animals
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_vaqueria_animals_vaqueria_id ON vaqueria_animals(vaqueria_id);
CREATE INDEX IF NOT EXISTS idx_vaqueria_animals_user_id ON vaqueria_animals(user_id);
CREATE INDEX IF NOT EXISTS idx_vaqueria_animals_animal_id ON vaqueria_animals(animal_id);
CREATE INDEX IF NOT EXISTS idx_vaqueria_animals_chip ON vaqueria_animals(chip_number);
CREATE INDEX IF NOT EXISTS idx_vaqueria_animals_number ON vaqueria_animals(number);
CREATE INDEX IF NOT EXISTS idx_vaqueria_animals_updated_at ON vaqueria_animals(updated_at);

-- 3. POLÍTICAS DE SEGURIDAD (ROW LEVEL SECURITY - RLS)
ALTER TABLE vaquerias ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaqueria_animals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todo en vaquerias" ON vaquerias FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en vaqueria_animals" ON vaqueria_animals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
