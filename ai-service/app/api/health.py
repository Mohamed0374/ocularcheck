"""Health API router."""

from fastapi import APIRouter
from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Response body of the health endpoint."""

    status: str
    service: str


router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def read_health() -> HealthResponse:
    """Return the service health payload."""
    return HealthResponse(status="ok", service="ocularcheck-ai")
