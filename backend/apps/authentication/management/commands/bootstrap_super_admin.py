from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.conf import settings
import os


class Command(BaseCommand):
    help = "Create/update the required HexaAttender super admin account."

    def handle(self, *args, **options):
        user_model = get_user_model()
        email = os.environ.get("SUPERADMIN_EMAIL", "athults@superadmin.com" if settings.DEBUG else "")
        password = os.environ.get("SUPERADMIN_PASSWORD", "Athul123!" if settings.DEBUG else "")
        if not email or not password:
            self.stderr.write(self.style.ERROR("SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD are required in non-debug environments."))
            return

        user, created = user_model.objects.get_or_create(
            email=email,
            defaults={
                "username": "athults_super_admin",
                "role": user_model.Roles.SUPER_ADMIN,
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
        )
        user.role = user_model.Roles.SUPER_ADMIN
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.username = user.username or "athults_super_admin"
        user.set_password(password)
        user.save(update_fields=["role", "is_staff", "is_superuser", "is_active", "username", "password"])

        status = "created" if created else "updated"
        self.stdout.write(self.style.SUCCESS(f"Super admin {status}: {email}"))
