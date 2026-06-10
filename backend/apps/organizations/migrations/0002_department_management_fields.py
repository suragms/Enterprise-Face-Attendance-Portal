from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("organizations", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="department",
            name="description",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="department",
            name="hod",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="managed_departments",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="department",
            name="status",
            field=models.CharField(
                choices=[("ACTIVE", "Active"), ("INACTIVE", "Inactive")],
                db_index=True,
                default="ACTIVE",
                max_length=10,
            ),
        ),
    ]
