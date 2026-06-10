from rest_framework import serializers

from apps.timetable.models import Timetable


class TimetableEntrySerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    subject_code = serializers.CharField(source="subject.subject_code", read_only=True)
    faculty_name = serializers.CharField(source="faculty.name", read_only=True)
    faculty_code = serializers.CharField(source="faculty.staff_code", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    course_code = serializers.CharField(source="course.code", read_only=True)
    semester_number = serializers.IntegerField(source="semester.number", read_only=True)

    class Meta:
        model = Timetable
        fields = "__all__"
        read_only_fields = ("id", "organization", "created_at", "updated_at", "created_by", "updated_by", "is_deleted", "deleted_at")

    def validate(self, attrs):
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        if starts_at and ends_at and starts_at >= ends_at:
            raise serializers.ValidationError({"ends_at": "End time must be after start time."})
        return attrs
