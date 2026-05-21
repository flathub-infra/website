import json
from typing import Any

from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.responses import ORJSONResponse
from joserfc import jwk
from joserfc.errors import JoseError

from .. import config


def require_oidc_enabled():
    if not config.settings.oidc_enabled:
        raise HTTPException(status_code=404)


router = APIRouter(
    tags=["oidc"],
    default_response_class=ORJSONResponse,
    dependencies=[Depends(require_oidc_enabled)],
)


def register_to_app(app: FastAPI):
    app.include_router(router)


@router.get(
    "/.well-known/openid-configuration",
    responses={
        200: {"description": "OIDC discovery metadata"},
        404: {"description": "OIDC is disabled"},
    },
)
def openid_configuration():
    issuer = config.settings.oidc_issuer.rstrip("/")
    return {
        "issuer": issuer,
        "authorization_endpoint": f"{issuer}/oidc/authorize",
        "token_endpoint": f"{issuer}/oidc/token",
        "userinfo_endpoint": f"{issuer}/oidc/userinfo",
        "jwks_uri": f"{issuer}/oidc/jwks.json",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code"],
        "scopes_supported": ["openid", "profile", "email"],
        "token_endpoint_auth_methods_supported": [
            "client_secret_basic",
            "client_secret_post",
        ],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": ["RS256"],
    }


@router.get(
    "/oidc/jwks.json",
    responses={
        200: {"description": "OIDC JSON Web Key Set"},
        404: {"description": "OIDC is disabled"},
        500: {"description": "OIDC JWKS is not configured"},
    },
)
def jwks():
    if config.settings.oidc_private_jwks is None:
        raise HTTPException(status_code=500, detail="OIDC JWKS is not configured")

    try:
        private_jwks = json.loads(config.settings.oidc_private_jwks)
        key_set = jwk.KeySet.import_key_set(private_jwks)
    except (json.JSONDecodeError, KeyError, TypeError, JoseError) as e:
        raise HTTPException(status_code=500, detail="OIDC JWKS is invalid") from e

    keys: list[dict[str, Any]] = []
    for key in key_set:
        if key.key_type != "RSA":
            raise HTTPException(status_code=500, detail="OIDC JWKS is invalid")
        keys.append(key.as_dict(private=False))

    return {"keys": keys}
