from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "0002_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="token_version",
            field=models.PositiveIntegerField(default=1),
        ),
    ]
