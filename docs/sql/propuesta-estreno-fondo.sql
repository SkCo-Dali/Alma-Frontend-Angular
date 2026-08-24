/*
  EJECUTADA en PRD el 24-ago-2026 (14 filas). — Estreno del fondo solarpunk.

  LECCIÓN (incidente del mismo día): la primera versión de este script dejaba el
  COMMIT comentado "para verificar antes". La transacción quedó abierta en SSMS
  con locks exclusivos sobre alma.UserPreferences y tumbó /me y /me/preferences
  en PRD (gateway timeout) hasta que se ejecutó el COMMIT. Un script de cambio
  NUNCA debe terminar con la transacción abierta: se valida con la condición del
  propio UPDATE y @@ROWCOUNT, y se confirma o revierte EN EL MISMO lote.

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

-- ── 3. El cambio (auto-contenido: confirma o revierte en el mismo lote) ─────
DECLARE @esperadas int = (
  SELECT COUNT(*) FROM alma.UserPreferences
  WHERE ISJSON(Data) = 1 AND ISNULL(JSON_VALUE(Data, '$.background'), '') <> 'terraza'
);

BEGIN TRANSACTION;

UPDATE alma.UserPreferences
SET Data = JSON_MODIFY(Data, '$.background', 'terraza'),
    UpdatedAt = SYSUTCDATETIME()
WHERE ISJSON(Data) = 1
  AND ISNULL(JSON_VALUE(Data, '$.background'), '') <> 'terraza';

IF @@ROWCOUNT = @esperadas
BEGIN
  COMMIT TRANSACTION;
  PRINT CONCAT('OK: ', @esperadas, ' filas actualizadas y confirmadas.');
END
ELSE
BEGIN
  ROLLBACK TRANSACTION;
  PRINT 'ROLLBACK: el conteo no coincidió con lo esperado.';
END

-- ── 4. Vuelta atrás (si hiciera falta) ─────────────────────────────────────
/*
UPDATE p
SET p.Data = b.Data, p.UpdatedAt = b.UpdatedAt
FROM alma.UserPreferences p
JOIN alma.UserPreferences_bkp_estreno_fondo_20260824 b ON b.UserId = p.UserId;
*/
