from apps.core.repositories import BaseRepository
from apps.staff.models import StaffProfile

class StaffRepository(BaseRepository):
    """
    Data operations repository layer for the StaffProfile model.
    """
    model = StaffProfile

    def get_by_staff_code(self, staff_code):
        """Safely retrieve a faculty profile by unique staff code."""
        return self.get_by_id(staff_code)

    def get_by_user_id(self, user_id):
        """Safely retrieve a faculty profile associated with a User ID."""
        try:
            return self.model.objects.get(user_id=user_id)
        except self.model.DoesNotExist:
            return None
