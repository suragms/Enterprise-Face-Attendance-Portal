from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.exams.views import ExamScheduleViewSet

router = DefaultRouter()
router.register("", ExamScheduleViewSet, basename="exam-schedule")

urlpatterns = [path("", include(router.urls))]
