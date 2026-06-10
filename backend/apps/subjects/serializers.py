from django.db.models import Q
from rest_framework import serializers

from apps.staff.serializers import FacultySerializer
from apps.staff.models import Faculty
from apps.organizations.models import Course, Department, Semester
from apps.core.hod_scoping import enforce_hod_department_access
from apps.subjects.models import Subject


class SubjectSerializer(serializers.ModelSerializer):
    assigned_faculty_details = FacultySerializer(source="assigned_faculty", read_only=True)
    assigned_faculty_code = serializers.CharField(source="assigned_faculty.staff_code", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    course_code = serializers.CharField(source="course.code", read_only=True)
    course_name = serializers.CharField(source="course.name", read_only=True)
    semester_number = serializers.IntegerField(source="semester.number", read_only=True)

    class Meta:
        model = Subject
        fields = "__all__"
        read_only_fields = ("id", "organization", "created_at", "updated_at", "created_by", "updated_by", "is_deleted", "deleted_at")

    def validate_credits(self, value):
        if value < 1 or value > 8:
            raise serializers.ValidationError("Course credits must be between 1 and 8.")
        return value

    def to_internal_value(self, data):
        mutable = data.copy()
        request = self.context.get("request")
        organization = getattr(getattr(request, "user", None), "active_organization", None)

        assigned_staff = mutable.pop("assigned_staff", None)
        if assigned_staff and not mutable.get("assigned_faculty"):
            faculty = Faculty.objects.filter(organization=organization, staff_code=assigned_staff).first()
            if not faculty:
                raise serializers.ValidationError({"assigned_staff": "No active faculty member matches this staff code."})
            mutable["assigned_faculty"] = str(faculty.id)

        department_value = mutable.get("department")
        if organization and department_value and not self._looks_like_uuid(department_value):
            department = Department.objects.filter(
                organization=organization,
                is_active=True,
            ).filter(Q(name=department_value) | Q(code=department_value)).first()
            if not department:
                raise serializers.ValidationError({"department": "No active department matches this value."})
            mutable["department"] = str(department.id)

        course_value = mutable.get("course")
        if organization and course_value and not self._looks_like_uuid(course_value):
            course = Course.objects.filter(
                organization=organization,
                is_active=True,
            ).filter(Q(name=course_value) | Q(code=course_value)).first()
            if not course:
                raise serializers.ValidationError({"course": "No active course matches this value."})
            mutable["course"] = str(course.id)

        if organization and not mutable.get("course") and mutable.get("department"):
            course = Course.objects.filter(organization=organization, department_id=mutable["department"], is_active=True).order_by("code").first()
            if course:
                mutable["course"] = str(course.id)

        semester_value = mutable.get("semester")
        if organization and semester_value and not self._looks_like_uuid(semester_value):
            semester = Semester.objects.filter(
                organization=organization,
                course_id=mutable.get("course"),
                number=semester_value,
                is_active=True,
            ).order_by("-academic_year__starts_on").first()
            if not semester:
                raise serializers.ValidationError({"semester": "No active semester matches this course and number."})
            mutable["semester"] = str(semester.id)

        return super().to_internal_value(mutable)

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        department = attrs.get("department") or getattr(self.instance, "department", None)
        if department:
            enforce_hod_department_access(user, department)
        return attrs

    @staticmethod
    def _looks_like_uuid(value):
        return isinstance(value, str) and len(value) == 36 and value.count("-") == 4
