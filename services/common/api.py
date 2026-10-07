from asgiref.sync import sync_to_async
from django.db import connection
from django.http import Http404, HttpRequest, HttpResponse
from ninja import NinjaAPI
from ninja.errors import AuthenticationError, HttpError
from ninja.errors import ValidationError as NinjaValidationError

from .errors import ApiError
from .events import valkey_ok


def create_api(service: str) -> NinjaAPI:
    """NinjaAPI with the shared error format and a /health endpoint."""
    api = NinjaAPI(title=f"Kinhold {service} service", urls_namespace=service)

    def error(request: HttpRequest, status: int, code: str, message: str, details: object = None) -> HttpResponse:
        return api.create_response(request, {"code": code, "message": message, "details": details}, status=status)

    @api.exception_handler(ApiError)
    def on_api_error(request: HttpRequest, exc: ApiError) -> HttpResponse:
        return error(request, exc.status, exc.code, exc.message, exc.details)

    @api.exception_handler(NinjaValidationError)
    def on_validation(request: HttpRequest, exc: NinjaValidationError) -> HttpResponse:
        return error(request, 422, "invalid", "The request is not valid.", exc.errors)

    @api.exception_handler(AuthenticationError)
    def on_auth(request: HttpRequest, exc: AuthenticationError) -> HttpResponse:  # noqa: ARG001
        return error(request, 401, "unauthorized", "Missing or invalid device token.")

    @api.exception_handler(HttpError)
    def on_http(request: HttpRequest, exc: HttpError) -> HttpResponse:
        return error(request, exc.status_code, "error", str(exc))

    @api.exception_handler(Http404)
    def on_404(request: HttpRequest, exc: Http404) -> HttpResponse:  # noqa: ARG001
        return error(request, 404, "not_found", "Not found.")

    @api.get("/health", auth=None, tags=["ops"])
    async def health(request: HttpRequest) -> HttpResponse:  # noqa: ARG001
        database = await _database_ok()
        live = await valkey_ok()
        # Valkey is optional (devices fall back to polling), the database is not.
        return HttpResponse(
            f'{{"service":"{service}","database":{str(database).lower()},"valkey":{str(live).lower()}}}',
            status=200 if database else 503,
            content_type="application/json",
        )

    return api


async def _database_ok() -> bool:
    def ping() -> bool:
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        except Exception:  # noqa: BLE001
            return False
        return True

    return await sync_to_async(ping)()
