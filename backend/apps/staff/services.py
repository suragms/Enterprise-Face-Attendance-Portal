from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.core.services import BaseService
from apps.staff.repositories import StaffRepository

User = get_user_model()


class StaffService(BaseService):
    def __init__(self):
        super().__init__()
        self.staff_repository = StaffRepository()

    def create_staff_profile(self, user_data, staff_data, creator_user):
        if not creator_user.active_organization_id:
            raise ValidationError({"error": "Active organization is required."})

        user = staff_data.pop("user", None)
        with transaction.atomic():
            if not user:
                username = user_data.get("username")
                email = user_data.get("email")
                password = user_data.get("password")
                if User.objects.filter(username=username).exists():
                    raise ValidationError({"username": "A user with this username already exists."})
                if email and User.objects.filter(email=email).exists():
                    raise ValidationError({"email": "A user with this email already exists."})
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                    first_name=user_data.get("first_name", ""),
                    last_name=user_data.get("last_name", ""),
                    role=User.Roles.FACULTY,
                    phone=user_data.get("phone", ""),
                    active_organization=creator_user.active_organization,
                    active_branch=creator_user.active_branch,
                )
            else:
                user.role = User.Roles.FACULTY
                user.active_organization = creator_user.active_organization
                user.active_branch = creator_user.active_branch
                user.save(update_fields=["role", "active_organization", "active_branch"])

            staff_profile = self.staff_repository.create(
                organization=creator_user.active_organization,
                user=user,
                created_by=creator_user,
                updated_by=creator_user,
                **staff_data,
            )
        return staff_profile

    def update_staff_profile(self, instance, user_data, staff_data, updater_user):
        user = instance.user
        with transaction.atomic():
            for field in ["username", "email", "first_name", "last_name", "phone"]:
                value = user_data.get(field)
                if value is not None:
                    setattr(user, field, value)
            if user_data.get("password"):
                user.set_password(user_data["password"])
            user.save()
            staff_data["updated_by"] = updater_user
            return self.staff_repository.update(instance, **staff_data)

    def delete_staff_profile(self, instance):
        user = instance.user
        with transaction.atomic():
            instance.delete()
            if user:
                user.is_active = False
                user.save(update_fields=["is_active"])

    def assign_subjects(self, staff, subject_ids):
        from apps.subjects.models import Subject

        with transaction.atomic():
            Subject.objects.filter(organization=staff.organization, assigned_faculty=staff).exclude(id__in=subject_ids).update(assigned_faculty=None)
            Subject.objects.filter(organization=staff.organization, id__in=subject_ids).update(assigned_faculty=staff)
        return staff
