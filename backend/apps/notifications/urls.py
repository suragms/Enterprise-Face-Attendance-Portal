from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    NotificationLogViewSet,
    NotificationMetaView,
    NotificationScheduleViewSet,
    NotificationTemplateViewSet,
    TriggerNotificationAPIView,
)

router = DefaultRouter()
router.register("templates", NotificationTemplateViewSet, basename="notification_template")
router.register("schedules", NotificationScheduleViewSet, basename="notification_schedule")
router.register("logs", NotificationLogViewSet, basename="notification_log")

urlpatterns = [
    path("meta/", NotificationMetaView.as_view(), name="notification_meta"),
    path("trigger/", TriggerNotificationAPIView.as_view(), name="notification_trigger"),
    path("", include(router.urls)),
]
