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
    day_of_week = serializers.CharField(source="day", required=False)
    start_time = serializers.TimeField(source="starts_at", required=False)
    end_time = serializers.TimeField(source="ends_at", required=False)
    room_number = serializers.CharField(source="room", required=False, allow_blank=True)

    class Meta:
        model = Timetable
        fields = "__all__"
        read_only_fields = ("id", "organization", "created_at", "updated_at", "created_by", "updated_by", "is_deleted", "deleted_at")

    def to_internal_value(self, data):
        mutable = data.copy()
        alias_map = {
            "day_of_week": "day",
            "start_time": "starts_at",
            "end_time": "ends_at",
            "room_number": "room",
        }
        for alias, native in alias_map.items():
            if alias in mutable and native not in mutable:
                mutable[native] = mutable[alias]
        return super().to_internal_value(mutable)

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        department = attrs.get("department", getattr(self.instance, "department", None))
        branch = attrs.get("branch", getattr(self.instance, "branch", None))
        course = attrs.get("course", getattr(self.instance, "course", None))
        semester = attrs.get("semester", getattr(self.instance, "semester", None))
        subject = attrs.get("subject", getattr(self.instance, "subject", None))
        faculty = attrs.get("faculty", getattr(self.instance, "faculty", None))
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        if starts_at and ends_at and starts_at >= ends_at:
            raise serializers.ValidationError({"ends_at": "End time must be after start time."})
        if branch and department and department.branch_id != branch.id:
            raise serializers.ValidationError({"department": "Department must belong to the selected branch."})
        if course and department and course.department_id != department.id:
            raise serializers.ValidationError({"course": "Course must belong to the selected department."})
        if semester and course and semester.course_id != course.id:
            raise serializers.ValidationError({"semester": "Semester must belong to the selected course."})
        if subject and department and subject.department_id != department.id:
            raise serializers.ValidationError({"subject": "Subject must belong to the selected department."})
        if subject and semester and subject.semester_id != semester.id:
            raise serializers.ValidationError({"subject": "Subject must belong to the selected semester."})
        if faculty and department and faculty.department_id != department.id:
            raise serializers.ValidationError({"faculty": "Faculty must belong to the selected department."})
        if subject and faculty and subject.assigned_faculty_id and subject.assigned_faculty_id != faculty.id:
            raise serializers.ValidationError({"faculty": "Faculty must be assigned to the selected subject."})
        from apps.core.hod_scoping import enforce_hod_department_access
        from apps.core.faculty_scoping import enforce_faculty_department_access, enforce_faculty_subject_access

        enforce_hod_department_access(user, department)
        enforce_faculty_department_access(user, department)
        if subject:
            enforce_faculty_subject_access(user, subject)
        return attrs
