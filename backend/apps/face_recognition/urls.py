from django.urls import path
from .views import FaceAnalyzeView, FaceAuditEventsView, FaceDetectView, FaceIdentifyView, FaceLoginView, FaceRegisterView, FaceVerifyView

urlpatterns = [
    path('register/', FaceRegisterView.as_view(), name='face-register'),
    path('enroll-multi/', FaceRegisterView.as_view(), name='face-enroll-multi'),
    path('verify/', FaceVerifyView.as_view(), name='face-verify'),
    path('verify-multi/', FaceVerifyView.as_view(), name='face-verify-multi'),
    path('identify/', FaceIdentifyView.as_view(), name='face-identify'),
    path('login/', FaceLoginView.as_view(), name='face-login'),
    path('detect/', FaceDetectView.as_view(), name='face-detect'),
    path('analyze/', FaceAnalyzeView.as_view(), name='face-analyze'),
    path('audit-events/', FaceAuditEventsView.as_view(), name='face-audit-events'),
]
