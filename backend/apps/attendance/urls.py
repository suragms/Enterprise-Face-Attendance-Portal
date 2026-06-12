from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AttendanceSessionViewSet,
    AttendanceRecordViewSet,
    AttendanceHistoryView,
    ManualAttendanceView,
    AutomaticAttendanceView,
    SystemAttendanceView,
    AttendanceValidationView,
    AttendanceCorrectionView,
    StudentSelfCheckInView,
    ExternalBiometricDeviceSyncView,
)

router = DefaultRouter()
router.register(r'sessions', AttendanceSessionViewSet)
router.register(r'records', AttendanceRecordViewSet)

urlpatterns = [
    path('', include(router.urls)),
    
    # Attendance Engine Endpoints
    path('engine/manual/', ManualAttendanceView.as_view(), name='engine-manual'),
    path('engine/automatic/', AutomaticAttendanceView.as_view(), name='engine-automatic'),
    path('engine/system/', SystemAttendanceView.as_view(), name='engine-system'),
    path('engine/validate/', AttendanceValidationView.as_view(), name='engine-validate'),
    path('engine/correct/', AttendanceCorrectionView.as_view(), name='engine-correct'),
    path('engine/self-checkin/', StudentSelfCheckInView.as_view(), name='engine-self-checkin'),
    path('engine/device-sync/', ExternalBiometricDeviceSyncView.as_view(), name='engine-device-sync'),
    path('history/', AttendanceHistoryView.as_view(), name='attendance-history'),
]
