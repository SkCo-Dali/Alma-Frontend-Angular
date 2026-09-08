# Servicio de comunicaciones (visor de EML) — backend

Router FastAPI que expone el **índice de comunicaciones** y la **descarga del `.eml`**
desde Azure Blob Storage, para la app **Visor de comunicaciones** del frontend.

> ✅ **Ya implementado en `alma-backend`** (2026-09-03), siguiendo las convenciones
> reales del repo. Este `docs/backend/` queda como referencia del contrato. Archivos
> creados/editados allá:
> - `app/api/Comunicaciones/comunicaciones_routes.py` — router (`/api/comunicaciones`),
>   protegido con `requiere_permiso("app.visor-comunicaciones.view")`.
> - `app/services/comunicaciones_service.py` — acceso a Blob Storage (listar + abrir).
> - `app/config.py` — vars `COMUNICACIONES_*` (+ `COMUNICACIONES_SAS`).
> - `main.py` — registro del router. `.env.example` — documentación de vars.
> - `migrations/033_visor_comunicaciones_rbac.sql` — App + roles + permiso RBAC.
>
> Diferencias vs. el borrador de abajo: la descarga usa `StreamingResponse`
> (`.chunks()`), la auth al storage es **SAS (`COMUNICACIONES_SAS`) → si no,
> `ChainedTokenCredential(ManagedIdentityCredential(), AzureCliCredential())`**
> (no `DefaultAzureCredential`, que rompería con el `AZURE_CLIENT_ID` de Entra), y
> cada endpoint exige el permiso `app.visor-comunicaciones.view`.

## Endpoints (contrato que consume el front)

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `/api/comunicaciones?limit=50&cursor=…` | `{ data: ComunicacionRef[], next: string \| null }` |
| GET | `/api/comunicaciones/{id}/eml` | bytes del `.eml` (`message/rfc822`) |

`ComunicacionRef` = `{ id, remitente, remitenteEmail, destinatarios[], asunto, tipo, fecha (ISO), adjuntos, tamanoBytes, archivo }`.
`archivo` viene como `/api/comunicaciones/{id}/eml` (el front lo descarga autenticado).

## Instalación / registro

```bash
pip install azure-storage-blob azure-identity
```

```python
# en el arranque de la app (main.py)
from .routers import comunicaciones
app.include_router(comunicaciones.router)
# 👉 protégelo con tu dependencia de auth/permiso, p. ej.:
# app.include_router(comunicaciones.router, dependencies=[Depends(require_permission("app.visor-comunicaciones.view"))])
```

## Configuración (variables de entorno)

| Var | Default | Descripción |
|---|---|---|
| `COMUNICACIONES_STORAGE_ACCOUNT` | `crskcol001` | Cuenta de storage |
| `COMUNICACIONES_CONTAINER` | `raw` | Contenedor |
| `COMUNICACIONES_PREFIX` | `DataEngineering/ComunicationServices/campaigns/eml/` | Prefijo de los `.eml` |
| `AZURE_STORAGE_CONNECTION_STRING` | *(vacío)* | Si se define, se usa en vez de Managed Identity |

## Autenticación al storage

Por defecto usa **`DefaultAzureCredential`** (keyless):
- En Azure: **Managed Identity** del App Service → dale el rol **Storage Blob Data Reader**
  sobre la cuenta/contenedor.
- En local: `az login` (usa tu identidad).
- Alternativa rápida: `AZURE_STORAGE_CONNECTION_STRING`.

## Supuestos (revisar/ajustar)

1. **Contenedor `raw`** en minúsculas (los contenedores de Azure son minúsculas; el
   equipo escribió "Raw").
2. Los `.eml` cuelgan del **prefijo** indicado; se listan solo archivos `*.eml`.
3. **Fecha** y **tipo** se derivan de la **ruta** (`…/<campaña>/YYYYMM/DD/HHMM/…`).
   El mapeo campaña→tipo está en `TIPO_POR_CAMPANA` (ajústalo).
4. Para el **índice** se leen solo los **primeros 64 KB** de cada `.eml` (headers).
   → `remitente/asunto/destinatarios` exactos; **`adjuntos` es aproximado** (el conteo
   exacto lo calcula el visor al abrir el correo). Si necesitas el conteo exacto en la
   lista, conviene **precomputar metadatos** (metadata/tags del blob o una tabla) en el
   proceso que deposita los `.eml`, y leerlos aquí en vez de parsear al vuelo.
5. **Rendimiento**: con muchos correos, parsear headers por página está bien, pero para
   escalar conviene un **índice/caché** (o metadatos precomputados). Hoy la lista es por
   páginas (`limit`/`cursor`).

## Alternativa: SAS de corta duración (recomendada para escalar)

En vez de que el API transmita los bytes, puede devolver una **SAS temporal** y que el
front descargue **directo de Azure** (API liviano). Requiere:
- **User Delegation SAS** con la Managed Identity, y
- **CORS** en la Storage Account permitiendo el origen del front (GET).

Reemplazo del endpoint `/{id}/eml` por `/{id}/sas`:

```python
from datetime import timedelta
from azure.storage.blob import BlobSasPermissions, generate_blob_sas

@router.get("/{id}/sas")
def sas(id: str):
    blob_name = _blob_de(id)
    svc = _service()
    start = datetime.now(timezone.utc)
    expiry = start + timedelta(minutes=5)
    udk = svc.get_user_delegation_key(start, expiry)          # keyless
    token = generate_blob_sas(
        account_name=ACCOUNT, container_name=CONTAINER, blob_name=blob_name,
        user_delegation_key=udk, permission=BlobSasPermissions(read=True),
        start=start, expiry=expiry,
    )
    return {"url": f"https://{ACCOUNT}.blob.core.windows.net/{CONTAINER}/{blob_name}?{token}"}
```

Y en el front, `archivo` sería `/api/comunicaciones/{id}/sas`; `obtenerEml` pediría el
SAS y luego haría `fetch(url)` directo (ver `comunicaciones.service.ts`).
