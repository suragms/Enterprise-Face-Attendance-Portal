from django.contrib import admin
from django.urls import path, include

from apps.core.views_enterprise import (
    EnterpriseSystemInfoAuthenticatedView,
    EnterpriseSystemInfoView,
    PublicHealthView,
)

urlpatterns = [
    path('healthz/', PublicHealthView.as_view(), name='healthz'),
    path('api/v1/system/info/', EnterpriseSystemInfoView.as_view(), name='enterprise-system-info'),
    path('api/v1/system/me/', EnterpriseSystemInfoAuthenticatedView.as_view(), name='enterprise-system-me'),
    path('api/system/info/', EnterpriseSystemInfoView.as_view(), name='enterprise-system-info-legacy'),
    path('admin/', admin.site.urls),
    
    # API v1 routes
    path('api/v1/auth/', include('apps.authentication.urls')),
    path('api/v1/', include('apps.organizations.urls')),
    path('api/v1/students/', include('apps.students.urls')),
    path('api/v1/staff/', include('apps.staff.urls')),
    path('api/v1/faculty/', include('apps.staff.urls')),
    path('api/v1/subjects/', include('apps.subjects.urls')),
    path('api/v1/timetable/', include('apps.timetable.urls')),
    path('api/v1/attendance/', include('apps.attendance.urls')),
    path('api/v1/reports/', include('apps.reports.urls')),
    path('api/v1/notifications/', include('apps.notifications.urls')),
    path('api/v1/face-recognition/', include('apps.face_recognition.urls')),
    path('api/v1/materials/', include('apps.materials.urls')),
    path('api/v1/exams/', include('apps.exams.urls')),

    # Backward-compatible API aliases
    path('api/auth/', include('apps.authentication.urls')),
    path('api/', include('apps.organizations.urls')),
    path('api/students/', include('apps.students.urls')),
    path('api/staff/', include('apps.staff.urls')),
    path('api/faculty/', include('apps.staff.urls')),
    path('api/subjects/', include('apps.subjects.urls')),
    path('api/timetable/', include('apps.timetable.urls')),
    path('api/attendance/', include('apps.attendance.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
    path('api/face-recognition/', include('apps.face_recognition.urls')),
    path('api/materials/', include('apps.materials.urls')),
    path('api/exams/', include('apps.exams.urls')),
]
