from django.contrib.auth import get_user_model
from apps.core.repositories import BaseRepository

User = get_user_model()

class UserRepository(BaseRepository):
    """
    Data operations repository layer for the User model.
    """
    model = User

    def get_by_username(self, username):
        """Safely retrieve a user profile by username."""
        try:
            return self.model.objects.get(username=username)
        except self.model.DoesNotExist:
            return None

    def get_by_email(self, email):
        """Safely retrieve a user profile by email."""
        try:
            return self.model.objects.get(email=email)
        except self.model.DoesNotExist:
            return None
