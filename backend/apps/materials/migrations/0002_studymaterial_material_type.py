from django.db import migrations, models


def map_legacy_kinds(apps, schema_editor):
    StudyMaterial = apps.get_model("materials", "StudyMaterial")
    mapping = {
        "VIDEO_LINK": "VIDEOS",
        "PPT": "SLIDES",
        "PDF": "NOTES",
        "DOCX": "NOTES",
        "ZIP": "ASSIGNMENTS",
        "IMAGE": "SLIDES",
        "OTHER": "NOTES",
    }
    for material in StudyMaterial.objects.all():
        legacy = getattr(material, "material_kind", "OTHER")
        material.material_type = mapping.get(legacy, "NOTES")
        material.save(update_fields=["material_type"])


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="studymaterial",
            name="material_type",
            field=models.CharField(
                choices=[
                    ("NOTES", "Notes"),
                    ("ASSIGNMENTS", "Assignments"),
                    ("SLIDES", "Slides"),
                    ("VIDEOS", "Videos"),
                ],
                default="NOTES",
                max_length=16,
            ),
        ),
        migrations.RunPython(map_legacy_kinds, migrations.RunPython.noop),
        migrations.AddIndex(
            model_name="studymaterial",
            index=models.Index(fields=["organization", "material_type", "status"], name="mat_org_type_status_idx"),
        ),
    ]
