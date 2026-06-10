from django.core.cache import cache


def clear_reports_cache(organization_id=None):
    """Invalidate report caches. Falls back to full clear when org-specific keys unknown."""
    if organization_id is None:
        cache.clear()
        return
    for prefix in ("reports:department", "analytics:trends"):
        cache.delete(f"{prefix}:v2:{organization_id}")
        cache.delete(f"{prefix}:{organization_id}")
