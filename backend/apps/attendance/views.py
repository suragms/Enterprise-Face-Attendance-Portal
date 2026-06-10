from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsFacultyOnlyUser, IsHODUser
from apps.attendance.engine import (
    create_session_from_payload,
    normalize_entries,
    resolve_or_create_session,
    session_is_writable,
    upsert_records,
    validate_session,
)
from apps.attendance.models import AttendanceCorrection, AttendanceRecord, AttendanceSession
from apps.attendance.serializers import (
    AttendanceCorrectionSerializer,
    AttendanceRecordSerializer,
    AttendanceSessionSerializer,
)
from apps.core.permissions import IsFacultyOrAbove
from apps.core.viewsets import TenantScopedModelViewSet
from apps.core.faculty_scoping import (
    is_faculty_user,
    scope_attendance_records_for_faculty,
    scope_attendance_sessions_for_faculty,
)
from apps.core.student_scoping import is_student_user, scope_queryset_for_student
from apps.organizations.models import AuditLog


class AttendanceSessionViewSet(TenantScopedModelViewSet):
    queryset = AttendanceSession.objects.select_related(
        "organization", "branch", "department", "semester", "subject", "opened_by"
    )
    serializer_class = AttendanceSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ["approve_session", "reject_session", "lock_session", "unlock_session"]:
            return [permissions.IsAuthenticated(), IsHODUser()]
        if self.action in ["submit_session", "open_session", "create_session"]:
            return [permissions.IsAuthenticated(), IsFacultyOrAbove()]
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), IsFacultyOrAbove()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = super().get_queryset()
        subject = self.request.query_params.get("subject")
        if subject:
            queryset = (
                queryset.filter(subject_id=subject)
                if len(subject) == 36
                else queryset.filter(subject__subject_code=subject)
            )
        for field in ["date", "hour", "branch", "department", "semester", "session_status"]:
            value = self.request.query_params.get(field)
            if value not in (None, ""):
                queryset = queryset.filter(**{field: value})
        queryset = scope_attendance_sessions_for_faculty(queryset, self.request.user)
        if is_student_user(self.request.user):
            queryset = scope_queryset_for_student(queryset, self.request.user)
        return queryset.order_by("-date", "hour")

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.user.active_organization,
            opened_by=self.request.user,
            session_status=AttendanceSession.SessionStatus.OPEN,
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    @action(detail=False, methods=["post"], url_path="create-session")
    def create_session(self, request):
        """Explicitly create an OPEN session for date/hour/subject."""
        try:
            session = create_session_from_payload(request)
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="open")
    def open_session(self, request, pk=None):
        """Re-open a REJECTED session for faculty edits."""
        with transaction.atomic():
            session = AttendanceSession.objects.select_for_update().get(
                id=pk, organization=request.user.active_organization
            )
            if session.session_status != AttendanceSession.SessionStatus.REJECTED:
                return Response(
                    {"detail": "Only REJECTED sessions can be reopened."},
                    status=status.HTTP_409_CONFLICT,
                )
            session.session_status = AttendanceSession.SessionStatus.OPEN
            session.submitted_at = None
            session.approved_at = None
            session.updated_by = request.user
            session.save(
                update_fields=[
                    "session_status",
                    "submitted_at",
                    "approved_at",
                    "updated_by",
                    "updated_at",
                ]
            )
        return Response(self.get_serializer(session).data)

    @action(detail=True, methods=["post"], url_path="submit")
    def submit_session(self, request, pk=None):
        with transaction.atomic():
            session = AttendanceSession.objects.select_for_update().get(
                id=pk, organization=request.user.active_organization
            )
            if session.session_status not in (
                AttendanceSession.SessionStatus.OPEN,
                AttendanceSession.SessionStatus.REJECTED,
            ):
                return Response(
                    {"detail": "Only OPEN or REJECTED sessions can be submitted."},
                    status=status.HTTP_409_CONFLICT,
                )
            validation = validate_session(session)
            if not validation["is_valid"]:
                return Response(
                    {
                        "detail": "Session failed validation. Resolve issues before submitting.",
                        "validation": validation,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            session.session_status = AttendanceSession.SessionStatus.SUBMITTED
            session.submitted_at = timezone.now()
            session.updated_by = request.user
            session.save(update_fields=["session_status", "submitted_at", "updated_by", "updated_at"])
        return Response(self.get_serializer(session).data)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve_session(self, request, pk=None):
        with transaction.atomic():
            session = AttendanceSession.objects.select_for_update().get(
                id=pk, organization=request.user.active_organization
            )
            if session.session_status != AttendanceSession.SessionStatus.SUBMITTED:
                return Response(
                    {"detail": "Only SUBMITTED sessions can be approved."},
                    status=status.HTTP_409_CONFLICT,
                )
            session.session_status = AttendanceSession.SessionStatus.APPROVED
            session.approved_at = timezone.now()
            session.updated_by = request.user
            session.save(update_fields=["session_status", "approved_at", "updated_by", "updated_at"])
        return Response(self.get_serializer(session).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject_session(self, request, pk=None):
        with transaction.atomic():
            session = AttendanceSession.objects.select_for_update().get(
                id=pk, organization=request.user.active_organization
            )
            if session.session_status not in [
                AttendanceSession.SessionStatus.SUBMITTED,
                AttendanceSession.SessionStatus.APPROVED,
            ]:
                return Response(
                    {"detail": "Only SUBMITTED or APPROVED sessions can be rejected."},
                    status=status.HTTP_409_CONFLICT,
                )
            session.session_status = AttendanceSession.SessionStatus.REJECTED
            session.updated_by = request.user
            session.save(update_fields=["session_status", "updated_by", "updated_at"])
        return Response(self.get_serializer(session).data)

    @action(detail=True, methods=["post"], url_path="lock")
    def lock_session(self, request, pk=None):
        with transaction.atomic():
            session = AttendanceSession.objects.select_for_update().get(
                id=pk, organization=request.user.active_organization
            )
            if session.session_status != AttendanceSession.SessionStatus.APPROVED:
                return Response(
                    {"detail": "Only APPROVED sessions can be locked."},
                    status=status.HTTP_409_CONFLICT,
                )
            session.session_status = AttendanceSession.SessionStatus.LOCKED
            session.updated_by = request.user
            session.save(update_fields=["session_status", "updated_by", "updated_at"])
        return Response(self.get_serializer(session).data)

    @action(detail=True, methods=["post"], url_path="unlock")
    def unlock_session(self, request, pk=None):
        with transaction.atomic():
            session = AttendanceSession.objects.select_for_update().get(
                id=pk, organization=request.user.active_organization
            )
            if session.session_status != AttendanceSession.SessionStatus.LOCKED:
                return Response(
                    {"detail": "Only LOCKED sessions can be unlocked."},
                    status=status.HTTP_409_CONFLICT,
                )
            session.session_status = AttendanceSession.SessionStatus.APPROVED
            session.updated_by = request.user
            session.save(update_fields=["session_status", "updated_by", "updated_at"])
        return Response(self.get_serializer(session).data)


class AttendanceRecordViewSet(TenantScopedModelViewSet):
    queryset = AttendanceRecord.objects.select_related("organization", "session", "student")
    serializer_class = AttendanceRecordSerializer
    permission_classes = [permissions.IsAuthenticated, IsFacultyOrAbove]

    def get_queryset(self):
        queryset = super().get_queryset()
        return scope_attendance_records_for_faculty(queryset, self.request.user)


class _BaseEngineAttendanceView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsFacultyOrAbove]
    capture_method = AttendanceRecord.CaptureMethodChoices.MANUAL
    require_override_reason = False

    @transaction.atomic
    def post(self, request):
        override_reason = str(request.data.get("override_reason", "")).strip()
        if self.require_override_reason and not override_reason:
            return Response(
                {"detail": "override_reason is required for manual attendance verification."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            session = resolve_or_create_session(request)
        except IntegrityError:
            return Response(
                {"detail": "Concurrent session conflict. Please retry."},
                status=status.HTTP_409_CONFLICT,
            )
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        if not session_is_writable(session):
            return Response(
                {"detail": f"Session is {session.session_status} and cannot be modified."},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            entries = normalize_entries(request, session, request.data.get("entries", []))
            upserted = upsert_records(
                session,
                entries,
                user=request.user,
                capture_method=self.capture_method,
                override_reason=override_reason,
            )
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
        except IntegrityError:
            return Response(
                {"detail": "Concurrent attendance update conflict. Please retry."},
                status=status.HTTP_409_CONFLICT,
            )

        if self.capture_method == AttendanceRecord.CaptureMethodChoices.MANUAL:
            for entry in entries:
                AuditLog.objects.create(
                    organization=session.organization,
                    actor=request.user,
                    action="attendance.manual_override",
                    entity_type="AttendanceSession",
                    entity_id=session.id,
                    metadata={
                        "session_id": str(session.id),
                        "student_id": str(entry["student"].id),
                        "status": entry["status"],
                        "override_reason": override_reason,
                    },
                )

        return Response(
            {
                "message": f"{self.capture_method.label} attendance posted.",
                "session_id": str(session.id),
                "upserted": upserted,
            },
            status=status.HTTP_201_CREATED,
        )


class ManualAttendanceView(_BaseEngineAttendanceView):
    capture_method = AttendanceRecord.CaptureMethodChoices.MANUAL
    require_override_reason = True


class AutomaticAttendanceView(_BaseEngineAttendanceView):
    capture_method = AttendanceRecord.CaptureMethodChoices.FACE_RECOGNITION


class SystemAttendanceView(_BaseEngineAttendanceView):
    capture_method = AttendanceRecord.CaptureMethodChoices.SYSTEM
    require_override_reason = False


class AttendanceValidationView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsFacultyOrAbove]

    def post(self, request):
        session_id = request.data.get("session_id")
        if not session_id:
            return Response({"detail": "session_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            session = AttendanceSession.objects.get(
                id=session_id,
                organization=request.user.active_organization,
            )
        except AttendanceSession.DoesNotExist:
            return Response({"detail": "Session not found."}, status=status.HTTP_404_NOT_FOUND)
        validation = validate_session(session)
        return Response({"session_id": str(session.id), "validation": validation})


class AttendanceCorrectionView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsFacultyOrAbove]

    def post(self, request):
        serializer = AttendanceCorrectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record_qs = AttendanceRecord.objects.select_related("session", "session__subject").filter(
            id=serializer.validated_data["record_id"],
            organization=request.user.active_organization,
        )
        if is_faculty_user(request.user):
            record_qs = scope_attendance_records_for_faculty(record_qs, request.user)
        record = record_qs.get()
        if record.session.session_status == AttendanceSession.SessionStatus.LOCKED:
            return Response(
                {"detail": "Locked sessions cannot be corrected."},
                status=status.HTTP_409_CONFLICT,
            )
        if record.session.session_status == AttendanceSession.SessionStatus.SUBMITTED:
            return Response(
                {"detail": "Submitted sessions must be rejected before corrections."},
                status=status.HTTP_409_CONFLICT,
            )
        original = record.status
        record.original_status = original
        record.status = serializer.validated_data["new_status"]
        record.correction_notes = serializer.validated_data["correction_notes"]
        record.corrected_at = timezone.now()
        record.updated_by = request.user
        record.save()
        AttendanceCorrection.objects.create(
            record=record,
            original_status=original,
            new_status=record.status,
            correction_note=record.correction_notes,
            user=request.user,
            created_by=request.user,
            updated_by=request.user,
        )
        return Response(AttendanceRecordSerializer(record).data)


class AttendanceHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queryset = AttendanceRecord.objects.filter(
            organization=request.user.active_organization
        ).select_related("session", "session__subject", "student")
        if request.user.is_student:
            queryset = queryset.filter(student__user=request.user)
        if request.query_params.get("start_date") and request.query_params.get("end_date"):
            queryset = queryset.filter(
                session__date__range=[
                    request.query_params["start_date"],
                    request.query_params["end_date"],
                ]
            )
        payload = [
            {
                "id": str(record.id),
                "date": record.session.date,
                "hour": record.session.hour,
                "subject": record.session.subject.subject_code,
                "status": record.status,
                "capture_method": record.capture_method,
                "captured_at": record.captured_at,
                "student_roll_no": record.student.roll_no,
                "student_id": str(record.student_id),
                "confidence_score": record.confidence_score,
                "device": (record.metadata or {}).get("device"),
                "ip_address": (record.metadata or {}).get("ip_address"),
                "metadata": record.metadata,
            }
            for record in queryset.order_by("-session__date", "-captured_at")[:500]
        ]
        return Response({"count": len(payload), "results": payload})
