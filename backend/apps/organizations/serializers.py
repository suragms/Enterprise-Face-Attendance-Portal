from rest_framework import serializers

from apps.organizations.models import (
    AcademicYear,
    AuditLog,
    Branch,
    Course,
    Department,
    Organization,
    OrganizationMembership,
    Semester,
    SystemSettings,
)


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at", "created_by", "updated_by", "is_deleted", "deleted_at")


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = "__all__"
        read_only_fields = ("id", "organization", "created_at", "updated_at", "created_by", "updated_by", "is_deleted", "deleted_at")


class DepartmentSerializer(serializers.ModelSerializer):
    hod_name = serializers.SerializerMethodField(read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)

    class Meta:
        model = Department
        fields = "__all__"
        read_only_fields = ("id", "organization", "created_at", "updated_at", "created_by", "updated_by", "is_deleted", "deleted_at")

    def get_hod_name(self, obj):
        if not obj.hod_id:
            return ""
        full_name = f"{obj.hod.first_name} {obj.hod.last_name}".strip()
        return full_name or obj.hod.email or obj.hod.username

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Department name is required.")
        return value.strip()

    def validate_code(self, value):
        code = value.strip().upper()
        if len(code) < 2:
            raise serializers.ValidationError("Department code must be at least 2 characters.")
        return code

    def validate(self, attrs):
        hod = attrs.get("hod")
        if hod and getattr(hod, "role", "") != "HOD":
            raise serializers.ValidationError({"hod": "Assigned user must have HOD role."})
        return attrs

class AcademicYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicYear
        fields = "__all__"
        read_only_fields = ("id", "organization", "created_at", "updated_at", "created_by", "updated_by", "is_deleted", "deleted_at")


class CourseSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = Course
        fields = "__all__"
        read_only_fields = ("id", "organization", "created_at", "updated_at", "created_by", "updated_by", "is_deleted", "deleted_at")


class SemesterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Semester
        fields = "__all__"
        read_only_fields = ("id", "organization", "created_at", "updated_at", "created_by", "updated_by", "is_deleted", "deleted_at")


class OrganizationMembershipSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationMembership
        fields = "__all__"
        read_only_fields = ("id", "organization", "created_at", "updated_at", "created_by", "updated_by", "is_deleted", "deleted_at")


class SystemSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSettings
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at", "created_by", "updated_by", "is_deleted", "deleted_at")


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = "__all__"
        read_only_fields = fields
