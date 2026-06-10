from rest_framework import serializers

from apps.exams.models import ExamSchedule


class ExamScheduleSerializer(serializers.ModelSerializer):
    subject_code = serializers.CharField(source="subject.subject_code", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    semester_number = serializers.IntegerField(source="semester.number", read_only=True)

    class Meta:
        model = ExamSchedule
        fields = "__all__"
        read_only_fields = (
            "id",
            "organization",
            "scheduled_by",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "is_deleted",
            "deleted_at",
            "subject_code",
            "subject_name",
            "department_name",
            "semester_number",
            "status",
        )

    def validate(self, attrs):
        starts_at = attrs.get("starts_at") or getattr(self.instance, "starts_at", None)
        ends_at = attrs.get("ends_at") or getattr(self.instance, "ends_at", None)
        if starts_at and ends_at and starts_at >= ends_at:
            raise serializers.ValidationError("Exam start time must be before end time.")
        return attrs
