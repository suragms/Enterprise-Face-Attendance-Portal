from apps.core.services import BaseService
from apps.subjects.repositories import SubjectRepository

class SubjectService(BaseService):
    """
    Business logic layer for academic Course Curriculum Subjects.
    """
    def __init__(self):
        super().__init__()
        self.subject_repository = SubjectRepository()
