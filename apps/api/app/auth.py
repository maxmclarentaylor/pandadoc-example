"""Validate Entra ID access tokens (standard JWT + JWKS pattern)."""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

_bearer = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def _settings() -> dict[str, Any]:
    tenant_id = os.getenv("AZURE_TENANT_ID", "").strip()
    api_client_id = os.getenv("AZURE_API_CLIENT_ID", "").strip()
    audience = os.getenv("AZURE_API_AUDIENCE", "").strip()
    if not audience and api_client_id:
        audience = f"api://{api_client_id}"

    audiences = [a for a in (audience, api_client_id, f"api://{api_client_id}" if api_client_id else "") if a]
    # de-dupe
    audiences = list(dict.fromkeys(audiences))

    return {
        "tenant_id": tenant_id,
        "audiences": audiences,
        "issuer": f"https://login.microsoftonline.com/{tenant_id}/v2.0",
        "jwks_uri": f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys",
    }


@lru_cache(maxsize=1)
def _jwks_client(jwks_uri: str) -> PyJWKClient:
    return PyJWKClient(jwks_uri, cache_keys=True)


def require_entra_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict[str, Any]:
    """Decode + verify a Bearer access token from Entra ID."""
    cfg = _settings()
    if not cfg["tenant_id"] or not cfg["audiences"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth not configured (set AZURE_TENANT_ID and AZURE_API_CLIENT_ID)",
        )

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        key = _jwks_client(cfg["jwks_uri"]).get_signing_key_from_jwt(credentials.credentials)
        claims = jwt.decode(
            credentials.credentials,
            key.key,
            algorithms=["RS256"],
            audience=cfg["audiences"],
            issuer=cfg["issuer"],
            options={"require": ["exp", "iss", "aud"]},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    return claims
