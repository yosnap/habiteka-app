-- Migración de CanvasDoc v1 → v2: muros como WallSegment[]
-- ============================================================
-- PREREQUISITO: backup completo de BD antes de ejecutar.
-- IDEMPOTENTE: procesa solo filas donde data->>'version' IS NULL o '1'.
-- Re-ejecutar después de un fallo parcial es seguro.
--
-- v1: doc.objects[] contiene objetos con kind='wall' (rectángulos rotados).
-- v2: doc.walls[]   contiene WallSegment {p1,p2,thicknessPx,…}.
--     doc.version   = 2 (dentro del JSONB).
--
-- La conversión usa la misma fórmula que migrateDoc() en src/canvas/migrations.ts:
--   Konva rota alrededor de la esquina superior-izquierda (x, y).
--   p1 = (x − hh·sin θ,  y + hh·cos θ)
--   p2 = (x + w·cos θ − hh·sin θ,  y + w·sin θ + hh·cos θ)
-- donde hh = height/2  y  θ = rotation·π/180.

BEGIN;

DO $$
DECLARE
  rec          RECORD;
  wall_obj     JSONB;
  wall_seg     JSONB;
  walls_arr    JSONB;
  new_objects  JSONB;
  new_data     JSONB;
  rot_deg      FLOAT;
  rot_rad      FLOAT;
  cos_r        FLOAT;
  sin_r        FLOAT;
  w            FLOAT;
  hh           FLOAT;
  ox           FLOAT;
  oy           FLOAT;
  p1x          FLOAT;
  p1y          FLOAT;
  p2x          FLOAT;
  p2y          FLOAT;
BEGIN
  FOR rec IN
    SELECT id, data
    FROM canvas_state
    WHERE
      (data->>'version' IS NULL OR data->>'version' = '1')
      -- Solo migrar si hay objetos con kind='wall' para no tocar docs ya limpios
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(data->'objects', '[]'::jsonb)) AS obj
        WHERE obj->>'kind' = 'wall'
      )
  LOOP
    walls_arr   := '[]'::jsonb;
    new_objects := '[]'::jsonb;

    FOR wall_obj IN
      SELECT value FROM jsonb_array_elements(rec.data->'objects')
    LOOP
      IF wall_obj->>'kind' = 'wall' THEN
        -- Extraer geometría del rectángulo
        ox      := (wall_obj->>'x')::FLOAT;
        oy      := (wall_obj->>'y')::FLOAT;
        w       := (wall_obj->>'width')::FLOAT;
        hh      := (wall_obj->>'height')::FLOAT / 2.0;
        rot_deg := COALESCE((wall_obj->>'rotation')::FLOAT, 0.0);
        rot_rad := rot_deg * pi() / 180.0;
        cos_r   := cos(rot_rad);
        sin_r   := sin(rot_rad);

        -- Centros de los dos extremos cortos (fórmula de migrations.ts)
        p1x := ox             - hh * sin_r;
        p1y := oy             + hh * cos_r;
        p2x := ox + w * cos_r - hh * sin_r;
        p2y := oy + w * sin_r + hh * cos_r;

        -- Construir WallSegment JSONB
        wall_seg := jsonb_build_object(
          'id',          wall_obj->>'id',
          'p1',          jsonb_build_object('x', round(p1x::numeric, 4), 'y', round(p1y::numeric, 4)),
          'p2',          jsonb_build_object('x', round(p2x::numeric, 4), 'y', round(p2y::numeric, 4)),
          'thicknessPx', wall_obj->>'height'
        );

        -- Propagar heightM, color y meta si existen
        IF wall_obj ? 'heightM' THEN
          wall_seg := wall_seg || jsonb_build_object('heightM', wall_obj->'heightM');
        END IF;
        IF wall_obj ? 'color' THEN
          wall_seg := wall_seg || jsonb_build_object('color', wall_obj->>'color');
        END IF;
        IF wall_obj ? 'meta' THEN
          wall_seg := wall_seg || jsonb_build_object('meta', wall_obj->'meta');
        END IF;

        walls_arr := walls_arr || jsonb_build_array(wall_seg);

      ELSE
        -- Objeto no-muro: añadir catalogId si falta
        IF NOT (wall_obj ? 'catalogId') THEN
          wall_obj := wall_obj || jsonb_build_object(
            'catalogId', 'builtin:' || (wall_obj->>'kind')
          );
        END IF;
        new_objects := new_objects || jsonb_build_array(wall_obj);
      END IF;
    END LOOP;

    -- Construir nuevo doc: fusionar walls existentes + migradas, actualizar version
    new_data := rec.data
      || jsonb_build_object(
           'version', 2,
           'walls',   COALESCE(rec.data->'walls', '[]'::jsonb) || walls_arr,
           'objects', new_objects
         );

    UPDATE canvas_state
    SET data = new_data
    WHERE id = rec.id;

    RAISE NOTICE 'Migrado canvas_state.id=% (%)', rec.id,
      jsonb_array_length(walls_arr) || ' muros → WallSegment';
  END LOOP;
END;
$$;

COMMIT;

-- Verificación post-migración (solo consulta, no modifica):
-- SELECT id, data->>'version' AS doc_version,
--        jsonb_array_length(COALESCE(data->'walls','[]'::jsonb)) AS num_walls,
--        jsonb_array_length(COALESCE(data->'objects','[]'::jsonb)) AS num_objects
-- FROM canvas_state
-- ORDER BY id;
