"""
Settings shared by every service. A service's config/settings.py does `from common.settings import *`,
sets DB_SCHEMA, and appends its own app to INSTALLED_APPS.
"""

import os


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-only-insecure-key")
DEBUG = env("DJANGO_DEBUG", "0") == "1"
# Services sit on the internal network; only the gateway can reach them.
ALLOWED_HOSTS = ["*"]

# The gateway adds this header to every request it forwards; services reject requests without it.
GATEWAY_SECRET = env("GATEWAY_SECRET", "dev-gateway-secret")
VALKEY_URL = env("VALKEY_URL", "valkey://localhost:6379/0")

ROOT_URLCONF = "config.urls"
ASGI_APPLICATION = "config.asgi.application"
INSTALLED_APPS: list[str] = ["common"]
MIDDLEWARE = ["django.middleware.common.CommonMiddleware"]
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# D-10: everything stored in UTC; the household timezone is a display concern.
USE_TZ = True
TIME_ZONE = "UTC"
USE_I18N = False

DB_SCHEMA = "public"


def database(schema: str) -> dict[str, dict[str, object]]:
    """One Postgres database for the whole app, one schema per service (search_path)."""
    name = env("DB_NAME", "kinhold")
    return {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": name,
            "USER": env("DB_USER", "kinAdmin"),
            "PASSWORD": env("DB_PASSWORD"),
            "HOST": env("DB_HOST", "localhost"),
            "PORT": env("DB_PORT", "5432"),
            "OPTIONS": {"options": f"-c search_path={schema}"},
            # Separate test databases so services can run their tests in parallel.
            "TEST": {"NAME": f"test_{name}_{schema}"},
        }
    }


LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", "INFO")},
}
