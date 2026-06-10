from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "0003_user_token_version"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="first_login_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
