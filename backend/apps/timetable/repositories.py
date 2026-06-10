from apps.core.repositories import BaseRepository
from apps.timetable.models import Timetable


class TimetableRepository(BaseRepository):
    model = Timetable

    def get_by_day_and_cohort(self, day, semester, organization=None):
        queryset = self.model.objects.filter(day=day, semester=semester)
        if organization is not None:
            queryset = queryset.filter(organization=organization)
        return queryset.order_by("period").first()

    def get_weekly_slots_for_cohort(self, semester, organization=None):
        queryset = self.model.objects.filter(semester=semester)
        if organization is not None:
            queryset = queryset.filter(organization=organization)
        return queryset.order_by("day", "period")
