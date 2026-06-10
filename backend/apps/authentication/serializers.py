from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.face_recognition.models import FaceEnrollment
from apps.organizations.models import OrganizationMembership
from apps.authentication.models import UserSession

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["username"] = user.username
        token["email"] = user.email
        token["organization_id"] = str(user.active_organization_id) if user.active_organization_id else None
        return token


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        request = self.context.get("request")
        user = User.objects.filter(email__iexact=attrs["email"], is_active=True).first()
        if user:
            user = authenticate(request=request, username=user.username, password=attrs["password"])
        if user is None or not user.is_active:
            raise serializers.ValidationError("Invalid credentials.")
        attrs["user"] = user
        return attrs


class HODAccountCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    department_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = User
        fields = ("email", "username", "first_name", "last_name", "phone", "password", "department_id")

    def create(self, validated_data):
        department_id = validated_data.pop("department_id", None)
        password = validated_data.pop("password")
        validate_password(password)
        creator = self.context["request"].user
        user = User.objects.create_user(
            **validated_data,
            password=password,
            role=User.Roles.HOD,
            active_organization=creator.active_organization,
            active_branch=creator.active_branch,
            must_change_password=True,
        )
        user._assigned_department_id = department_id
        return user


class MembershipSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = OrganizationMembership
        fields = ("id", "organization", "organization_name", "branch", "branch_name", "department", "department_name", "role")


class UserSerializer(serializers.ModelSerializer):
    memberships = MembershipSerializer(many=True, read_only=True)
    enrollment_required = serializers.SerializerMethodField()
    enrollment_due_at = serializers.SerializerMethodField()
    enrollment_overdue = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "phone",
            "active_organization",
            "active_branch",
            "memberships",
            "must_change_password",
            "enrollment_required",
            "enrollment_due_at",
            "enrollment_overdue",
        )
        read_only_fields = ("id", "role", "active_organization", "active_branch", "memberships", "must_change_password")

    def _has_active_face_enrollment(self, obj):
        return FaceEnrollment.objects.filter(user=obj, organization=obj.active_organization, is_active=True).exists()

    def get_enrollment_required(self, obj):
        if obj.normalized_role != User.Roles.STUDENT:
            return False
        return not self._has_active_face_enrollment(obj)

    def get_enrollment_due_at(self, obj):
        due_at = obj.enrollment_due_at
        return due_at.isoformat() if due_at else None

    def get_enrollment_overdue(self, obj):
        if obj.normalized_role != User.Roles.STUDENT:
            return False
        return not self._has_active_face_enrollment(obj)


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    uidb64 = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value


class UserSessionSerializer(serializers.ModelSerializer):
    is_current = serializers.SerializerMethodField()

    class Meta:
        model = UserSession
        fields = (
            "session_key",
            "ip_address",
            "user_agent",
            "device_fingerprint",
            "login_method",
            "is_active",
            "is_current",
            "last_seen_at",
            "created_at",
        )

    def get_is_current(self, obj):
        current_key = self.context.get("current_session_key")
        return bool(current_key and str(obj.session_key) == str(current_key))
