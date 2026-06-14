from rest_framework import serializers

from apps.attendance.models import AttendanceCorrection, AttendanceRecord, AttendanceSession
from apps.attendance.engine import (
    enforce_session_actor_access,
    normalize_session_date,
    resolve_timetable_for_values,
)


class AttendanceCorrectionLogSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = AttendanceCorrection
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at", "created_by", "updated_by", "is_deleted", "deleted_at")


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.name", read_only=True)
    student_roll = serializers.CharField(source="student.roll_no", read_only=True)
    student_department = serializers.CharField(source="student.department.name", read_only=True)
    corrections = AttendanceCorrectionLogSerializer(many=True, read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = "__all__"
        read_only_fields = ("id", "organization", "created_at", "updated_at", "created_by", "updated_by", "is_deleted", "deleted_at")


class AttendanceSessionSerializer(serializers.ModelSerializer):
    records = AttendanceRecordSerializer(many=True, read_only=True)
    subject_code = serializers.CharField(source="subject.subject_code", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    present_count = serializers.IntegerField(read_only=True)
    absent_count = serializers.IntegerField(read_only=True)
    attendance_percentage = serializers.FloatField(read_only=True)

    class Meta:
        model = AttendanceSession
        fields = "__all__"
        read_only_fields = ("id", "organization", "created_at", "updated_at", "created_by", "updated_by", "is_deleted", "deleted_at")

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        subject = attrs.get("subject") or getattr(self.instance, "subject", None)
        if not subject:
            return attrs
        date_value = normalize_session_date(attrs.get("date") or getattr(self.instance, "date", None))
        hour = attrs.get("hour") or getattr(self.instance, "hour", "I")
        branch = attrs.get("branch") or getattr(self.instance, "branch", None) or getattr(user, "active_branch", None) or subject.department.branch
        department = attrs.get("department") or getattr(self.instance, "department", None) or subject.department
        semester = attrs.get("semester") or getattr(self.instance, "semester", None) or subject.semester
        if subject.department_id != department.id:
            raise serializers.ValidationError({"subject": "Subject must belong to the selected department."})
        timetable = resolve_timetable_for_values(
            organization=getattr(user, "active_organization", None) or subject.organization,
            branch=branch,
            department=department,
            course=subject.course,
            semester=semester,
            subject=subject,
            date=date_value,
            hour=hour,
        )
        if not timetable:
            raise serializers.ValidationError(
                {
                    "detail": "Attendance is allowed only during a scheduled timetable period.",
                    "code": "outside_timetable",
                }
            )
        attrs["date"] = date_value
        attrs.setdefault("branch", branch)
        attrs.setdefault("department", department)
        attrs.setdefault("semester", semester)
        attrs["timetable"] = timetable
        if self.instance:
            enforce_session_actor_access(self.instance, user)
        return attrs


class ManualAttendanceEntrySerializer(serializers.Serializer):
    student = serializers.UUIDField()
    status = serializers.ChoiceField(choices=["PRESENT", "ABSENT", "LATE", "EXCUSED"])
    confidence_score = serializers.FloatField(required=False, allow_null=True)
    similarity_score = serializers.FloatField(required=False, allow_null=True)


class AttendanceCorrectionSerializer(serializers.Serializer):
    record_id = serializers.UUIDField()
    new_status = serializers.ChoiceField(choices=["PRESENT", "ABSENT", "LATE", "EXCUSED"])
    correction_notes = serializers.CharField(max_length=500)
