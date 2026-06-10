"""Normalized report filter parsing for enterprise reporting."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any

from django.utils import timezone


@dataclass
class ReportFilters:
    date: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    month: int | None = None
    year: int | None = None
    department: str | None = None
    department_id: str | None = None
    course: str | None = None
    course_id: str | None = None
    semester: str | None = None
    semester_id: str | None = None
    subject_id: str | None = None
    subject_code: str | None = None
    staff_code: str | None = None
    faculty_id: str | None = None
    roll_no: str | None = None
    student_id: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {k: v for k, v in self.__dict__.items() if v not in (None, "")}

    def cache_token(self) -> str:
        payload = json.dumps(self.as_dict(), sort_keys=True, default=str)
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def parse_report_filters(params) -> ReportFilters:
    """Parse query params or dict into ReportFilters."""
    get = params.get if hasattr(params, "get") else params.__getitem__

    month = get("month")
    year = get("year")
    return ReportFilters(
        date=get("date") or None,
        start_date=get("start_date") or None,
        end_date=get("end_date") or None,
        month=int(month) if month not in (None, "") else None,
        year=int(year) if year not in (None, "") else None,
        department=get("department") or None,
        department_id=get("department_id") or None,
        course=get("course") or None,
        course_id=get("course_id") or None,
        semester=get("semester") or None,
        semester_id=get("semester_id") or None,
        subject_id=get("subject_id") or None,
        subject_code=get("subject_code") or None,
        staff_code=get("staff_code") or None,
        faculty_id=get("faculty_id") or None,
        roll_no=get("roll_no") or None,
        student_id=get("student") or get("student_id") or None,
    )


def default_date_range():
    end = timezone.localdate()
    start = end - timezone.timedelta(days=6)
    return start.isoformat(), end.isoformat()
