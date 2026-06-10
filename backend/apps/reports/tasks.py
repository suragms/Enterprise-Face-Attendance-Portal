try:
    from celery import shared_task
    from celery.result import AsyncResult
except ImportError:
    class _ImmediateResult:
        id = "celery-not-installed"

    class _ImmediateTask:
        def __init__(self, fn):
            self.fn = fn
            self.id = _ImmediateResult.id

        def __call__(self, *args, **kwargs):
            return self.fn(self, *args, **kwargs)

        def delay(self, *args, **kwargs):
            result = self.fn(None, *args, **kwargs)
            immediate = _ImmediateResult()
            immediate._result = result
            return immediate

    def shared_task(*dargs, **dkwargs):
        def decorator(fn):
            return _ImmediateTask(fn)
        return decorator

    class AsyncResult:
        def __init__(self, task_id):
            self.id = task_id
            self.state = "SUCCESS"
            self.result = getattr(_ImmediateResult, "_result", None)

import base64

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.reports.enterprise_service import EnterpriseReportService
from apps.reports.filters import parse_report_filters
from apps.reports.models import ReportHistory

User = get_user_model()


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def generate_report_export(
    self,
    organization_id,
    export_format,
    report_type="daily",
    filters=None,
    history_id=None,
    user_id=None,
):
    history = None
    if history_id:
        history = ReportHistory.objects.filter(id=history_id).first()
        if history:
            history.status = ReportHistory.Status.PROCESSING
            history.save(update_fields=["status", "updated_at"])

    user = User.objects.filter(id=user_id).first() if user_id else None
    if user and user.active_organization_id:
        service = EnterpriseReportService(user)
    else:
        user = User.objects.filter(active_organization_id=organization_id).first()
        service = EnterpriseReportService(user) if user else None

    try:
        if not service or not service.organization:
            raise RuntimeError("Unable to resolve organization for export.")
        parsed = parse_report_filters(filters or {})
        payload = service.export_payload(report_type, export_format, parsed)
        result = {
            "organization_id": organization_id,
            "format": export_format,
            "report_type": report_type,
            "filename": payload["filename"],
            "content_type": payload["content_type"],
            "content_base64": base64.b64encode(payload["bytes"]).decode("utf-8"),
            "status": "completed",
            "history_id": history_id,
        }
        if history:
            history.status = ReportHistory.Status.COMPLETED
            history.completed_at = timezone.now()
            history.file_size_bytes = len(payload["bytes"])
            history.storage_path = payload["filename"]
            history.save(
                update_fields=["status", "completed_at", "file_size_bytes", "storage_path", "updated_at"]
            )
        return result
    except Exception as exc:
        if history:
            history.status = ReportHistory.Status.FAILED
            history.error_message = str(exc)
            history.save(update_fields=["status", "error_message", "updated_at"])
        raise
