from django.db import transaction
from django.db.models import Q
from rest_framework import serializers

from apps.authentication.serializers import UserSerializer
from apps.authentication.models import User
from apps.organizations.models import Branch, Department
from apps.organizations.models import OrganizationMembership
from apps.staff.models import Faculty
from apps.core.permissions import normalize_role


class StaffProfileSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source="user", read_only=True)
    name = serializers.CharField(read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    subjects = serializers.SerializerMethodField()
    assigned_classes = serializers.SerializerMethodField()
    login_username = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, style={"input_type": "password"})

    class Meta:
        model = Faculty
        fields = "__all__"
        read_only_fields = ("id", "user", "organization", "created_at", "updated_at", "created_by", "updated_by", "is_deleted", "deleted_at")

    def get_subjects(self, obj):
        return [
            {
                "id": str(subject.id),
                "subject_code": subject.subject_code,
                "name": subject.name,
                "department_name": subject.department.name,
                "course_code": subject.course.code,
                "semester_number": subject.semester.number,
                "credits": subject.credits,
            }
            for subject in obj.subjects.select_related("department", "course", "semester").all()
        ]

    def get_assigned_classes(self, obj):
        classes = {}
        for subject in obj.subjects.select_related("course", "semester").all():
            key = (subject.course.code, subject.semester.number)
            classes[key] = {
                "course_code": subject.course.code,
                "course_name": subject.course.name,
                "semester_number": subject.semester.number,
            }
        return list(classes.values())

    def to_internal_value(self, data):
        mutable = data.copy()
        request = self.context.get("request")
        organization = getattr(getattr(request, "user", None), "active_organization", None)

        if mutable.get("username") and not mutable.get("login_username"):
            mutable["login_username"] = mutable.pop("username")

        mutable.pop("father_name", None)

        full_name = mutable.pop("name", "")
        if full_name and not mutable.get("first_name"):
            parts = str(full_name).strip().split(" ", 1)
            mutable["first_name"] = parts[0]
            mutable["last_name"] = parts[1] if len(parts) > 1 else ""

        if organization and not mutable.get("branch"):
            active_branch = getattr(getattr(request, "user", None), "active_branch", None)
            branch = active_branch or Branch.objects.filter(organization=organization, is_active=True).order_by("code").first()
            if branch:
                mutable["branch"] = str(branch.id)

        department_value = mutable.get("department")
        if organization and department_value and not self._looks_like_uuid(department_value):
            dept_val_str = str(department_value).strip()
            department = Department.objects.filter(
                organization=organization,
                is_active=True,
            ).filter(Q(name__iexact=dept_val_str) | Q(code__iexact=dept_val_str)).first()
            if not department:
                raise serializers.ValidationError({"department": "No active department matches this value."})
            mutable["department"] = str(department.id)

        return super().to_internal_value(mutable)

    @transaction.atomic
    def create(self, validated_data):
        username = validated_data.pop("login_username", "")
        password = validated_data.pop("password", "")
        if not username:
            raise serializers.ValidationError({"login_username": "Login username is required."})
        if not password:
            raise serializers.ValidationError({"password": "Password is required."})

        first_name = validated_data.get("first_name", "")
        last_name = validated_data.get("last_name", "")
        email = validated_data.get("email", "")
        organization = validated_data.get("organization")
        branch = validated_data.get("branch")
        department = validated_data.get("department")
        request = self.context.get("request")
        if request:
            membership = (
                OrganizationMembership.objects.filter(
                    user=request.user,
                    organization=organization,
                    role=OrganizationMembership.Role.HOD,
                    is_active=True,
                )
                .select_related("department")
                .first()
            )
            if membership and membership.department_id and normalize_role(getattr(request.user, "role", "")) == "HOD":
                if not department or str(department.id) != str(membership.department_id):
                    raise serializers.ValidationError({"department": "HOD can only create faculty in own department."})
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role=User.Roles.FACULTY,
            active_organization=organization,
            active_branch=branch,
        )
        if organization:
            OrganizationMembership.objects.create(
                user=user,
                organization=organization,
                branch=branch,
                department=department,
                role=OrganizationMembership.Role.FACULTY,
                created_by=self.context["request"].user,
                updated_by=self.context["request"].user,
            )
        validated_data["user"] = user
        return super().create(validated_data)

    @staticmethod
    def _looks_like_uuid(value):
        return isinstance(value, str) and len(value) == 36 and value.count("-") == 4


FacultySerializer = StaffProfileSerializer
