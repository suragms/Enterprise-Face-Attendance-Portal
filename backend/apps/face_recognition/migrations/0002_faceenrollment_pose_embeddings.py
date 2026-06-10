from django.db import migrations

import apps.core.fields
import django.db.models


class Migration(migrations.Migration):
    dependencies = [
        ("face_recognition", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="faceenrollment",
            name="pose_embeddings",
            field=apps.core.fields.EncryptedJSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="faceenrollment",
            name="captured_poses",
            field=django.db.models.JSONField(blank=True, default=list),
        ),
    ]
