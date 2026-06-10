try:
    from celery import shared_task
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


from apps.notifications.models import Notification
from apps.notifications.services import deliver_notification, retry_notification


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def dispatch_notification_task(self, notification_id):
    notification = Notification.objects.get(id=notification_id)
    if notification.status == Notification.StatusChoices.SENT:
        return {"notification_id": notification_id, "status": notification.status}
    if notification.retry_count > 0:
        retry_notification(notification)
    else:
        deliver_notification(notification)
    notification.refresh_from_db()
    if notification.status == Notification.StatusChoices.FAILED and notification.retry_count < 3:
        raise Exception(notification.error_message or "Dispatch failed")
    return {"notification_id": notification_id, "status": notification.status}


@shared_task
def process_scheduled_notifications_task():
    from apps.notifications.scheduling import process_due_schedules

    return {"processed": process_due_schedules()}


@shared_task
def trigger_absent_alert_task(attendance_record_id):
    from apps.notifications.services import trigger_absent_alert

    logs = trigger_absent_alert(attendance_record_id)
    return {"count": len(logs)}
