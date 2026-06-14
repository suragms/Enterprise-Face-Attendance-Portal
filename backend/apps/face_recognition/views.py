from django.contrib.auth import get_user_model
from django.middleware.csrf import get_token
from django.core.cache import cache
from django.db import transaction
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.authentication.cookies import set_auth_cookies
from apps.face_recognition.models import FaceAuditLog, FaceEnrollment
from apps.face_recognition.services import FaceRecognitionService
from apps.staff.models import Faculty
from apps.students.models import Student
from apps.core.hod_scoping import enforce_hod_department_access
from apps.core.permissions import ROLE_RANKS, normalize_role

FACE_SIMILARITY_THRESHOLD = 0.65

User = get_user_model()
REQUIRED_POSES = ("FRONT", "LEFT", "RIGHT", "UP", "DOWN")


def _liveness_payload(liveness):
    return {
        "liveness_score": liveness.get("score", 0),
        "liveness_checks": liveness.get("checks", {}),
        "liveness_details": liveness.get("details", {}),
        "liveness": liveness,
    }


def _enrollment_identity(enrollment):
    if enrollment.student_id:
        return {
            "roll_no": enrollment.student.roll_no,
            "name": enrollment.student.name,
            "student_id": str(enrollment.student_id),
            "subject_type": FaceEnrollment.SubjectType.STUDENT,
            "encoding": enrollment.embedding,
        }
    if enrollment.faculty_id:
        return {
            "roll_no": enrollment.faculty.staff_code,
            "staff_code": enrollment.faculty.staff_code,
            "name": enrollment.faculty.name,
            "faculty_id": str(enrollment.faculty_id),
            "subject_type": FaceEnrollment.SubjectType.FACULTY,
            "encoding": enrollment.embedding,
        }
    return {
        "roll_no": str(enrollment.user_id),
        "name": enrollment.user.get_full_name() or enrollment.user.username,
        "user_id": str(enrollment.user_id),
        "subject_type": enrollment.subject_type,
        "encoding": enrollment.embedding,
    }


def _active_enrollment_payloads(organization):
    enrollments = (
        FaceEnrollment.objects.filter(organization=organization, is_active=True)
        .select_related("user", "student", "faculty")
        .order_by("-created_at")
    )
    return [_enrollment_identity(enrollment) for enrollment in enrollments]


def _normalized_similarity(value):
    try:
        score = float(value)
    except (TypeError, ValueError):
        return 0.0
    return score / 100.0 if score > 1 else score


def _refresh_for_user(user):
    refresh = RefreshToken.for_user(user)
    refresh["token_version"] = user.token_version
    return refresh


class FaceRegisterView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "face"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.face_service = FaceRecognitionService()

    def post(self, request):
        if request.user.is_authenticated and not getattr(request.user, "active_organization", None):
            membership = request.user.memberships.filter(is_active=True).select_related("organization").first()
            if membership:
                request.user.active_organization = membership.organization
                request.user.active_branch = membership.branch
                request.user.role = membership.role
                request.user.save(update_fields=["active_organization", "active_branch", "role"])

        user_id = request.data.get("user_id")
        roll_no = request.data.get("roll_no")
        staff_code = request.data.get("staff_code")
        student_id = request.data.get("student_id")
        faculty_id = request.data.get("faculty_id")
        subject_type = request.data.get("subject_type")
        image_data = request.data.get("image")
        pose_images = request.data.get("pose_images")
        if not image_data and not pose_images:
            return Response({"error": "'image' or 'pose_images' is required."}, status=status.HTTP_400_BAD_REQUEST)
        student = None
        faculty = None
        if roll_no or student_id:
            student_filters = {"organization": request.user.active_organization, "is_active": True}
            student_filters["id" if student_id else "roll_no"] = student_id or roll_no
            student = Student.objects.select_related("user").filter(**student_filters).first()
            if not student:
                return Response({"error": "Student not found for face enrollment."}, status=status.HTTP_404_NOT_FOUND)
            if not student.user_id:
                return Response({"error": "Student must be linked to a login user before face enrollment."}, status=status.HTTP_400_BAD_REQUEST)
            role = normalize_role(getattr(request.user, "role", ""))
            can_enroll_others = ROLE_RANKS.get(role, 0) >= ROLE_RANKS["HOD"]
            if student.user_id != request.user.id and not can_enroll_others:
                return Response({"error": "You are not allowed to enroll another student's face."}, status=status.HTTP_403_FORBIDDEN)
            try:
                enforce_hod_department_access(request.user, student.department)
            except Exception as exc:
                return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
            user = student.user
            subject_type = FaceEnrollment.SubjectType.STUDENT
        elif staff_code or faculty_id:
            faculty_filters = {"organization": request.user.active_organization, "is_active": True}
            faculty_filters["id" if faculty_id else "staff_code"] = faculty_id or staff_code
            faculty = Faculty.objects.select_related("user").filter(**faculty_filters).first()
            if not faculty:
                return Response({"error": "Faculty not found for face enrollment."}, status=status.HTTP_404_NOT_FOUND)
            role = normalize_role(getattr(request.user, "role", ""))
            can_enroll_others = ROLE_RANKS.get(role, 0) >= ROLE_RANKS["HOD"]
            if faculty.user_id != request.user.id and not can_enroll_others:
                return Response({"error": "You are not allowed to enroll another faculty member's face."}, status=status.HTTP_403_FORBIDDEN)
            try:
                enforce_hod_department_access(request.user, faculty.department)
            except Exception as exc:
                return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
            user = faculty.user
            subject_type = FaceEnrollment.SubjectType.FACULTY
        else:
            requested_user_id = user_id or request.user.id
            role = normalize_role(getattr(request.user, "role", ""))
            can_enroll_others = ROLE_RANKS.get(role, 0) >= ROLE_RANKS["HOD"]
            if str(requested_user_id) != str(request.user.id) and not can_enroll_others:
                return Response({"error": "You are not allowed to enroll another user's face."}, status=status.HTTP_403_FORBIDDEN)
            user = (
                User.objects.filter(
                    id=requested_user_id,
                    memberships__organization=request.user.active_organization,
                    memberships__is_active=True,
                    is_active=True,
                )
                .distinct()
                .first()
            )
            if not user:
                return Response({"error": "User not found in active organization."}, status=status.HTTP_404_NOT_FOUND)

            try:
                student_profile = user.student_profile
                if student_profile and student_profile.is_active:
                    student = student_profile
                    subject_type = FaceEnrollment.SubjectType.STUDENT
            except Student.DoesNotExist:
                pass

            if not student:
                try:
                    faculty_profile = user.faculty_profile
                    if faculty_profile and faculty_profile.is_active:
                        faculty = faculty_profile
                        subject_type = FaceEnrollment.SubjectType.FACULTY
                except Faculty.DoesNotExist:
                    pass

            if not subject_type:
                subject_type = FaceEnrollment.SubjectType.USER
        liveness_probe = image_data or (pose_images or {}).get("FRONT")
        liveness = self.face_service.verify_liveness(liveness_probe)
        if not liveness.get("success") or not liveness.get("liveness"):
            self._audit(request, "LIVENESS_FAILED", False, liveness_score=liveness.get("score", 0))
            return Response({"error": liveness.get("message"), **_liveness_payload(liveness)}, status=status.HTTP_400_BAD_REQUEST)
        if pose_images:
            result = self.face_service.encode_pose_set(pose_images)
            if not result["success"]:
                return Response({"error": result["message"]}, status=status.HTTP_400_BAD_REQUEST)
            primary_embedding = result["pose_embeddings"]["FRONT"]
            pose_embeddings = result["pose_embeddings"]
            captured_poses = result.get("captured_poses", [])
        else:
            result = self.face_service.encode_face(image_data)
            if not result["success"]:
                return Response({"error": result["message"]}, status=status.HTTP_400_BAD_REQUEST)
            primary_embedding = result["encoding"]
            pose_embeddings = {"FRONT": result["encoding"]}
            captured_poses = ["FRONT"]
        with transaction.atomic():
            previous = FaceEnrollment.objects.select_for_update().filter(
                organization=request.user.active_organization,
                user=user,
                is_active=True,
            )
            previous_ids = [str(item.id) for item in previous]
            previous.update(is_active=False, updated_by=request.user)
            enrollment = FaceEnrollment.objects.create(
                organization=request.user.active_organization,
                user=user,
                student=student,
                faculty=faculty,
                subject_type=subject_type,
                encrypted_embedding=primary_embedding,
                pose_embeddings=pose_embeddings,
                captured_poses=captured_poses,
                liveness_score=liveness.get("score", 0),
                liveness_checks=liveness.get("checks", {}),
                created_by=request.user,
                updated_by=request.user,
            )
        self._audit(request, "ENROLLMENT", True, liveness_score=enrollment.liveness_score)
        if previous_ids:
            self._audit(
                request,
                "ENROLLMENT",
                True,
                liveness_score=enrollment.liveness_score,
                metadata={
                    "action": "re_enrollment",
                    "previous_enrollment_ids": previous_ids,
                    "new_enrollment_id": str(enrollment.id),
                },
            )
        return Response(
            {
                "id": str(enrollment.id),
                "message": "Face enrolled successfully.",
                "captured_poses": captured_poses,
                "required_poses": list(REQUIRED_POSES),
                **_liveness_payload(liveness),
            },
            status=status.HTTP_201_CREATED,
        )

    def _audit(self, request, event, success, confidence=0, liveness_score=0, metadata=None):
        FaceAuditLog.objects.create(
            organization=request.user.active_organization,
            actor=request.user if request.user.is_authenticated else None,
            event=event,
            success=success,
            confidence=confidence,
            liveness_score=liveness_score,
            metadata=metadata or {},
        )


class FaceVerifyView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "face"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.face_service = FaceRecognitionService()

    def post(self, request):
        if request.user.is_authenticated and not getattr(request.user, "active_organization", None):
            membership = request.user.memberships.filter(is_active=True).select_related("organization").first()
            if membership:
                request.user.active_organization = membership.organization
                request.user.active_branch = membership.branch
                request.user.role = membership.role
                request.user.save(update_fields=["active_organization", "active_branch", "role"])

        image_data = request.data.get("image")
        if not image_data:
            return Response({"error": "'image' is required."}, status=status.HTTP_400_BAD_REQUEST)
        filters = {"organization": request.user.active_organization, "is_active": True}
        if request.data.get("roll_no"):
            filters["student__roll_no"] = request.data["roll_no"]
        elif request.data.get("staff_code"):
            filters["faculty__staff_code"] = request.data["staff_code"]
        else:
            filters["user_id"] = request.data.get("user_id") or request.user.id
        enrollment = (
            FaceEnrollment.objects.filter(**filters)
            .select_related("user", "student", "faculty")
            .order_by("-created_at")
            .first()
        )
        if not enrollment:
            return Response({"error": "No active face enrollment found."}, status=status.HTTP_404_NOT_FOUND)
        liveness = self.face_service.verify_liveness(image_data)
        if not liveness.get("success") or not liveness.get("liveness"):
            self._audit(request, "LIVENESS_FAILED", False, liveness_score=liveness.get("score", 0))
            return Response({"error": liveness.get("message"), **_liveness_payload(liveness)}, status=status.HTTP_400_BAD_REQUEST)
        probe = self.face_service.encode_face(image_data)
        if not probe["success"]:
            return Response({"error": probe["message"]}, status=status.HTTP_400_BAD_REQUEST)
        pose_set = enrollment.pose_embeddings or {}
        if pose_set:
            match = self.face_service.verify_against_pose_set(pose_set, probe["encoding"], enrollment.confidence_threshold)
        else:
            match = self.face_service.compare_faces(enrollment.embedding, probe["encoding"], enrollment.confidence_threshold)
        if match.get("match") and _normalized_similarity(match.get("confidence")) < FACE_SIMILARITY_THRESHOLD:
            match = {
                **match,
                "match": False,
                "message": "Face verification similarity is below the required threshold.",
                "threshold": FACE_SIMILARITY_THRESHOLD,
            }
        self._audit(request, "VERIFICATION", match["match"], match["confidence"], liveness.get("score", 0))
        identity = _enrollment_identity(enrollment)
        return Response(
            {
                "match": match["match"],
                "confidence": match["confidence"],
                "distance": match["distance"],
                "student_name": identity["name"],
                "best_pose": match.get("best_pose"),
                "identity": {key: value for key, value in identity.items() if key != "encoding"},
                "match_details": match,
                **_liveness_payload(liveness),
            }
        )



    def _audit(self, request, event, success, confidence=0, liveness_score=0):
        FaceAuditLog.objects.create(
            organization=request.user.active_organization,
            actor=request.user,
            event=event,
            success=success,
            confidence=confidence,
            liveness_score=liveness_score,
        )


class FaceLoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "face"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.face_service = FaceRecognitionService()

    def post(self, request):
        organization_id = request.data.get("organization_id")
        image_data = request.data.get("image")
        if not organization_id or not image_data:
            return Response({"error": "'organization_id' and 'image' are required."}, status=status.HTTP_400_BAD_REQUEST)
        
        # 1. Lockout check
        ip = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "")).split(",")[0].strip()
        lock_key = f"face-lockout:{ip}".lower()
        if cache.get(lock_key):
            return Response(
                {"detail": "Too many failed attempts. Face verification is temporarily disabled for 1 hour. Please log in using your username and password."},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        liveness = self.face_service.verify_liveness(image_data)
        if not liveness.get("success") or not liveness.get("liveness"):
            attempts_key = f"face-attempts:{ip}".lower()
            attempts = cache.get(attempts_key, 0) + 1
            cache.set(attempts_key, attempts, timeout=3600)  # 1 hour
            if attempts >= 5:  # lockout after 5 attempts
                cache.set(lock_key, True, timeout=3600)
            return Response({"error": liveness.get("message"), "liveness": liveness}, status=status.HTTP_400_BAD_REQUEST)
        
        probe = self.face_service.encode_face(image_data)
        if not probe["success"]:
            return Response({"error": probe["message"]}, status=status.HTTP_400_BAD_REQUEST)
        
        best = None
        for enrollment in FaceEnrollment.objects.filter(organization_id=organization_id, is_active=True).select_related("user", "organization"):
            pose_set = enrollment.pose_embeddings or {}
            if pose_set:
                match = self.face_service.verify_against_pose_set(pose_set, probe["encoding"], enrollment.confidence_threshold)
            else:
                match = self.face_service.compare_faces(enrollment.embedding, probe["encoding"], enrollment.confidence_threshold)
            if (
                match["match"]
                and _normalized_similarity(match.get("confidence")) >= FACE_SIMILARITY_THRESHOLD
                and (best is None or match["confidence"] > best[1]["confidence"])
            ):
                best = (enrollment, match)
        
        if best is None:
            attempts_key = f"face-attempts:{ip}".lower()
            attempts = cache.get(attempts_key, 0) + 1
            cache.set(attempts_key, attempts, timeout=3600)  # 1 hour
            if attempts >= 5:  # lockout after 5 attempts
                cache.set(lock_key, True, timeout=3600)
            return Response({"detail": "Face login failed."}, status=status.HTTP_401_UNAUTHORIZED)
        
        # Successful login, reset attempts
        cache.delete(f"face-attempts:{ip}".lower())
        
        enrollment, match = best
        user = enrollment.user
        user.active_organization = enrollment.organization
        membership = user.memberships.filter(organization=enrollment.organization, is_active=True).first()
        if membership:
            user.active_branch = membership.branch
            user.role = membership.role
        user.save(update_fields=["active_organization", "active_branch", "role"])
        
        user.token_version = (user.token_version or 0) + 1
        user.save(update_fields=["token_version"])
        refresh = _refresh_for_user(user)
        response = Response({"user_id": str(user.id), "confidence": match["confidence"], "csrfToken": get_token(request)})
        set_auth_cookies(response, refresh.access_token, refresh)
        FaceAuditLog.objects.create(
            organization=enrollment.organization,
            actor=user,
            event=FaceAuditLog.Event.FACE_LOGIN,
            success=True,
            confidence=match["confidence"],
            liveness_score=liveness.get("score", 0),
        )
        return response


class FaceDetectView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "face"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.face_service = FaceRecognitionService()

    def post(self, request):
        image_data = request.data.get("image")
        if not image_data:
            return Response({"error": "'image' is required."}, status=status.HTTP_400_BAD_REQUEST)
        liveness = self.face_service.verify_liveness(image_data)
        if not liveness.get("success") or not liveness.get("liveness"):
            FaceAuditLog.objects.create(
                organization=request.user.active_organization,
                actor=request.user,
                event=FaceAuditLog.Event.LIVENESS_FAILED,
                success=False,
                liveness_score=liveness.get("score", 0),
                metadata=liveness,
            )
            return Response({"error": liveness.get("message"), **_liveness_payload(liveness)}, status=status.HTTP_400_BAD_REQUEST)
        result = self.face_service.detect_faces_in_frame(image_data)
        if result.get("success"):
            identification = self.face_service.identify_faces_in_frame(
                image_data,
                _active_enrollment_payloads(request.user.active_organization),
            )
            result.update(
                {
                    "identified": identification.get("identified", []),
                    "unidentified_count": identification.get("unidentified_count", 0),
                    "total_faces": identification.get("total_faces", result.get("face_count", 0)),
                    "identification_success": identification.get("success", False),
                    "identification_message": identification.get("message", ""),
                    **_liveness_payload(liveness),
                }
            )
        FaceAuditLog.objects.create(
            organization=request.user.active_organization,
            actor=request.user,
            event=FaceAuditLog.Event.DETECTION,
            success=result.get("success", False),
            metadata=result,
        )
        return Response(result, status=status.HTTP_200_OK if result.get("success") else status.HTTP_400_BAD_REQUEST)


class FaceIdentifyView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "face"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.face_service = FaceRecognitionService()

    def post(self, request):
        image_data = request.data.get("image")
        if not image_data:
            return Response({"error": "'image' is required."}, status=status.HTTP_400_BAD_REQUEST)
        liveness = self.face_service.verify_liveness(image_data)
        if not liveness.get("success") or not liveness.get("liveness"):
            FaceAuditLog.objects.create(
                organization=request.user.active_organization,
                actor=request.user,
                event=FaceAuditLog.Event.LIVENESS_FAILED,
                success=False,
                liveness_score=liveness.get("score", 0),
                metadata=liveness,
            )
            return Response({"error": liveness.get("message"), **_liveness_payload(liveness)}, status=status.HTTP_400_BAD_REQUEST)
        result = self.face_service.identify_faces_in_frame(image_data, _active_enrollment_payloads(request.user.active_organization))
        if result.get("success"):
            result.update(_liveness_payload(liveness))
        FaceAuditLog.objects.create(
            organization=request.user.active_organization,
            actor=request.user,
            event=FaceAuditLog.Event.IDENTIFICATION,
            success=result.get("success", False),
            metadata=result,
        )
        return Response(result, status=status.HTTP_200_OK if result.get("success") else status.HTTP_400_BAD_REQUEST)


class FaceAnalyzeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "face"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.face_service = FaceRecognitionService()

    def post(self, request):
        result = self.face_service.analyze_face(request.data.get("image"))
        return Response(result, status=status.HTTP_200_OK if result.get("success") else status.HTTP_400_BAD_REQUEST)


class FaceAuditEventsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queryset = FaceAuditLog.objects.filter(organization=request.user.active_organization)
        if request.query_params.get("event"):
            queryset = queryset.filter(event=request.query_params["event"])
        if request.query_params.get("success") in {"true", "false"}:
            queryset = queryset.filter(success=request.query_params["success"] == "true")
        data = [
            {
                "id": str(row.id),
                "event": row.event,
                "success": row.success,
                "confidence": row.confidence,
                "liveness_score": row.liveness_score,
                "actor_id": str(row.actor_id) if row.actor_id else None,
                "created_at": row.created_at,
                "metadata": row.metadata,
            }
            for row in queryset.order_by("-created_at")[:500]
        ]
        return Response({"count": len(data), "results": data})
