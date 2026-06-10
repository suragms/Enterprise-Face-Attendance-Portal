from apps.core.repositories import BaseRepository
from apps.students.models import Student


class StudentRepository(BaseRepository):
    model = Student

    def get_by_roll_no(self, roll_no, organization=None):
        queryset = self.model.objects.filter(roll_no=roll_no)
        if organization is not None:
            queryset = queryset.filter(organization=organization)
        return queryset.first()

    def get_active_students(self, organization=None):
        queryset = self.model.objects.filter(is_active=True)
        if organization is not None:
            queryset = queryset.filter(organization=organization)
        return queryset

    def get_archived_students(self, organization=None):
        queryset = self.model.all_objects.filter(is_deleted=True)
        if organization is not None:
            queryset = queryset.filter(organization=organization)
        return queryset
