from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("face_recognition", "0002_faceenrollment_pose_embeddings"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="faceenrollment",
            constraint=models.UniqueConstraint(
                fields=("organization", "user"),
                condition=models.Q(is_active=True, is_deleted=False),
                name="uniq_active_face_enrollment_per_user_org",
            ),
        ),
        migrations.AddIndex(
            model_name="faceenrollment",
            index=models.Index(
                fields=["organization", "student", "is_active"],
                name="face_recog_organiz_7ed4ec_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="faceenrollment",
            index=models.Index(
                fields=["organization", "faculty", "is_active"],
                name="face_recog_organiz_f0dbf0_idx",
            ),
        ),
    ]
