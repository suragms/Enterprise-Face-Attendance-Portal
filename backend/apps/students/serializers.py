import re

from django.db.models import Q
from rest_framework import serializers

from apps.authentication.models import User
from apps.face_recognition.models import FaceEnrollment
from apps.organizations.models import OrganizationMembership
from apps.organizations.models import Branch, Course, Department, Semester
from apps.core.hod_scoping import enforce_hod_department_access
from apps.core.faculty_scoping import enforce_faculty_department_access
from apps.students.models import Student


class StudentSerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(source="roll_no", required=False)
    name = serializers.CharField(required=False)
    department_name = serializers.CharField(source="department.name", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    course_name = serializers.CharField(source="course.name", read_only=True)
    department_label = serializers.CharField(source="department.name", read_only=True)
    department_display = serializers.CharField(source="department.name", read_only=True)
    department_value = serializers.CharField(source="department.name", read_only=True)
    department_text = serializers.CharField(source="department.name", read_only=True)
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all(), required=False)
    semester = serializers.PrimaryKeyRelatedField(queryset=Semester.objects.all(), required=False)
    course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all(), required=False)
    branch = serializers.PrimaryKeyRelatedField(queryset=Branch.objects.all(), required=False)
    year = serializers.SerializerMethodField()
    face_enrolled = serializers.SerializerMethodField()
    is_archived = serializers.BooleanField(source="is_deleted", read_only=True)
    login_email = serializers.EmailField(write_only=True, required=False)
    login_password = serializers.CharField(write_only=True, required=False, min_length=8)
    phone = serializers.CharField(required=False, allow_blank=True, default="")

    class Meta:
        model = Student
        fields = "__all__"
        read_only_fields = ("id", "organization", "created_at", "updated_at", "created_by", "updated_by", "is_deleted", "deleted_at")

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["student_id"] = instance.roll_no
        data["name"] = instance.name
        data["department"] = instance.department.name
        data["semester"] = instance.semester.number
        data["course"] = str(instance.course_id)
        data["branch"] = str(instance.branch_id)
        return data

    def to_internal_value(self, data):
        mutable = data.copy()
        request = self.context.get("request")
        organization = getattr(getattr(request, "user", None), "active_organization", None)

        full_name = mutable.pop("name", "")
        if full_name and not mutable.get("first_name"):
            parts = str(full_name).strip().split(" ", 1)
            mutable["first_name"] = parts[0]
            mutable["last_name"] = parts[1] if len(parts) > 1 else ""

        mutable.pop("year", None)
        mutable.pop("face_enrolled", None)
        mutable.pop("is_archived", None)

        if organization and not mutable.get("branch"):
            active_branch = getattr(getattr(request, "user", None), "active_branch", None)
            branch = active_branch or Branch.objects.filter(organization=organization, is_active=True).order_by("code").first()
            if branch:
                mutable["branch"] = str(branch.id)

        department_value = mutable.get("department")
        if organization and department_value and not self._looks_like_uuid(str(department_value)):
            department = Department.objects.filter(organization=organization, is_active=True).filter(
                Q(name=department_value) | Q(code=department_value)
            ).first()
            if not department:
                raise serializers.ValidationError({"department": "No active department matches this value."})
            mutable["department"] = str(department.id)

        if organization and not mutable.get("course") and mutable.get("department"):
            course = Course.objects.filter(organization=organization, department_id=mutable["department"], is_active=True).order_by("code").first()
            if course:
                mutable["course"] = str(course.id)

        semester_value = mutable.get("semester")
        if organization and semester_value and not self._looks_like_uuid(str(semester_value)):
            semester = Semester.objects.filter(
                organization=organization,
                course_id=mutable.get("course"),
                number=semester_value,
                is_active=True,
            ).order_by("-academic_year__starts_on").first()
            if not semester:
                raise serializers.ValidationError({"semester": "No active semester matches this course and number."})
            mutable["semester"] = str(semester.id)

        if not mutable.get("admission_number") and mutable.get("roll_no"):
            mutable["admission_number"] = mutable["roll_no"]

        return super().to_internal_value(mutable)

    def get_year(self, obj):
        return max(1, (obj.semester.number + 1) // 2)

    def get_face_enrolled(self, obj):
        if not obj.user_id:
            return False
        return FaceEnrollment.objects.filter(organization=obj.organization, user=obj.user, is_active=True).exists()

    def validate_phone(self, value):
        if value and not re.match(r"^\+?[0-9\s\-()]{7,20}$", value):
            raise serializers.ValidationError("Invalid contact mobile number format.")
        return value

    @staticmethod
    def _looks_like_uuid(value):
        return isinstance(value, str) and len(value) == 36 and value.count("-") == 4

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        department = attrs.get("department") or getattr(self.instance, "department", None)
        if department:
            enforce_hod_department_access(user, department)
            enforce_faculty_department_access(user, department)
        if self.instance is None:
            if not attrs.get("login_email"):
                raise serializers.ValidationError({"login_email": "Login email is required when creating a student."})
            if not attrs.get("login_password"):
                raise serializers.ValidationError({"login_password": "Login password is required when creating a student."})
        return attrs

    def create(self, validated_data):
        email = validated_data.pop("login_email")
        password = validated_data.pop("login_password")
        first_name = validated_data.get("first_name", "")
        last_name = validated_data.get("last_name", "")
        roll_no = validated_data.get("roll_no")
        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role=User.Roles.STUDENT,
            active_organization=validated_data.get("organization"),
            active_branch=validated_data.get("branch"),
        )
        if validated_data.get("organization"):
            OrganizationMembership.objects.create(
                user=user,
                organization=validated_data.get("organization"),
                branch=validated_data.get("branch"),
                department=validated_data.get("department"),
                role=OrganizationMembership.Role.STUDENT,
                created_by=self.context["request"].user,
                updated_by=self.context["request"].user,
            )
        validated_data["user"] = user
        if not validated_data.get("admission_number") and roll_no:
            validated_data["admission_number"] = roll_no
        if not validated_data.get("email"):
            validated_data["email"] = email
        if not validated_data.get("phone"):
            validated_data["phone"] = ""
        return super().create(validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop("login_password", None)
        student = super().update(instance, validated_data)
        if password and student.user:
            student.user.set_password(password)
            student.user.save(update_fields=["password"])
        return student
