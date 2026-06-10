from django.db.models import Count

from apps.core.services import BaseService
from apps.timetable.models import Timetable


class TimetableService(BaseService):
    def detect_clashes(self, organization=None):
        entries = Timetable.objects.select_related("faculty", "subject", "semester")
        if organization is not None:
            entries = entries.filter(organization=organization)

        faculty_clashes = []
        workload_warnings = []
        slot_map = {}
        workload = {}

        for entry in entries:
            slot_key = (entry.day, entry.period, entry.faculty_id)
            slot_map.setdefault(slot_key, []).append(entry)
            workload.setdefault((entry.day, entry.faculty_id), []).append(entry)

        for (day, period, faculty_id), slots in slot_map.items():
            if len(slots) > 1:
                faculty = slots[0].faculty
                faculty_clashes.append({
                    "day": day,
                    "period": period,
                    "faculty_code": faculty.staff_code,
                    "faculty_name": faculty.name,
                    "conflicting_subjects": [slot.subject.subject_code for slot in slots],
                })

        for (day, faculty_id), slots in workload.items():
            if len(slots) > 4:
                faculty = slots[0].faculty
                workload_warnings.append({
                    "day": day,
                    "faculty_code": faculty.staff_code,
                    "faculty_name": faculty.name,
                    "period_count": len(slots),
                })

        return {
            "is_valid": not faculty_clashes,
            "summary": {
                "faculty_clashes_count": len(faculty_clashes),
                "workload_warnings_count": len(workload_warnings),
                "total_entries": entries.aggregate(count=Count("id"))["count"] or 0,
            },
            "clashes": {
                "faculty_clashes": faculty_clashes,
                "workload_warnings": workload_warnings,
                "unassigned_warnings": [],
            },
        }
