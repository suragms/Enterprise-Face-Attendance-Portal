from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.faculty_scoping import is_faculty_user, resolve_faculty_profile
from apps.core.permissions import IsBranchAdminOrAbove, IsFacultyOrAbove
from apps.core.student_scoping import is_student_user
from apps.core.viewsets import TenantScopedModelViewSet
from apps.notifications.models import Notification, NotificationSchedule, NotificationTemplate
from apps.notifications.scheduling import compute_next_run, run_schedule
from apps.notifications.serializers import (
    BulkRetrySerializer,
    NotificationLogSerializer,
    NotificationScheduleSerializer,
    NotificationTemplateSerializer,
    TriggerNotificationSerializer,
)
from apps.notifications.services import get_notification_meta, render_template
from apps.notifications.tasks import dispatch_notification_task

User = get_user_model()


class NotificationMetaView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsBranchAdminOrAbove]

    def get(self, request):
        org = request.user.active_organization
        pending = Notification.objects.filter(
            organization=org, status=Notification.StatusChoices.PENDING, is_deleted=False
        ).count()
        failed = Notification.objects.filter(
            organization=org, status=Notification.StatusChoices.FAILED, is_deleted=False
        ).count()
        return Response({**get_notification_meta(), "stats": {"pending": pending, "failed": failed}})


class NotificationTemplateViewSet(TenantScopedModelViewSet):
    queryset = NotificationTemplate.objects.all().order_by("trigger_type", "channel")
    serializer_class = NotificationTemplateSerializer
    permission_classes = [permissions.IsAuthenticated, IsBranchAdminOrAbove]


class NotificationScheduleViewSet(TenantScopedModelViewSet):
    queryset = NotificationSchedule.objects.all().order_by("-created_at")
    serializer_class = NotificationScheduleSerializer
    permission_classes = [permissions.IsAuthenticated, IsBranchAdminOrAbove]

    def perform_create(self, serializer):
        schedule = serializer.save(
            organization=self.request.user.active_organization,
            created_by=self.request.user,
            updated_by=self.request.user,
            next_run_at=serializer.validated_data.get("scheduled_at") or timezone.now(),
        )
        return schedule

    @action(detail=True, methods=["post"], url_path="run-now")
    def run_now(self, request, pk=None):
        schedule = self.get_object()
        run_schedule(schedule)
        return Response(self.get_serializer(schedule).data)

    @action(detail=True, methods=["post"], url_path="pause")
    def pause(self, request, pk=None):
        schedule = self.get_object()
        schedule.is_active = False
        schedule.save(update_fields=["is_active", "updated_at"])
        return Response(self.get_serializer(schedule).data)


class NotificationLogViewSet(TenantScopedModelViewSet):
    queryset = Notification.objects.all().order_by("-created_at")
    serializer_class = NotificationLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "patch", "post", "head", "options"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if is_student_user(self.request.user):
            return queryset.filter(user=self.request.user)
        role = getattr(self.request.user, "role", "")
        if role not in ("SUPER_ADMIN", "PLATFORM_SUPER_ADMIN", "ORGANIZATION_ADMIN", "BRANCH_ADMIN", "HOD"):
            return queryset.none()
        params = self.request.query_params
        if params.get("status"):
            queryset = queryset.filter(status=params["status"])
        if params.get("channel"):
            queryset = queryset.filter(channel=params["channel"])
        if params.get("trigger_type"):
            queryset = queryset.filter(trigger_type=params["trigger_type"])
        if params.get("search"):
            query = params["search"]
            queryset = queryset.filter(
                Q(recipient__icontains=query)
                | Q(message_body__icontains=query)
                | Q(subject__icontains=query)
            )
        return queryset

    def get_permissions(self):
        if self.action in ["retry", "bulk_retry"]:
            return [permissions.IsAuthenticated(), IsBranchAdminOrAbove()]
        return [permissions.IsAuthenticated()]

    @action(detail=True, methods=["patch"], url_path="read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        if is_student_user(request.user) and notification.user_id != request.user.id:
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)
        notification.status = Notification.StatusChoices.READ
        notification.read_at = timezone.now()
        notification.save(update_fields=["status", "read_at", "updated_at"])
        return Response(self.get_serializer(notification).data)

    @action(detail=True, methods=["post"], url_path="retry")
    def retry(self, request, pk=None):
        notification = self.get_object()
        notification.status = Notification.StatusChoices.PENDING
        notification.error_message = ""
        notification.save(update_fields=["status", "error_message", "updated_at"])
        dispatch_notification_task.delay(str(notification.id))
        return Response(self.get_serializer(notification).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=["post"], url_path="bulk-retry")
    def bulk_retry(self, request):
        serializer = BulkRetrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        queryset = self.get_queryset()
        if serializer.validated_data.get("notification_ids"):
            queryset = queryset.filter(id__in=serializer.validated_data["notification_ids"])
        elif serializer.validated_data.get("failed_only", True):
            queryset = queryset.filter(status=Notification.StatusChoices.FAILED)
        count = 0
        for notification in queryset[:100]:
            notification.status = Notification.StatusChoices.PENDING
            notification.error_message = ""
            notification.save(update_fields=["status", "error_message", "updated_at"])
            dispatch_notification_task.delay(str(notification.id))
            count += 1
        return Response({"queued": count}, status=status.HTTP_202_ACCEPTED)


class TriggerNotificationAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsFacultyOrAbove]

    def post(self, request):
        serializer = TriggerNotificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        context = payload.get("context") or {}
        if not isinstance(context, dict):
            return Response({"detail": "context must be an object."}, status=status.HTTP_400_BAD_REQUEST)
        context = {**context, "organization": request.user.active_organization}
        trigger_type = payload["trigger_type"]
        channel = payload["channel"]
        target_user = None
        if payload.get("user_id"):
            target_user = User.objects.filter(
                id=payload["user_id"],
                memberships__organization=request.user.active_organization,
                memberships__is_active=True,
            ).first()
        elif channel == "IN_APP":
            target_user = User.objects.filter(id=payload["recipient"]).first() or User.objects.filter(
                email=payload["recipient"]
            ).first()
        if target_user:
            if is_faculty_user(request.user):
                profile = resolve_faculty_profile(request.user)
                if not profile:
                    return Response({"detail": "Faculty profile is not configured."}, status=status.HTTP_403_FORBIDDEN)
                allowed = target_user.memberships.filter(
                    organization=request.user.active_organization,
                    department=profile.department,
                    is_active=True,
                ).exists()
                if not allowed and target_user != request.user:
                    return Response(
                        {"detail": "Faculty can notify only users in their assigned department."},
                        status=status.HTTP_403_FORBIDDEN,
                    )
            context["user"] = target_user

        template = NotificationTemplate.objects.filter(
            organization=request.user.active_organization,
            trigger_type=trigger_type,
            channel=channel,
            is_active=True,
        ).first()
        try:
            if template:
                subject = render_template(template.subject, context) if channel in ("EMAIL", "IN_APP") else ""
                message_body = render_template(template.body_template, context)
            else:
                subject = payload.get("subject", "")
                message_body = payload.get("message_body", "") or render_template(
                    context.get("message_body", ""), context
                )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        notification = Notification.objects.create(
            organization=request.user.active_organization,
            user=target_user or request.user if channel == "IN_APP" else target_user,
            trigger_type=trigger_type,
            channel=channel,
            recipient=payload["recipient"],
            subject=subject,
            message_body=message_body,
            created_by=request.user,
            updated_by=request.user,
        )
        dispatch_notification_task.delay(str(notification.id))
        return Response(NotificationLogSerializer(notification).data, status=status.HTTP_202_ACCEPTED)
