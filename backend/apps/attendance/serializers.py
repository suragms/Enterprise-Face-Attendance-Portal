from rest_framework import serializers

from apps.attendance.models import AttendanceCorrection, AttendanceRecord, AttendanceSession


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


class ManualAttendanceEntrySerializer(serializers.Serializer):
    student = serializers.UUIDField()
    status = serializers.ChoiceField(choices=["PRESENT", "ABSENT", "LATE", "EXCUSED"])


class AttendanceCorrectionSerializer(serializers.Serializer):
    record_id = serializers.UUIDField()
    new_status = serializers.ChoiceField(choices=["PRESENT", "ABSENT", "LATE", "EXCUSED"])
    correction_notes = serializers.CharField(max_length=500)
