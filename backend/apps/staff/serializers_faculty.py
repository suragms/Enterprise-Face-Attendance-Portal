from rest_framework import serializers

from apps.staff.models import Faculty


class FacultyCreateInputSerializer(serializers.Serializer):
    staff_code = serializers.CharField(max_length=40)
    name = serializers.CharField(max_length=240, required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    department = serializers.CharField(required=False, allow_blank=True)
    designation = serializers.CharField(max_length=100, required=False, allow_blank=True, default="Lecturer")
    username = serializers.CharField(max_length=150)
    login_username = serializers.CharField(max_length=150, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=6)
    salary = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    max_load_credits = serializers.IntegerField(required=False, min_value=1, max_value=30)


class FacultyRegistrationContextSerializer(serializers.Serializer):
    can_create = serializers.BooleanField()
    departments = serializers.ListField(child=serializers.DictField())
    default_department_id = serializers.CharField(allow_null=True)
    department_locked = serializers.BooleanField()
