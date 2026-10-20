"""FastAPI application factory for the OcularCheck AI service."""

from fastapi import FastAPI

from app.api import health


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    application = FastAPI(title="OcularCheck AI service")
    application.include_router(health.router)
    return application


app = create_app()
