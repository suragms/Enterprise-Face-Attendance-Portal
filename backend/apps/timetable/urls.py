from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TimetableEntryViewSet

router = DefaultRouter()
router.register(r'', TimetableEntryViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
