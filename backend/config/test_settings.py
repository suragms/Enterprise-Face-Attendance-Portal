from .settings import *  # noqa: F401,F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "test.sqlite3",
    }
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "hexaattender-tests",
    }
}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"] = []
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {}

MIGRATION_MODULES = {
    "authentication": None,
    "organizations": None,
    "students": None,
    "staff": None,
    "subjects": None,
    "timetable": None,
    "attendance": None,
    "notifications": None,
    "face_recognition": None,
    "reports": None,
    "core": None,
    "materials": None,
    "exams": None,
}
