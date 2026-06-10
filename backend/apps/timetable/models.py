from django.db import models
from apps.core.models import OrganizationScopedModel
from apps.subjects.models import Subject


class Timetable(OrganizationScopedModel):
    class Days(models.TextChoices):
        MONDAY = 'MONDAY', 'Monday'
        TUESDAY = 'TUESDAY', 'Tuesday'
        WEDNESDAY = 'WEDNESDAY', 'Wednesday'
        THURSDAY = 'THURSDAY', 'Thursday'
        FRIDAY = 'FRIDAY', 'Friday'
        SATURDAY = 'SATURDAY', 'Saturday'

    branch = models.ForeignKey("organizations.Branch", on_delete=models.PROTECT, related_name="timetable_entries")
    department = models.ForeignKey("organizations.Department", on_delete=models.PROTECT, related_name="timetable_entries")
    course = models.ForeignKey("organizations.Course", on_delete=models.PROTECT, related_name="timetable_entries")
    semester = models.ForeignKey("organizations.Semester", on_delete=models.PROTECT, related_name="timetable_entries")
    day = models.CharField(max_length=15, choices=Days.choices)
    period = models.PositiveSmallIntegerField()
    starts_at = models.TimeField()
    ends_at = models.TimeField()
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="timetable_entries")
    faculty = models.ForeignKey("staff.Faculty", on_delete=models.PROTECT, related_name="timetable_entries")
    room = models.CharField(max_length=80, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta(OrganizationScopedModel.Meta):
        verbose_name_plural = "Timetable Entries"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "semester", "day", "period"],
                condition=models.Q(is_deleted=False),
                name="uniq_active_timetable_period_per_semester",
            )
        ]
        indexes = [
            models.Index(fields=["organization", "branch", "department"]),
            models.Index(fields=["organization", "faculty", "day"]),
        ]

    def __str__(self):
        return f"{self.semester} - {self.get_day_display()} P{self.period}"


class TimetableEntry(Timetable):
    class Meta:
        proxy = True
