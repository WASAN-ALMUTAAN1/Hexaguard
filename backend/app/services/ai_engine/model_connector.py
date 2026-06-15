"""
Compatibility wrapper.

The platform now uses app.services.ai_engine.connectors as the canonical
provider-adapter layer. This file remains only so older imports keep working.
"""

from app.services.ai_engine.connectors import get_model_connector

__all__ = ["get_model_connector"]
