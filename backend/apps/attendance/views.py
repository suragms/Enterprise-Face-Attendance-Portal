from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsFacultyOnlyUser, IsHODUser
from apps.attendance.engine import (
    create_session_from_payload,
    enforce_face_entry,
    enforce_session_actor_access,
    enforce_session_timetable,
    normalize_entries,
    normalize_similarity,
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
from apps.core.hod_scoping import scope_queryset_for_hod
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
        session = serializer.save(
            organization=self.request.user.active_organization,
            opened_by=self.request.user,
            session_status=AttendanceSession.SessionStatus.OPEN,
            created_by=self.request.user,
            updated_by=self.request.user,
        )
        enforce_session_actor_access(session, self.request.user)
        enforce_session_timetable(session, self.request.user)

    def _session_for_action(self, pk):
        queryset = AttendanceSession.objects.select_for_update().filter(
            id=pk,
            organization=self.request.user.active_organization,
        ).select_related("subject", "department", "branch", "semester", "timetable")
        queryset = scope_attendance_sessions_for_faculty(queryset, self.request.user)
        queryset = scope_queryset_for_hod(queryset, self.request.user)
        try:
            return queryset.get()
        except AttendanceSession.DoesNotExist as exc:
            raise NotFound("Attendance session not found.") from exc

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
            session = self._session_for_action(pk)
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
            session = self._session_for_action(pk)
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
            session = self._session_for_action(pk)
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
            session = self._session_for_action(pk)
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
            session = self._session_for_action(pk)
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
            session = self._session_for_action(pk)
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


class StudentSelfCheckInView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        import math
        from django.utils import timezone
        from apps.students.models import Student
        from apps.face_recognition.models import FaceEnrollment, FaceAuditLog
        from apps.face_recognition.services import FaceRecognitionService
        from apps.attendance.engine import refresh_session_strength
        from apps.attendance.serializers import AttendanceRecordSerializer

        if getattr(request.user, "role", "") != "STUDENT":
            return Response({"error": "Only students are authorized to check-in via this portal."}, status=status.HTTP_403_FORBIDDEN)

        student = Student.objects.select_related("user", "branch", "department", "semester", "course").filter(
            user=request.user,
            is_active=True,
            is_deleted=False
        ).first()
        if not student:
            return Response({"error": "No active student profile found for this user."}, status=status.HTTP_404_NOT_FOUND)

        lat = request.data.get("latitude")
        lon = request.data.get("longitude")
        image = request.data.get("image")

        if lat is None or lon is None:
            return Response({"error": "Location coordinates are required for self check-in."}, status=status.HTTP_400_BAD_REQUEST)
        if not image:
            return Response({"error": "Webcam image snapshot is required for verification."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            student_lat = float(lat)
            student_lon = float(lon)
        except ValueError:
            return Response({"error": "Invalid coordinates format."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Geofence Distance Calculation using Haversine formula
        branch = student.branch
        if branch.latitude is None or branch.longitude is None:
            return Response({"error": "Geofencing coordinates are not configured for your branch. Please contact system admin."}, status=status.HTTP_400_BAD_REQUEST)

        # Haversine distance
        R = 6371.0
        dlat = math.radians(student_lat - branch.latitude)
        dlon = math.radians(student_lon - branch.longitude)
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(branch.latitude)) * math.cos(math.radians(student_lat)) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        distance = R * c * 1000  # distance in meters

        if distance > branch.geofence_radius:
            return Response({
                "error": f"Check-in failed. You are outside the allowed branch boundary by {distance - branch.geofence_radius:.1f} meters. (Distance: {distance:.1f}m, Limit: {branch.geofence_radius}m)"
            }, status=status.HTTP_400_BAD_REQUEST)

        # 2. Find Open Attendance Session
        today = timezone.localdate()
        sessions = AttendanceSession.objects.filter(
            organization=request.user.active_organization,
            branch=branch,
            department=student.department,
            semester=student.semester,
            date=today,
            session_status=AttendanceSession.SessionStatus.OPEN
        ).select_related("subject")

        if not sessions.exists():
            return Response({"error": "No active open attendance session was found for your class today."}, status=status.HTTP_404_NOT_FOUND)

        # Prioritize matching the current hour if possible
        now_time = timezone.localtime().time()
        from datetime import time
        def get_current_period_hour(t):
            if time(8, 30) <= t < time(9, 30): return "I"
            elif time(9, 30) <= t < time(10, 30): return "II"
            elif time(10, 30) <= t < time(11, 30): return "III"
            elif time(11, 30) <= t < time(12, 30): return "IV"
            elif time(13, 30) <= t < time(14, 30): return "V"
            elif time(14, 30) <= t < time(15, 30): return "VI"
            elif time(15, 30) <= t < time(16, 30): return "VII"
            return None

        current_hour = get_current_period_hour(now_time)
        session = None
        if current_hour:
            session = sessions.filter(hour=current_hour).first()
        if not session:
            session = sessions.first()
        try:
            enforce_session_timetable(session, request.user)
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        # 3. Biometric Verification
        enrollment = FaceEnrollment.objects.filter(
            organization=request.user.active_organization,
            student=student,
            is_active=True
        ).order_by("-created_at").first()

        if not enrollment:
            return Response({"error": "No active face biometric template found. Please enroll your face first."}, status=status.HTTP_400_BAD_REQUEST)

        face_service = FaceRecognitionService()
        liveness = face_service.verify_liveness(image)
        if not liveness.get("success") or not liveness.get("liveness"):
            FaceAuditLog.objects.create(
                organization=request.user.active_organization,
                actor=request.user,
                event=FaceAuditLog.Event.LIVENESS_FAILED,
                success=False,
                liveness_score=liveness.get("score", 0),
                metadata={"liveness_checks": liveness.get("checks", {}), "action": "self_checkin"}
            )
            return Response({"error": liveness.get("message") or "Liveness verification failed. Anti-spoofing triggered."}, status=status.HTTP_400_BAD_REQUEST)

        probe = face_service.encode_face(image)
        if not probe["success"]:
            return Response({"error": probe["message"]}, status=status.HTTP_400_BAD_REQUEST)

        pose_set = enrollment.pose_embeddings or {}
        if pose_set:
            match = face_service.verify_against_pose_set(pose_set, probe["encoding"], enrollment.confidence_threshold)
        else:
            match = face_service.compare_faces(enrollment.embedding, probe["encoding"], enrollment.confidence_threshold)

        if not match["match"]:
            FaceAuditLog.objects.create(
                organization=request.user.active_organization,
                actor=request.user,
                event=FaceAuditLog.Event.VERIFICATION,
                success=False,
                confidence=match["confidence"],
                liveness_score=liveness.get("score", 0),
                metadata={"action": "self_checkin", "detail": "Face verification mismatch"}
            )
            return Response({"error": "Biometric face verification failed. The captured face does not match your enrolled profile."}, status=status.HTTP_400_BAD_REQUEST)
        similarity = normalize_similarity(match.get("confidence"))
        if similarity is None or similarity < 0.65:
            FaceAuditLog.objects.create(
                organization=request.user.active_organization,
                actor=request.user,
                event=FaceAuditLog.Event.VERIFICATION,
                success=False,
                confidence=match.get("confidence", 0),
                liveness_score=liveness.get("score", 0),
                metadata={"action": "self_checkin", "detail": "Similarity below threshold", "threshold": 0.65}
            )
            return Response(
                {"error": "Face verification similarity is below the required threshold."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            enforce_face_entry({"student": student, "status": "PRESENT", "confidence_score": match["confidence"]})
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        # 4. Save Attendance Record
        metadata = {
            "self_service": True,
            "latitude": student_lat,
            "longitude": student_lon,
            "distance_meters": round(distance, 2),
            "ip_address": request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "")).split(",")[0].strip(),
            "user_agent": request.META.get("HTTP_USER_AGENT", "")
        }

        with transaction.atomic():
            existing_record = AttendanceRecord.objects.select_for_update().filter(
                organization=session.organization,
                session=session,
                student=student,
                is_deleted=False,
            ).first()
            if existing_record:
                return Response(
                    {"error": "Duplicate attendance is not allowed for this session."},
                    status=status.HTTP_409_CONFLICT,
                )
            record = AttendanceRecord.objects.create(
                organization=session.organization,
                session=session,
                student=student,
                status=AttendanceRecord.StatusChoices.PRESENT,
                capture_method=AttendanceRecord.CaptureMethodChoices.FACE_RECOGNITION,
                confidence_score=match["confidence"],
                captured_at=timezone.now(),
                created_by=request.user,
                updated_by=request.user,
                metadata=metadata,
            )
            refresh_session_strength(session)

        # Logging Audit Events
        FaceAuditLog.objects.create(
            organization=session.organization,
            actor=request.user,
            event=FaceAuditLog.Event.VERIFICATION,
            success=True,
            confidence=match["confidence"],
            liveness_score=liveness.get("score", 0),
            metadata={"action": "self_checkin", "record_id": str(record.id)}
        )

        AuditLog.objects.create(
            organization=session.organization,
            actor=request.user,
            action="attendance.self_checkin",
            entity_type="AttendanceRecord",
            entity_id=record.id,
            ip_address=metadata["ip_address"],
            user_agent=metadata["user_agent"],
            metadata=metadata
        )

        return Response({
            "success": True,
            "message": "Self check-in completed successfully!",
            "subject": session.subject.name,
            "subject_code": session.subject.subject_code,
            "hour": session.hour,
            "record": AttendanceRecordSerializer(record).data
        }, status=status.HTTP_200_OK)


class ExternalBiometricDeviceSyncView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsHODUser]

    def post(self, request):
        from django.utils import timezone
        from apps.students.models import Student
        from apps.timetable.models import Timetable
        from apps.attendance.engine import check_cross_subject_conflict, refresh_session_strength
        from apps.attendance.serializers import AttendanceRecordSerializer

        device_id = request.data.get("device_id")
        device_name = request.data.get("device_name", "External Terminal")
        logs = request.data.get("logs", [])

        if not device_id:
            return Response({"error": "device_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not logs:
            return Response({"error": "logs list is empty or missing."}, status=status.HTTP_400_BAD_REQUEST)

        synced_count = 0
        errors = []

        def map_time_to_period(dt):
            time_str = dt.strftime("%H:%M")
            if "08:30" <= time_str < "09:30": return "I"
            elif "09:30" <= time_str < "10:30": return "II"
            elif "10:30" <= time_str < "11:30": return "III"
            elif "11:30" <= time_str < "12:30": return "IV"
            elif "13:30" <= time_str < "14:30": return "V"
            elif "14:30" <= time_str < "15:30": return "VI"
            elif "15:30" <= time_str < "16:30": return "VII"
            
            h = dt.hour
            if h <= 9: return "I"
            elif h == 10: return "II"
            elif h == 11: return "III"
            elif h == 12: return "IV"
            elif h == 13 or h == 14: return "V"
            elif h == 15: return "VI"
            else: return "VII"

        for log in logs:
            roll_no = log.get("roll_no")
            timestamp_str = log.get("timestamp")
            status_val = log.get("status", "PRESENT")
            confidence = log.get("confidence_score")

            if not roll_no or not timestamp_str:
                errors.append(f"Log missing roll_no or timestamp: {log}")
                continue

            try:
                from django.utils.dateparse import parse_datetime
                dt = parse_datetime(timestamp_str)
                if not dt:
                    dt = timezone.now()
                else:
                    if timezone.is_naive(dt):
                        dt = timezone.make_aware(dt)
            except Exception as e:
                errors.append(f"Failed to parse timestamp {timestamp_str}: {str(e)}")
                continue

            student = Student.objects.filter(
                organization=request.user.active_organization,
                roll_no=roll_no,
                is_active=True,
                is_deleted=False
            ).select_related("department", "semester", "branch", "course").first()

            if not student:
                errors.append(f"Student {roll_no} not found.")
                continue

            date_val = dt.date()
            hour_val = map_time_to_period(dt)
            day_of_week = dt.strftime("%A").upper()

            hour_to_period_num = {
                "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7
            }
            period_num = hour_to_period_num.get(hour_val, 1)

            timetable_entry = Timetable.objects.filter(
                organization=request.user.active_organization,
                semester=student.semester,
                day=day_of_week,
                period=period_num,
                branch=student.branch,
                department=student.department,
                is_active=True,
                is_deleted=False
            ).select_related("subject").first()

            subject = timetable_entry.subject if timetable_entry else None

            if not subject:
                errors.append(f"No subject scheduled for student {roll_no} at {hour_val}.")
                continue
            try:
                enforce_face_entry({"student": student, "status": status_val, "confidence_score": confidence})
            except ValidationError as exc:
                errors.append(f"Face verification failed for {roll_no}: {exc.detail}")
                continue

            with transaction.atomic():
                session, _ = AttendanceSession.objects.get_or_create(
                    organization=request.user.active_organization,
                    date=date_val,
                    hour=hour_val,
                    subject=subject,
                    defaults={
                        "branch": student.branch,
                        "department": student.department,
                        "semester": student.semester,
                        "timetable": timetable_entry,
                        "session_status": AttendanceSession.SessionStatus.OPEN,
                        "opened_by": request.user,
                        "created_by": request.user,
                        "updated_by": request.user
                    }
                )

                try:
                    check_cross_subject_conflict(session, student)
                    enforce_session_timetable(session, request.user)
                except ValidationError:
                    errors.append(f"Attendance is not allowed for student {roll_no} in period {hour_val}.")
                    continue

                metadata = {
                    "synced_from_device": True,
                    "device_id": device_id,
                    "device_name": device_name,
                    "device_sync_timestamp": timestamp_str
                }

                existing = AttendanceRecord.objects.select_for_update().filter(
                    organization=session.organization,
                    session=session,
                    student=student,
                    is_deleted=False,
                ).first()
                if existing:
                    errors.append(f"Duplicate attendance ignored for student {roll_no} in period {hour_val}.")
                    continue
                record = AttendanceRecord.objects.create(
                    organization=session.organization,
                    session=session,
                    student=student,
                    status=status_val,
                    capture_method=AttendanceRecord.CaptureMethodChoices.FACE_RECOGNITION,
                    confidence_score=confidence,
                    captured_at=dt,
                    created_by=request.user,
                    updated_by=request.user,
                    metadata=metadata,
                )
                refresh_session_strength(session)
                synced_count += 1

        AuditLog.objects.create(
            organization=request.user.active_organization,
            actor=request.user,
            action="attendance.device_sync",
            entity_type="ExternalBiometricDevice",
            entity_id=None,
            metadata={
                "device_id": device_id,
                "device_name": device_name,
                "synced_count": synced_count,
                "error_count": len(errors)
            }
        )

        return Response({
            "success": True,
            "device_id": device_id,
            "synced_records": synced_count,
            "errors": errors
        }, status=status.HTTP_200_OK)
