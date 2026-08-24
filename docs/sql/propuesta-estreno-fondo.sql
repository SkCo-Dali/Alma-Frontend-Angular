/*
  PROPUESTA (no ejecutada) — Estreno del fondo solarpunk, ago-2026.

  Alinea el fondo guardado en el servidor con el nuevo por defecto ('terraza'),
  para que el estreno también aplique en los otros navegadores/dispositivos del
  usuario sin depender del sello que el front guarda en localStorage.

  Contexto: alma.UserPreferences guarda un JSON opaco en la columna Data
  (lo define el front), no una columna por preferencia. Por eso se usa
  JSON_MODIFY sobre '$.background' y NO se toca el resto del JSON (tema, orden
  del Dock, ancladas, favoritos).

  Conteo en DEV al 24-ago-2026: 8 filas, 5 con 'esmeralda' y 3 ya en 'terraza'.

  Antes de ejecutar en cualquier ambiente:
    1) Correr el SELECT de verificación y guardar el resultado.
    2) Respaldar las filas afectadas (script de respaldo abajo).
    3) Ejecutar el UPDATE dentro de una transacción explícita.
*/

-- ── 1. Verificación previa: qué hay y qué cambiaría ─────────────────────────
SELECT JSON_VALUE(Data, '$.background') AS fondo, COUNT(*) AS usuarios
FROM alma.UserPreferences
WHERE ISJSON(Data) = 1
GROUP BY JSON_VALUE(Data, '$.background')
ORDER BY usuarios DESC;

-- ── 2. Respaldo de las filas que se van a tocar ─────────────────────────────
--     (tabla temporal con fecha; borrarla cuando el cambio esté validado)
SELECT UserId, Data, UpdatedAt
INTO alma.UserPreferences_bkp_estreno_fondo_20260824
FROM alma.UserPreferences
WHERE ISJSON(Data) = 1
  AND ISNULL(JSON_VALUE(Data, '$.background'), '') <> 'terraza';

-- ── 3. El cambio ───────────────────────────────────────────────────────────
BEGIN TRANSACTION;

UPDATE alma.UserPreferences
SET Data = JSON_MODIFY(Data, '$.background', 'terraza'),
    UpdatedAt = SYSUTCDATETIME()
WHERE ISJSON(Data) = 1
  AND ISNULL(JSON_VALUE(Data, '$.background'), '') <> 'terraza';

-- Revisar el conteo afectado antes de confirmar:
SELECT @@ROWCOUNT AS filas_actualizadas;

-- COMMIT TRANSACTION;   -- descomentar cuando el conteo sea el esperado
-- ROLLBACK TRANSACTION; -- si algo no cuadra

-- ── 4. Vuelta atrás (si hiciera falta) ─────────────────────────────────────
/*
UPDATE p
SET p.Data = b.Data, p.UpdatedAt = b.UpdatedAt
FROM alma.UserPreferences p
JOIN alma.UserPreferences_bkp_estreno_fondo_20260824 b ON b.UserId = p.UserId;
*/
