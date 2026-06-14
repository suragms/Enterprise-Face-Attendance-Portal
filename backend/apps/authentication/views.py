from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.middleware.csrf import get_token
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.authentication.cookies import clear_auth_cookies, set_auth_cookies
from apps.authentication.security import (
    clear_password_lockout,
    client_ip,
    client_device,
    create_user_session,
    deactivate_session_by_refresh_jti,
    is_password_locked,
    lockout_response,
    log_login_attempt,
    record_failed_password_attempt,
    remaining_attempts,
    touch_user_session,
)
from apps.authentication.tokens import build_auth_tokens
from apps.authentication.serializers import (
    ChangePasswordSerializer,
    ForgotPasswordSerializer,
    HODAccountCreateSerializer,
    LoginSerializer,
    ResetPasswordSerializer,
    UserSerializer,
)
from apps.authentication.permissions import IsSuperAdminUser
from apps.authentication.permissions import IsHODUser
from apps.authentication.permissions import IsFacultyOnlyUser
from apps.authentication.permissions import IsStudentUser
from apps.authentication.services import AuthService
from apps.face_recognition.models import FaceAuditLog, FaceEnrollment
from apps.face_recognition.services import FaceRecognitionService
from apps.core.faculty_scoping import (
    assigned_subject_ids,
    resolve_faculty_profile,
    scope_attendance_records_for_faculty,
    scope_queryset_for_faculty,
)
from apps.core.student_scoping import ATTENDANCE_THRESHOLD, resolve_student_profile
from apps.core.hod_scoping import resolve_hod_department
from apps.organizations.models import AuditLog, Department, OrganizationMembership, Organization
from apps.staff.models import Faculty
from apps.materials.models import StudyMaterial
from apps.subjects.models import Subject
from apps.students.models import Student
from apps.attendance.models import AttendanceRecord
from apps.exams.models import ExamSchedule
from apps.notifications.models import Notification

User = get_user_model()


def _client_ip(request):
    return client_ip(request)


def _client_device(request):
    return client_device(request)


def _rotate_session_version(user):
    user.token_version = (user.token_version or 0) + 1
    user.save(update_fields=["token_version"])


def _refresh_for_user(user):
    return build_auth_tokens(user)


def _issue_auth_response(user, request, login_method="password"):
    from django.db.utils import OperationalError
    from apps.organizations.models import Organization

    if user.first_login_at is None:
        user.first_login_at = timezone.now()
        user.save(update_fields=["first_login_at"])

    if user.is_super_admin and not user.active_organization_id:
        first_org = Organization.objects.first()
        if first_org:
            user.active_organization = first_org
            user.save(update_fields=["active_organization"])

    _rotate_session_version(user)
    refresh = _refresh_for_user(user)
    try:
        session = create_user_session(user, request, refresh, login_method=login_method)
    except OperationalError as exc:
        if "usersession" not in str(exc).lower():
            raise
        return Response(
            {
                "detail": "Database schema is out of date. Run: python manage.py migrate",
                "code": "schema_outdated",
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    clear_password_lockout(request, user.email)
    log_login_attempt(request, email=user.email, user=user, success=True, login_method=login_method)
    response = Response(
        {
            "user": UserSerializer(user).data,
            "csrfToken": get_token(request),
            "session_key": str(session.session_key),
        },
        status=status.HTTP_200_OK,
    )
    set_auth_cookies(response, refresh.access_token, refresh)
    AuditLog.objects.create(
        organization=user.active_organization,
        actor=user,
        action="auth.login",
        ip_address=_client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", ""),
        metadata={"login_method": login_method, "session_key": str(session.session_key)},
    )
    return response


def _face_lock_state(user_id):
    lock_key = f"face-lockout:user:{user_id}".lower()
    attempts_key = f"face-attempts:user:{user_id}".lower()
    locked = bool(cache.get(lock_key))
    attempts = int(cache.get(attempts_key, 0) or 0)
    return {"locked": locked, "attempts": attempts, "attempts_remaining": max(0, 5 - attempts)}


class CustomTokenObtainPairView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    def post(self, request):
        email = request.data.get("email", "").strip()
        if is_password_locked(request, email):
            return Response(lockout_response(), status=status.HTTP_429_TOO_MANY_REQUESTS)

        serializer = LoginSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            attempts = record_failed_password_attempt(request, email)
            payload = dict(serializer.errors)
            payload["attempts_remaining"] = max(0, 5 - attempts)
            if attempts >= 5:
                return Response({**lockout_response(), **payload}, status=status.HTTP_429_TOO_MANY_REQUESTS)
            return Response(payload, status=status.HTTP_401_UNAUTHORIZED)

        user = serializer.validated_data["user"]
        clear_password_lockout(request, email)
        membership = user.memberships.filter(is_active=True).select_related("organization", "branch").first()
        if membership and not user.active_organization_id:
            user.active_organization = membership.organization
            user.active_branch = membership.branch
            if not user.is_super_admin:
                user.role = membership.role
                user.save(update_fields=["active_organization", "active_branch", "role"])
            else:
                user.save(update_fields=["active_organization", "active_branch"])


        _rotate_session_version(user)
        refresh = _refresh_for_user(user)
        session = create_user_session(user, request, refresh, login_method="token")
        log_login_attempt(request, email=user.email, user=user, success=True, login_method="token")
        response = Response(
            {
                "user": UserSerializer(user).data,
                "csrfToken": get_token(request),
                "session_key": str(session.session_key),
            },
            status=status.HTTP_200_OK,
        )
        set_auth_cookies(response, refresh.access_token, refresh)
        AuditLog.objects.create(
            organization=user.active_organization,
            actor=user,
            action="auth.login",
            ip_address=_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        )
        return response


class RefreshTokenView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        if not raw_refresh:
            return Response({"detail": "Refresh token missing."}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            refresh = RefreshToken(raw_refresh)
            user = User.objects.get(id=refresh["user_id"], is_active=True)
            if refresh.get("token_version") != user.token_version:
                raise TokenError("Token version mismatch.")
            if settings.SIMPLE_JWT.get("ROTATE_REFRESH_TOKENS"):
                old_jti = str(refresh.get("jti", ""))
                refresh.blacklist()
                deactivate_session_by_refresh_jti(old_jti)
                refresh = _refresh_for_user(user)
            touch_user_session(refresh)
            session = create_user_session(user, request, refresh, login_method="refresh")
            response = Response(
                {
                    "user": UserSerializer(user).data,
                    "csrfToken": get_token(request),
                    "session_key": str(session.session_key),
                }
            )
            set_auth_cookies(response, refresh.access_token, refresh)
            return response
        except (TokenError, User.DoesNotExist):
            response = Response({"detail": "Invalid refresh token."}, status=status.HTTP_401_UNAUTHORIZED)
            clear_auth_cookies(response)
            return response


class UserDetailView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        user = self.request.user
        if user.is_super_admin and not user.active_organization_id:
            from apps.organizations.models import Organization
            first_org = Organization.objects.first()
            if first_org:
                user.active_organization = first_org
                user.save(update_fields=["active_organization"])
        return user


class SwitchOrganizationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        organization_id = request.data.get("organization_id")
        membership = OrganizationMembership.objects.select_related("organization", "branch").filter(
            user=request.user,
            organization_id=organization_id,
            is_active=True,
        ).first()
        if not membership and not request.user.is_super_admin:
            return Response({"detail": "Organization access denied."}, status=status.HTTP_403_FORBIDDEN)
        if membership:
            request.user.active_organization = membership.organization
            request.user.active_branch = membership.branch
            if not request.user.is_super_admin:
                request.user.role = membership.role
                request.user.save(update_fields=["active_organization", "active_branch", "role"])
            else:
                request.user.save(update_fields=["active_organization", "active_branch"])
        elif request.user.is_super_admin and organization_id:
            try:
                org = Organization.objects.get(id=organization_id)
                request.user.active_organization = org
                request.user.active_branch = None
                request.user.save(update_fields=["active_organization", "active_branch"])
            except Organization.DoesNotExist:
                return Response({"detail": "Organization not found."}, status=status.HTTP_404_NOT_FOUND)


        # Re-issue JWT cookies so the new active organization is encoded in the access token payload
        refresh = _refresh_for_user(request.user)
        response = Response(UserSerializer(request.user).data)
        set_auth_cookies(response, refresh.access_token, refresh)
        return response


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        auth_service = AuthService()
        raw_refresh = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        revoked = auth_service.invalidate_refresh_token(raw_refresh)
        _rotate_session_version(request.user)
        response = Response({"message": "Successfully signed out."}, status=status.HTTP_200_OK)
        clear_auth_cookies(response)
        AuditLog.objects.create(
            organization=request.user.active_organization,
            actor=request.user,
            action="auth.logout",
            ip_address=_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            metadata={"refresh_token_revoked": revoked},
        )
        return response


class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.auth_service = AuthService()

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            self.auth_service.generate_password_reset_link(serializer.validated_data["email"], request=request)
        except Exception:
            pass
        return Response({"message": "If the account exists, password reset instructions have been sent."})


class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.auth_service = AuthService()

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.auth_service.reset_password(
            serializer.validated_data["uidb64"],
            serializer.validated_data["token"],
            serializer.validated_data["new_password"],
            request=request,
        )
        return Response({"message": "Password reset successful."})


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.auth_service = AuthService()

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.auth_service.change_password(
            request.user,
            serializer.validated_data["old_password"],
            serializer.validated_data["new_password"],
            request=request,
        )
        response = Response({"message": "Password updated."})
        clear_auth_cookies(response)
        return response


class InitiateLoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.face_service = FaceRecognitionService()

    def post(self, request):
        mode = request.data.get("mode", "password")
        challenge_id = str(__import__("uuid").uuid4())
        challenge_key = f"auth-challenge:{challenge_id}"
        if mode == "password":
            email = request.data.get("email", "").strip()
            if is_password_locked(request, email):
                return Response(lockout_response(), status=status.HTTP_429_TOO_MANY_REQUESTS)

            serializer = LoginSerializer(data=request.data, context={"request": request})
            if not serializer.is_valid():
                attempts = record_failed_password_attempt(request, email)
                if attempts >= 5:
                    return Response(lockout_response(), status=status.HTTP_429_TOO_MANY_REQUESTS)
                return Response(
                    {
                        **serializer.errors,
                        "attempts_remaining": remaining_attempts(request, email),
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            user = serializer.validated_data["user"]
            clear_password_lockout(request, email)
            face_required = user.is_student and FaceEnrollment.objects.filter(user=user, is_active=True).exists()
            lock_state = _face_lock_state(user.id) if face_required else {"attempts": 0, "attempts_remaining": 5}
            if face_required and lock_state["locked"]:
                return Response(
                    {
                        "detail": "Face verification locked for this account. Try again after 1 hour.",
                        "attempts": lock_state["attempts"],
                        "attempts_remaining": 0,
                        "lock_seconds": 3600,
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
            cache.set(
                challenge_key,
                {
                    "user_id": str(user.id),
                    "organization_id": str(user.active_organization_id or ""),
                    "face_required": face_required,
                    "face_verified": not face_required,
                },
                timeout=600,
            )
            return Response(
                {
                    "challenge_id": challenge_id,
                    "face_required": face_required,
                    "mode": mode,
                    "attempts": lock_state["attempts"],
                    "attempts_remaining": lock_state["attempts_remaining"],
                }
            )

        if mode == "face":
            organization_id = request.data.get("organization_id")
            image_data = request.data.get("image")
            if not organization_id or not image_data:
                return Response({"detail": "organization_id and image are required for face mode."}, status=status.HTTP_400_BAD_REQUEST)
            probe = self.face_service.encode_face(image_data)
            if not probe.get("success"):
                return Response({"detail": probe.get("message", "Face encoding failed.")}, status=status.HTTP_400_BAD_REQUEST)
            best = None
            for enrollment in FaceEnrollment.objects.filter(organization_id=organization_id, is_active=True).select_related("user", "organization"):
                pose_set = enrollment.pose_embeddings or {}
                if pose_set:
                    match = self.face_service.verify_against_pose_set(pose_set, probe["encoding"], enrollment.confidence_threshold)
                else:
                    match = self.face_service.compare_faces(enrollment.embedding, probe["encoding"], enrollment.confidence_threshold)
                if match["match"] and (best is None or match["confidence"] > best[1]["confidence"]):
                    best = (enrollment, match)
            if not best:
                return Response({"detail": "Face login failed."}, status=status.HTTP_401_UNAUTHORIZED)
            enrollment, match = best
            user = enrollment.user
            user.active_organization = enrollment.organization
            membership = user.memberships.filter(organization=enrollment.organization, is_active=True).first()
            if membership:
                user.active_branch = membership.branch
                user.role = membership.role
            user.save(update_fields=["active_organization", "active_branch", "role"])
            cache.set(
                challenge_key,
                {
                    "user_id": str(user.id),
                    "organization_id": str(enrollment.organization_id),
                    "face_required": user.is_student,
                    "face_verified": True,
                    "confidence": match["confidence"],
                },
                timeout=600,
            )
            FaceAuditLog.objects.create(
                organization=enrollment.organization,
                actor=user,
                event=FaceAuditLog.Event.FACE_LOGIN,
                success=True,
                confidence=match["confidence"],
                ip_address=_client_ip(request),
                metadata={"flow": "initiate-login"},
            )
            return Response({"challenge_id": challenge_id, "face_required": user.is_student, "mode": mode})

        return Response({"detail": "Unsupported mode."}, status=status.HTTP_400_BAD_REQUEST)


class VerifyFaceView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "face"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.face_service = FaceRecognitionService()

    def post(self, request):
        challenge_id = request.data.get("challenge_id")
        image_data = request.data.get("image")
        if not challenge_id or not image_data:
            return Response({"detail": "challenge_id and image are required."}, status=status.HTTP_400_BAD_REQUEST)
        challenge_key = f"auth-challenge:{challenge_id}"
        challenge = cache.get(challenge_key)
        if not challenge:
            return Response({"detail": "Invalid or expired challenge."}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.filter(id=challenge.get("user_id"), is_active=True).first()
        if not user:
            return Response({"detail": "User unavailable for challenge."}, status=status.HTTP_400_BAD_REQUEST)

        lock_key = f"face-lockout:user:{user.id}".lower()
        attempts_key = f"face-attempts:user:{user.id}".lower()
        if cache.get(lock_key):
            return Response(
                {
                    "detail": "Too many failed face attempts. Try again in 1 hour.",
                    "attempts": 5,
                    "attempts_remaining": 0,
                    "lock_seconds": 3600,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        enrollment = FaceEnrollment.objects.filter(user=user, is_active=True).order_by("-created_at").first()
        if not enrollment:
            return Response({"detail": "No active face enrollment found."}, status=status.HTTP_404_NOT_FOUND)
        liveness = self.face_service.verify_liveness(image_data)
        if not liveness.get("success") or not liveness.get("liveness"):
            attempts = cache.get(attempts_key, 0) + 1
            cache.set(attempts_key, attempts, timeout=3600)
            if attempts >= 5:
                cache.set(lock_key, True, timeout=3600)
            FaceAuditLog.objects.create(
                organization=enrollment.organization,
                actor=user,
                event=FaceAuditLog.Event.LIVENESS_FAILED,
                success=False,
                liveness_score=liveness.get("score", 0),
                ip_address=_client_ip(request),
                metadata={"flow": "verify-face", "attempts": attempts},
            )
            return Response(
                {
                    "detail": liveness.get("message", "Liveness check failed."),
                    "attempts": attempts,
                    "attempts_remaining": max(0, 5 - attempts),
                    "lock_seconds": 3600 if attempts >= 5 else 0,
                    "liveness": liveness,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        probe = self.face_service.encode_face(image_data)
        if not probe.get("success"):
            return Response({"detail": probe.get("message", "Face encoding failed.")}, status=status.HTTP_400_BAD_REQUEST)
        pose_set = enrollment.pose_embeddings or {}
        if pose_set:
            match = self.face_service.verify_against_pose_set(pose_set, probe["encoding"], enrollment.confidence_threshold)
        else:
            match = self.face_service.compare_faces(enrollment.embedding, probe["encoding"], enrollment.confidence_threshold)
        if not match.get("match"):
            attempts = cache.get(attempts_key, 0) + 1
            cache.set(attempts_key, attempts, timeout=3600)
            if attempts >= 5:
                cache.set(lock_key, True, timeout=3600)
            FaceAuditLog.objects.create(
                organization=enrollment.organization,
                actor=user,
                event=FaceAuditLog.Event.VERIFICATION,
                success=False,
                confidence=match.get("confidence", 0),
                liveness_score=liveness.get("score", 0),
                ip_address=_client_ip(request),
                metadata={"flow": "verify-face", "attempts": attempts},
            )
            return Response(
                {
                    "detail": "Face verification failed.",
                    "attempts": attempts,
                    "attempts_remaining": max(0, 5 - attempts),
                    "lock_seconds": 3600 if attempts >= 5 else 0,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        cache.delete(attempts_key)
        challenge["face_verified"] = True
        challenge["confidence"] = match.get("confidence", 0)
        challenge["verified_at"] = timezone.now().isoformat()
        challenge["ip_address"] = _client_ip(request)
        challenge["device"] = _client_device(request)
        cache.set(challenge_key, challenge, timeout=600)
        FaceAuditLog.objects.create(
            organization=enrollment.organization,
            actor=user,
            event=FaceAuditLog.Event.VERIFICATION,
            success=True,
            confidence=match.get("confidence", 0),
            liveness_score=liveness.get("score", 0),
            ip_address=_client_ip(request),
            metadata={"flow": "verify-face"},
        )
        return Response(
            {
                "verified": True,
                "confidence": match.get("confidence", 0),
                "attempts": 0,
                "attempts_remaining": 5,
            }
        )


class CompleteLoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    def post(self, request):
        challenge_id = request.data.get("challenge_id")
        if not challenge_id:
            return Response({"detail": "challenge_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        challenge_key = f"auth-challenge:{challenge_id}"
        challenge = cache.get(challenge_key)
        if not challenge:
            return Response({"detail": "Invalid or expired challenge."}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.filter(id=challenge.get("user_id"), is_active=True).first()
        if not user:
            return Response({"detail": "User unavailable for challenge."}, status=status.HTTP_400_BAD_REQUEST)
        if challenge.get("face_required") and not challenge.get("face_verified"):
            return Response({"detail": "Face verification is required for this login challenge."}, status=status.HTTP_403_FORBIDDEN)
        if challenge.get("organization_id"):
            membership = user.memberships.filter(organization_id=challenge.get("organization_id"), is_active=True).first()
            if membership:
                user.active_organization = membership.organization
                user.active_branch = membership.branch
                user.role = membership.role
                user.save(update_fields=["active_organization", "active_branch", "role"])
        cache.delete(challenge_key)
        login_method = "face" if challenge.get("face_verified") else "password"
        return _issue_auth_response(user, request, login_method=login_method)


class CreateHODAccountView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSuperAdminUser]

    def post(self, request):
        serializer = HODAccountCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        hod_user = serializer.save()
        department_id = getattr(hod_user, "_assigned_department_id", None)
        department = None
        if department_id and request.user.active_organization:
            department = Department.objects.filter(
                organization=request.user.active_organization,
                id=department_id,
                is_active=True,
                is_deleted=False,
            ).first()
        if request.user.active_organization:
            membership, _ = OrganizationMembership.objects.get_or_create(
                user=hod_user,
                organization=request.user.active_organization,
                role=OrganizationMembership.Role.HOD,
                defaults={
                    "branch": request.user.active_branch,
                    "department": department,
                    "is_active": True,
                    "created_by": request.user,
                    "updated_by": request.user,
                },
            )
            if department and not membership.department_id:
                membership.department = department
                membership.save(update_fields=["department", "updated_at"])
            if department and not department.hod_id:
                department.hod = hod_user
                department.save(update_fields=["hod", "updated_at"])
        AuditLog.objects.create(
            organization=request.user.active_organization,
            actor=request.user,
            action="account.create_hod",
            entity_type="User",
            entity_id=hod_user.id,
            ip_address=_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            metadata={"email": hod_user.email},
        )
        return Response(UserSerializer(hod_user).data, status=status.HTTP_201_CREATED)

    def get(self, request):
        queryset = User.objects.filter(role=User.Roles.HOD, is_active=True).order_by("first_name", "email")
        return Response({"count": queryset.count(), "results": UserSerializer(queryset, many=True).data})

    def delete(self, request):
        user_id = request.data.get("user_id")
        if not user_id:
            return Response({"detail": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        hod_user = User.objects.filter(id=user_id, role=User.Roles.HOD).first()
        if not hod_user:
            return Response({"detail": "HOD account not found."}, status=status.HTTP_404_NOT_FOUND)
        hod_user.is_active = False
        hod_user.save(update_fields=["is_active"])
        AuditLog.objects.create(
            organization=request.user.active_organization,
            actor=request.user,
            action="account.deactivate_hod",
            entity_type="User",
            entity_id=hod_user.id,
            ip_address=_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            metadata={"email": hod_user.email},
        )
        return Response({"message": "HOD account deactivated."}, status=status.HTTP_200_OK)


class SuperAdminDashboardSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSuperAdminUser]

    def get(self, request):
        today = timezone.localdate()
        organization = request.user.active_organization

        department_qs = Department.objects.filter(is_active=True, is_deleted=False)
        hod_qs = User.objects.filter(role=User.Roles.HOD, is_active=True)
        faculty_qs = User.objects.filter(role=User.Roles.FACULTY, is_active=True)
        student_qs = User.objects.filter(role=User.Roles.STUDENT, is_active=True)
        attendance_qs = AttendanceRecord.objects.filter(session__date=today, is_deleted=False)
        face_qs = FaceAuditLog.objects.filter(event=FaceAuditLog.Event.VERIFICATION)

        if organization:
            department_qs = department_qs.filter(organization=organization)
            hod_qs = hod_qs.filter(memberships__organization=organization, memberships__is_active=True)
            faculty_qs = faculty_qs.filter(memberships__organization=organization, memberships__is_active=True)
            student_qs = student_qs.filter(memberships__organization=organization, memberships__is_active=True)
            attendance_qs = attendance_qs.filter(organization=organization)
            face_qs = face_qs.filter(organization=organization)

        total_records = attendance_qs.count()
        attended_count = attendance_qs.filter(
            status__in=[
                AttendanceRecord.StatusChoices.PRESENT,
                AttendanceRecord.StatusChoices.LATE,
                AttendanceRecord.StatusChoices.EXCUSED,
            ]
        ).count()
        attendance_percentage = round((attended_count / total_records) * 100, 2) if total_records else 0.0

        verification_agg = face_qs.aggregate(
            total=Count("id"),
            success=Count("id", filter=Q(success=True)),
        )
        total_verifications = verification_agg.get("total") or 0
        success_verifications = verification_agg.get("success") or 0
        success_rate = round((success_verifications / total_verifications) * 100, 2) if total_verifications else 0.0

        return Response(
            {
                "total_departments": department_qs.count(),
                "total_hod": hod_qs.distinct().count(),
                "total_faculty": faculty_qs.distinct().count(),
                "total_students": student_qs.distinct().count(),
                "todays_attendance": attended_count,
                "attendance_percentage": attendance_percentage,
                "face_recognition_success_rate": success_rate,
                "verification_events_total": total_verifications,
            }
        )


class HODDashboardSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsHODUser]

    def get(self, request):
        department = resolve_hod_department(request.user)
        faculty_qs = Faculty.objects.filter(organization=request.user.active_organization, is_active=True, is_deleted=False)
        student_qs = Student.objects.filter(organization=request.user.active_organization, is_active=True, is_deleted=False)
        if department:
            faculty_qs = faculty_qs.filter(department=department)
            student_qs = student_qs.filter(department=department)

        today = timezone.localdate()
        today_records = AttendanceRecord.objects.filter(
            organization=request.user.active_organization,
            session__date=today,
            is_deleted=False,
        )
        if department:
            today_records = today_records.filter(session__department=department)
        attended_count = today_records.filter(status__in=["PRESENT", "LATE", "EXCUSED"]).count()
        total_records = today_records.count()
        attendance_pct = round((attended_count / total_records) * 100, 2) if total_records else 0.0

        return Response(
            {
                "department": department.name if department else "Unassigned",
                "department_id": str(department.id) if department else None,
                "department_code": department.code if department else None,
                "faculty_count": faculty_qs.count(),
                "student_count": student_qs.count(),
                "attendance_percentage": attendance_pct,
                "todays_attendance": attended_count,
            }
        )


class HodPortalContextView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsHODUser]

    def get(self, request):
        department = resolve_hod_department(request.user)
        return Response(
            {
                "department": {
                    "id": str(department.id),
                    "name": department.name,
                    "code": department.code,
                }
                if department
                else None,
                "department_locked": True,
                "can_create_hod": False,
                "capabilities": {
                    "create_faculty": bool(department),
                    "manage_students": bool(department),
                    "manage_subjects": bool(department),
                    "manage_timetable": bool(department),
                    "manage_courses": bool(department),
                    "manage_materials": bool(department),
                    "manage_exams": bool(department),
                    "view_reports": bool(department),
                    "view_analytics": bool(department),
                    "manage_notifications": bool(department),
                },
            }
        )


class FacultyDashboardSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsFacultyOnlyUser]

    def get(self, request):
        profile = resolve_faculty_profile(request.user)
        if not profile:
            return Response(
                {
                    "department": "Unassigned",
                    "staff_code": None,
                    "assigned_subjects": 0,
                    "registered_students": 0,
                    "face_enrolled_students": 0,
                    "attendance_percentage": 0.0,
                    "pending_materials": 0,
                }
            )

        students_qs = scope_queryset_for_faculty(
            Student.objects.filter(organization=request.user.active_organization, is_active=True, is_deleted=False),
            request.user,
        )
        subject_count = len(assigned_subject_ids(request.user))

        today = timezone.localdate()
        records_qs = scope_attendance_records_for_faculty(
            AttendanceRecord.objects.filter(
                organization=request.user.active_organization,
                session__date=today,
                is_deleted=False,
            ),
            request.user,
        )
        total_records = records_qs.count()
        attended = records_qs.filter(
            status__in=[
                AttendanceRecord.StatusChoices.PRESENT,
                AttendanceRecord.StatusChoices.LATE,
                AttendanceRecord.StatusChoices.EXCUSED,
            ]
        ).count()
        attendance_pct = round((attended / total_records) * 100, 2) if total_records else 0.0

        face_enrolled = 0
        for student in students_qs.select_related("user"):
            if student.user_id and FaceEnrollment.objects.filter(
                organization=request.user.active_organization,
                user=student.user,
                is_active=True,
            ).exists():
                face_enrolled += 1

        pending_materials = StudyMaterial.objects.filter(
            organization=request.user.active_organization,
            uploaded_by=request.user,
            status__in=[StudyMaterial.Status.DRAFT, StudyMaterial.Status.PENDING],
            is_deleted=False,
        ).count()

        return Response(
            {
                "department": profile.department.name,
                "department_id": str(profile.department_id),
                "staff_code": profile.staff_code,
                "assigned_subjects": subject_count,
                "registered_students": students_qs.count(),
                "face_enrolled_students": face_enrolled,
                "attendance_percentage": attendance_pct,
                "pending_materials": pending_materials,
            }
        )


class FacultyPortalContextView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsFacultyOnlyUser]

    def get(self, request):
        profile = resolve_faculty_profile(request.user)
        subjects = []
        if profile:
            subjects = list(
                Subject.objects.filter(
                    organization=request.user.active_organization,
                    assigned_faculty=profile,
                    is_active=True,
                    is_deleted=False,
                ).values("id", "subject_code", "name")
            )

        return Response(
            {
                "staff_code": profile.staff_code if profile else None,
                "department": {
                    "id": str(profile.department_id),
                    "name": profile.department.name,
                    "code": profile.department.code,
                }
                if profile
                else None,
                "department_locked": True,
                "assigned_subjects": subjects,
                "can_create_faculty": False,
                "can_create_hod": False,
                "can_manage_departments": False,
                "capabilities": {
                    "register_students": True,
                    "take_attendance": bool(profile),
                    "face_recognition_scan": bool(profile),
                    "manual_attendance": False,
                    "upload_materials": bool(profile),
                    "create_notifications": bool(profile),
                    "view_timetable": bool(profile),
                    "view_reports": bool(profile),
                    "view_analytics": bool(profile),
                },
            }
        )


def _student_attendance_breakdown(user):
    profile = resolve_student_profile(user)
    if not profile:
        return {"overall_percentage": 0, "promotion_status": "DETAINED", "subjects": [], "at_risk_subjects": []}

    qs = AttendanceRecord.objects.filter(
        organization=user.active_organization,
        student=profile,
        is_deleted=False,
    )
    total = qs.count()
    present = qs.filter(status__in=["PRESENT", "LATE", "EXCUSED"]).count()
    overall = round((present / total) * 100, 2) if total else 0

    subjects = []
    for row in qs.values("session__subject__subject_code", "session__subject__name").annotate(
        total=Count("id"),
        present=Count("id", filter=Q(status__in=["PRESENT", "LATE", "EXCUSED"])),
        absent=Count("id", filter=Q(status="ABSENT")),
        late=Count("id", filter=Q(status="LATE")),
        excused=Count("id", filter=Q(status="EXCUSED")),
    ):
        attended = row["present"] or 0
        sub_total = row["total"] or 0
        percentage = round((attended / sub_total) * 100, 2) if sub_total else 0
        subjects.append(
            {
                "code": row["session__subject__subject_code"],
                "name": row["session__subject__name"],
                "total": sub_total,
                "present": attended,
                "absent": row["absent"] or 0,
                "late": row["late"] or 0,
                "excused": row["excused"] or 0,
                "percentage": percentage,
                "is_at_risk": percentage < ATTENDANCE_THRESHOLD,
            }
        )

    at_risk = [item for item in subjects if item["is_at_risk"]]
    return {
        "overall_percentage": overall,
        "promotion_status": "ELIGIBLE" if overall >= ATTENDANCE_THRESHOLD else "DETAINED",
        "subjects": subjects,
        "at_risk_subjects": at_risk,
        "total_sessions": total,
        "total_present": present,
    }


class StudentDashboardSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsStudentUser]

    def get(self, request):
        profile = resolve_student_profile(request.user)
        attendance = _student_attendance_breakdown(request.user)

        unread_notifications = 0
        upcoming_exams = 0
        approved_materials = 0
        today_status = "NOT_MARKED"

        if profile:
            unread_notifications = Notification.objects.filter(
                organization=request.user.active_organization,
                user=request.user,
                is_deleted=False,
            ).exclude(status=Notification.StatusChoices.READ).count()

            upcoming_exams = ExamSchedule.objects.filter(
                organization=request.user.active_organization,
                semester_id=profile.semester_id,
                status=ExamSchedule.Status.PUBLISHED,
                is_deleted=False,
                exam_date__gte=timezone.localdate(),
            ).count()

            approved_materials = StudyMaterial.objects.filter(
                organization=request.user.active_organization,
                semester_id=profile.semester_id,
                status=StudyMaterial.Status.APPROVED,
                is_deleted=False,
            ).count()

            today = timezone.localdate()
            today_records = AttendanceRecord.objects.filter(
                organization=request.user.active_organization,
                student=profile,
                session__date=today,
                is_deleted=False,
            )
            if today_records.exists():
                if today_records.filter(status__in=["PRESENT", "LATE", "EXCUSED"]).exists():
                    today_status = "PRESENT"
                else:
                    today_status = "ABSENT"

        face_enrolled = False
        if request.user.id:
            face_enrolled = FaceEnrollment.objects.filter(
                organization=request.user.active_organization,
                user=request.user,
                is_active=True,
            ).exists()

        return Response(
            {
                "roll_no": profile.roll_no if profile else None,
                "name": profile.name if profile else request.user.get_full_name(),
                "department": profile.department.name if profile else None,
                "semester": profile.semester.number if profile else None,
                "overall_attendance": attendance["overall_percentage"],
                "promotion_status": attendance["promotion_status"],
                "is_defaulter": attendance["overall_percentage"] < ATTENDANCE_THRESHOLD,
                "at_risk_subject_count": len(attendance["at_risk_subjects"]),
                "attendance_threshold": ATTENDANCE_THRESHOLD,
                "today_status": today_status,
                "unread_notifications": unread_notifications,
                "upcoming_exams": upcoming_exams,
                "approved_materials": approved_materials,
                "face_enrolled": face_enrolled,
                "subjects": attendance["subjects"],
            }
        )


class StudentPortalContextView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsStudentUser]

    def get(self, request):
        profile = resolve_student_profile(request.user)
        attendance = _student_attendance_breakdown(request.user)

        return Response(
            {
                "roll_no": profile.roll_no if profile else None,
                "name": profile.name if profile else request.user.get_full_name(),
                "email": profile.email if profile else request.user.email,
                "phone": profile.phone if profile else "",
                "department": {
                    "id": str(profile.department_id),
                    "name": profile.department.name,
                    "code": profile.department.code,
                }
                if profile
                else None,
                "semester": profile.semester.number if profile else None,
                "course": profile.course.name if profile else None,
                "branch": profile.branch.name if profile else None,
                "campus_status": profile.campus_status if profile else None,
                "overall_attendance": attendance["overall_percentage"],
                "promotion_status": attendance["promotion_status"],
                "is_defaulter": attendance["overall_percentage"] < ATTENDANCE_THRESHOLD,
                "attendance_threshold": ATTENDANCE_THRESHOLD,
                "capabilities": {
                    "view_dashboard": bool(profile),
                    "view_attendance": bool(profile),
                    "view_timetable": bool(profile),
                    "download_materials": bool(profile),
                    "view_exam_timetable": bool(profile),
                    "view_notifications": bool(profile),
                    "view_profile": True,
                    "face_enrollment": True,
                },
            }
        )
