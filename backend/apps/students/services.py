from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.core.services import BaseService
from apps.students.repositories import StudentRepository
from apps.students.serializers import StudentSerializer


class StudentService(BaseService):
    def __init__(self):
        super().__init__()
        self.student_repository = StudentRepository()

    def bulk_import_students(self, students_data, creator_user):
        if not isinstance(students_data, list):
            raise ValidationError({"error": "Expected a JSON list of student objects."})
        if not creator_user.active_organization_id:
            raise ValidationError({"error": "Active organization is required."})

        success_count = 0
        errors = []
        with transaction.atomic():
            for idx, student_row in enumerate(students_data):
                serializer = StudentSerializer(data=student_row, context={"request": None})
                if serializer.is_valid():
                    serializer.save(
                        organization=creator_user.active_organization,
                        created_by=creator_user,
                        updated_by=creator_user,
                    )
                    success_count += 1
                else:
                    errors.append({"row_index": idx, "validation_errors": serializer.errors})
            if errors:
                transaction.set_rollback(True)
                raise ValidationError({"error": "Bulk import aborted.", "failures": errors})
        return success_count

    def archive_student(self, roll_no, user):
        student = self.student_repository.get_by_roll_no(roll_no, user.active_organization)
        if not student:
            raise ValidationError({"error": f"Student with roll number '{roll_no}' not found."})
        student.updated_by = user
        student.delete()
        return student

    def restore_student(self, roll_no, user):
        student = self.student_repository.get_archived_students(user.active_organization).filter(roll_no=roll_no).first()
        if not student:
            raise ValidationError({"error": f"Archived student with roll number '{roll_no}' not found."})
        student.is_deleted = False
        student.deleted_at = None
        student.updated_by = user
        student.save(update_fields=["is_deleted", "deleted_at", "updated_by", "updated_at"])
        return student
