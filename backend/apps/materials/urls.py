from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.materials.views import StudyMaterialViewSet
from apps.materials.lms_views import LmsHubView

router = DefaultRouter()
router.register("", StudyMaterialViewSet, basename="study-material")

urlpatterns = [
    path("hub/", LmsHubView.as_view(), name="lms-hub"),
    path("", include(router.urls)),
]
