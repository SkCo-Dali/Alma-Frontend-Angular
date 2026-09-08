# Router FastAPI: índice de comunicaciones (.eml) desde Azure Blob Storage.
#
# Copiar a alma-backend (p. ej. app/routers/comunicaciones.py) y registrarlo:
#     from .routers import comunicaciones
#     app.include_router(comunicaciones.router)
#
# Contrato que consume el frontend (ComunicacionesService):
#   GET /api/comunicaciones              -> { data: ComunicacionRef[], next: str|None }
#   GET /api/comunicaciones/{id}/eml     -> bytes del .eml (message/rfc822)
#
# Estructura del storage (según el equipo):
#   cuenta: crskcol001  contenedor: raw
#   prefijo: DataEngineering/ComunicationServices/campaigns/eml/<campaña>/YYYYMM/DD/HHMM/...<archivo>.eml
#   -> de la RUTA se derivan campaña (=> tipo) y fecha; del .eml se parsean los headers.
#
# Auth a storage: DefaultAzureCredential (Managed Identity en Azure / az login en local).
#   Alternativa: AZURE_STORAGE_CONNECTION_STRING.
#
# Requisitos: pip install azure-storage-blob azure-identity

from __future__ import annotations

import base64
import os
import re
from datetime import datetime, timezone
from email import policy
from email.parser import BytesParser
from functools import lru_cache
from typing import Optional

from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient
from fastapi import APIRouter, HTTPException, Query, Response

# ── Configuración (env) ──────────────────────────────────────────────────────
ACCOUNT = os.getenv("COMUNICACIONES_STORAGE_ACCOUNT", "crskcol001")
CONTAINER = os.getenv("COMUNICACIONES_CONTAINER", "raw")
PREFIX = os.getenv(
    "COMUNICACIONES_PREFIX", "DataEngineering/ComunicationServices/campaigns/eml/"
)
CONN_STR = os.getenv("AZURE_STORAGE_CONNECTION_STRING")

# Campaña (segmento tras 'eml/') -> tipo mostrado en la bandeja. Ajustar.
TIPO_POR_CAMPANA = {
    "EnvioCreaPatrimonio": "Comercial",
}
TIPO_DEFECTO = "Comercial"

router = APIRouter(prefix="/api/comunicaciones", tags=["comunicaciones"])


@lru_cache(maxsize=1)
def _service() -> BlobServiceClient:
    if CONN_STR:
        return BlobServiceClient.from_connection_string(CONN_STR)
    return BlobServiceClient(
        f"https://{ACCOUNT}.blob.core.windows.net", credential=DefaultAzureCredential()
    )


def _container():
    return _service().get_container_client(CONTAINER)


def _id_de(blob_name: str) -> str:
    return base64.urlsafe_b64encode(blob_name.encode()).decode().rstrip("=")


def _blob_de(id_: str) -> str:
    pad = "=" * (-len(id_) % 4)
    return base64.urlsafe_b64decode(id_ + pad).decode()


_FECHA_RE = re.compile(r"/(\d{6})/(\d{2})/(\d{3,4})(?:/|$)")


def _fecha_de_ruta(blob_name: str) -> Optional[str]:
    """Deriva ISO de .../YYYYMM/DD/HHMM/... ; None si no matchea."""
    m = _FECHA_RE.search("/" + blob_name)
    if not m:
        return None
    ym, dd, hm = m.groups()
    hm = hm.zfill(4)
    try:
        return datetime(
            int(ym[:4]), int(ym[4:6]), int(dd), int(hm[:2]), int(hm[2:4]),
            tzinfo=timezone.utc,
        ).isoformat()
    except ValueError:
        return None


def _tipo_de_ruta(blob_name: str) -> str:
    resto = blob_name[len(PREFIX):] if blob_name.startswith(PREFIX) else blob_name
    campana = resto.split("/", 1)[0] if resto else ""
    return TIPO_POR_CAMPANA.get(campana, TIPO_DEFECTO)


def _dir(addr) -> str:
    return (addr.addresses[0].addr_spec if addr and addr.addresses else str(addr or "")).strip()


def _headers_de(cabecera: bytes) -> dict:
    """Parsea SOLO headers (más el arranque del cuerpo) para el índice."""
    msg = BytesParser(policy=policy.default).parsebytes(cabecera)
    remitente = msg["from"]
    remitente_email = _dir(msg["from"])
    to = msg["to"]
    destinatarios = [a.addr_spec for a in (to.addresses if to else [])]
    # #adjuntos aproximado a partir del arranque (exacto al abrir en el visor).
    adjuntos = cabecera.count(b"Content-Disposition: attachment")
    return {
        "remitente": (str(remitente.addresses[0].display_name) if remitente and remitente.addresses and remitente.addresses[0].display_name else remitente_email) or "—",
        "remitenteEmail": remitente_email or "—",
        "destinatarios": destinatarios or [],
        "asunto": str(msg["subject"] or "(sin asunto)").strip(),
        "adjuntos": adjuntos,
    }


def _a_ref(blob) -> dict:
    ident = _id_de(blob.name)
    meta = {"remitente": "—", "remitenteEmail": "—", "destinatarios": [], "asunto": blob.name.rsplit("/", 1)[-1], "adjuntos": 0}
    try:
        # Rango pequeño: los headers están al inicio del .eml.
        data = _container().download_blob(blob.name, offset=0, length=64 * 1024).readall()
        meta = _headers_de(data)
    except Exception:  # noqa: BLE001 (si falla el parseo, mostramos el mínimo)
        pass
    fecha = _fecha_de_ruta(blob.name) or (
        blob.last_modified.isoformat() if getattr(blob, "last_modified", None) else None
    )
    return {
        "id": ident,
        **meta,
        "tipo": _tipo_de_ruta(blob.name),
        "fecha": fecha,
        "tamanoBytes": blob.size or 0,
        # El front descarga el .eml con este endpoint (autenticado). Ver README
        # para la variante con SAS de corta duración.
        "archivo": f"/api/comunicaciones/{ident}/eml",
    }


@router.get("")
def listar(
    limit: int = Query(50, ge=1, le=200),
    cursor: Optional[str] = None,
):
    """Índice paginado de comunicaciones. `cursor` = continuation token."""
    cont = _container()
    pager = cont.list_blobs(name_starts_with=PREFIX, results_per_page=limit).by_page(cursor)
    try:
        page = next(pager)
        blobs = [b for b in page if b.name.lower().endswith(".eml")]
    except StopIteration:
        blobs = []
    data = [_a_ref(b) for b in blobs]
    return {"data": data, "next": pager.continuation_token or None}


@router.get("/{id}/eml")
def obtener_eml(id: str):
    """Transmite los bytes del .eml (para parsear/render en el visor)."""
    try:
        blob_name = _blob_de(id)
    except Exception:
        raise HTTPException(400, "id inválido")
    try:
        data = _container().download_blob(blob_name).readall()
    except Exception:
        raise HTTPException(404, "comunicación no encontrada")
    return Response(content=data, media_type="message/rfc822")
