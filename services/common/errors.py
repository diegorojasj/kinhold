from typing import Any


class ApiError(Exception):
    """Every error leaves the API as `{code, message, details}` with this HTTP status."""

    def __init__(self, status: int, code: str, message: str, details: Any = None) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details
