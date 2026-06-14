from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0003_alter_attendancerecord_capture_method"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="attendancerecord",
            index=models.Index(
                fields=["session", "student", "captured_at"],
                name="attendance__session_3dce6d_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="attendancerecord",
            index=models.Index(
                fields=["organization", "student", "captured_at"],
                name="attendance__organiz_3522a0_idx",
            ),
        ),
    ]
