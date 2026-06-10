# config module init
try:
    from .celery import app as celery_app
except ImportError:
    celery_app = None

__all__ = ("celery_app",)
