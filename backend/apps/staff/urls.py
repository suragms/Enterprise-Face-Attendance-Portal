from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FacultyCreateAPIView, StaffProfileViewSet

router = DefaultRouter()
router.register(r'', StaffProfileViewSet)

urlpatterns = [
    path('create/', FacultyCreateAPIView.as_view(), name='faculty-create'),
    path('', include(router.urls)),
]
