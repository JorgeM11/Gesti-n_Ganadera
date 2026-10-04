-- ==============================================================================
-- PROYECTO: GESTIÓN GANADERA
-- ESQUEMA COMPLETO DE BASE DE DATOS (SUPABASE / POSTGRESQL) - FASE 3
-- Incluye: Tablas, Relaciones FK, Restricciones, Triggers updated_at,
--          Políticas RLS, Storage de Imágenes y Preparación para Perfil Obrero.
-- ==============================================================================

-- 1. EXTENSIONES NECESARIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. FUNCIÓN PARA ACTUALIZACIÓN AUTOMÁTICA DE 'updated_at'
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 3. TABLA: usuarios (Con soporte preparado para 'obrero' y jerarquía admin)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'obrero', 'operador', 'veterinario')),
    -- Para futuros obreros: admin_id vincula al obrero con su administrador titular
    admin_id UUID REFERENCES usuarios(id) ON DELETE CASCADE NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Activo' CHECK (status IN ('Activo', 'Inactivo', 'Suspendido')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TRIGGER trg_usuarios_updated_at
BEFORE UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_admin_id ON usuarios(admin_id);

-- ==============================================================================
-- 4. TABLA: farms (Fincas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS farms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT NULL,
    description TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TRIGGER trg_farms_updated_at
BEFORE UPDATE ON farms
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_farms_user_id ON farms(user_id);

-- ==============================================================================
-- 5. TABLA: potreros (Potreros asociados obligatoriamente a una Finca)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS potreros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TRIGGER trg_potreros_updated_at
BEFORE UPDATE ON potreros
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_potreros_user_id ON potreros(user_id);
CREATE INDEX IF NOT EXISTS idx_potreros_farm_id ON potreros(farm_id);

-- ==============================================================================
-- 6. TABLA: owners (Dueños del ganado)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TRIGGER trg_owners_updated_at
BEFORE UPDATE ON owners
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_owners_user_id ON owners(user_id);

-- ==============================================================================
-- 7. TABLA: animals (Inventario Ganadero con Chip, Nombre, Potrero y Dueño)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS animals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    farm_id UUID NULL REFERENCES farms(id) ON DELETE SET NULL,
    potrero_id UUID NULL REFERENCES potreros(id) ON DELETE SET NULL,
    owner_id UUID NULL REFERENCES owners(id) ON DELETE SET NULL,
    number TEXT NOT NULL, -- Número de Arete / Identificador principal
    chip_number TEXT NULL, -- Código microchip RFID escaneado o manual
    name TEXT NULL, -- Nombre o alias del animal
    sex VARCHAR(10) NOT NULL CHECK (sex IN ('Macho', 'Hembra')),
    birth_date DATE NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Activo' CHECK (status IN ('Activo', 'Inactivo')),
    inactivity_reason TEXT NULL,
    photo_path TEXT NULL, -- URL pública en Storage
    mother_id UUID NULL REFERENCES animals(id) ON DELETE SET NULL,
    father_id UUID NULL REFERENCES animals(id) ON DELETE SET NULL,
    birth_weight_kg NUMERIC(6,2) NULL,
    color TEXT NULL,
    observations TEXT NULL,
    last_weight_kg NUMERIC(6,2) NULL,
    last_weight_date DATE NULL,
    breed TEXT NOT NULL DEFAULT 'Sin raza',
    purity_percentage NUMERIC(5,2) NULL,
    breed_composition JSONB NULL,
    -- Auditoría para futuros obreros (quién creó el registro)
    created_by_user_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TRIGGER trg_animals_updated_at
BEFORE UPDATE ON animals
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_animals_user_id ON animals(user_id);
CREATE INDEX IF NOT EXISTS idx_animals_farm_id ON animals(farm_id);
CREATE INDEX IF NOT EXISTS idx_animals_potrero_id ON animals(potrero_id);
CREATE INDEX IF NOT EXISTS idx_animals_owner_id ON animals(owner_id);
CREATE INDEX IF NOT EXISTS idx_animals_number ON animals(number);
CREATE INDEX IF NOT EXISTS idx_animals_chip ON animals(chip_number);
CREATE INDEX IF NOT EXISTS idx_animals_updated_at ON animals(updated_at);

-- ==============================================================================
-- 8. TABLA: growth_events (Pesajes y Medidas Corporales)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS growth_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- Nacimiento, Destete, Pesaje, etc.
    event_date DATE NOT NULL,
    weight_kg NUMERIC(6,2) NULL,
    mother_weight_kg NUMERIC(6,2) NULL,
    scrotal_circumference_cm NUMERIC(5,2) NULL,
    navel_length TEXT NULL,
    observations TEXT NULL,
    photo_path TEXT NULL,
    created_by_user_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TRIGGER trg_growth_events_updated_at
BEFORE UPDATE ON growth_events
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_growth_events_animal_id ON growth_events(animal_id);
CREATE INDEX IF NOT EXISTS idx_growth_events_user_id ON growth_events(user_id);
CREATE INDEX IF NOT EXISTS idx_growth_events_updated_at ON growth_events(updated_at);

-- ==============================================================================
-- 9. TABLA: health_records (Sanidad, Vacunación y Tratamientos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS health_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
    batch_id TEXT NULL,
    product_type VARCHAR(30) NOT NULL CHECK (product_type IN ('Vacuna', 'Desparasitante', 'Vitamina', 'Antibiótico')),
    product_name TEXT NOT NULL,
    dose TEXT NULL,
    application_date DATE NOT NULL,
    created_by_user_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TRIGGER trg_health_records_updated_at
BEFORE UPDATE ON health_records
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_health_records_animal_id ON health_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_health_records_user_id ON health_records(user_id);
CREATE INDEX IF NOT EXISTS idx_health_records_updated_at ON health_records(updated_at);

-- ==============================================================================
-- 10. POLÍTICAS DE SEGURIDAD (ROW LEVEL SECURITY - RLS)
-- Permite lectura y sincronización offline-first mediante clave anon y autenticación propia
-- ==============================================================================
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE potreros ENABLE ROW LEVEL SECURITY;
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE animals ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso completo para cliente anon y authenticated
CREATE POLICY "Permitir todo en usuarios" ON usuarios FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en farms" ON farms FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en potreros" ON potreros FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en owners" ON owners FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en animals" ON animals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en growth_events" ON growth_events FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en health_records" ON health_records FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 11. BUCKET DE ALMACENAMIENTO DE IMÁGENES (ganadera_images)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'ganadera_images',
    'ganadera_images',
    true,
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

-- Políticas del Storage para permitir ver y subir imágenes
CREATE POLICY "Acceso publico lectura ganadera_images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'ganadera_images');

CREATE POLICY "Permitir subir fotos ganadera_images"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'ganadera_images');

CREATE POLICY "Permitir actualizar fotos ganadera_images"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'ganadera_images');

CREATE POLICY "Permitir borrar fotos ganadera_images"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'ganadera_images');

-- ==============================================================================
-- 12. USUARIO ADMINISTRADOR INICIAL (SEED)
-- Email: admin@campo.com | Contraseña inicial: admin123
-- Password hash: SHA-256 de 'admin123'
-- ==============================================================================
INSERT INTO usuarios (id, name, email, password_hash, role, admin_id, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Administrador Principal',
    'admin@campo.com',
    '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    'admin',
    NULL,
    'Activo'
)
ON CONFLICT (email) DO NOTHING;
