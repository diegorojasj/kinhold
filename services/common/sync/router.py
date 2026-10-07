from collections.abc import Sequence

from asgiref.sync import sync_to_async
from django.http import HttpRequest
from ninja import Query, Router
from pydantic import BaseModel, Field

from ..auth import GatewayAuth, member_of
from ..events import publish_change
from .collection import Collection
from .engine import apply_ops, pull_changes
from .schemas import PullOut, PushIn, PushOut


class PullParams(BaseModel):
    since: int = Field(default=0, ge=0)
    limit: int = Field(default=500, ge=1, le=1000)


def sync_router(service: str, collections: Sequence[Collection]) -> Router:
    """`GET/POST /households/{id}/sync`: pull changes since a cursor, push a batch of offline ops."""
    by_name = {c.name: c for c in collections}
    router = Router(tags=["sync"], auth=GatewayAuth())

    @router.get("/households/{household_id}/sync", response=PullOut, by_alias=True)
    async def pull(request: HttpRequest, household_id: str, params: Query[PullParams]) -> PullOut:
        member_of(request, household_id)
        return await sync_to_async(pull_changes)(by_name, household_id, params.since, params.limit)

    @router.post("/households/{household_id}/sync", response=PushOut, by_alias=True)
    async def push(request: HttpRequest, household_id: str, body: PushIn) -> PushOut:
        actor = member_of(request, household_id)
        out, cursor = await sync_to_async(apply_ops)(by_name, actor, household_id, body.ops)
        if cursor is not None:
            await publish_change(household_id, service, cursor)
        return out

    return router
