from apps.core.repositories import BaseRepository
from apps.subjects.models import Subject


class SubjectRepository(BaseRepository):
    model = Subject

    def get_by_subject_code(self, subject_code, organization=None):
        queryset = self.model.objects.filter(subject_code=subject_code)
        if organization is not None:
            queryset = queryset.filter(organization=organization)
        return queryset.first()

    def get_by_faculty(self, faculty):
        return self.model.objects.filter(assigned_faculty=faculty)
