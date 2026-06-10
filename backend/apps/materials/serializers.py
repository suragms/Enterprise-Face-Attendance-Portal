from rest_framework import serializers

from apps.materials.models import StudyMaterial


class StudyMaterialSerializer(serializers.ModelSerializer):
    subject_code = serializers.CharField(source="subject.subject_code", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    semester_number = serializers.IntegerField(source="semester.number", read_only=True)
    uploaded_by_name = serializers.SerializerMethodField()
    can_download = serializers.SerializerMethodField()
    has_file = serializers.SerializerMethodField()
    is_video = serializers.SerializerMethodField()

    class Meta:
        model = StudyMaterial
        fields = "__all__"
        read_only_fields = (
            "id",
            "organization",
            "uploaded_by",
            "approved_by",
            "approved_at",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "is_deleted",
            "deleted_at",
            "subject_code",
            "subject_name",
            "semester_number",
            "uploaded_by_name",
            "can_download",
            "has_file",
            "is_video",
            "status",
        )

    def get_uploaded_by_name(self, obj):
        if not obj.uploaded_by:
            return ""
        return obj.uploaded_by.get_full_name() or obj.uploaded_by.username

    def get_can_download(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        if request.user.is_student:
            return obj.status == StudyMaterial.Status.APPROVED
        return True

    def get_has_file(self, obj):
        return bool(obj.file)

    def get_is_video(self, obj):
        return obj.material_type == StudyMaterial.MaterialType.VIDEOS

    def validate(self, attrs):
        material_type = attrs.get("material_type") or getattr(
            self.instance, "material_type", StudyMaterial.MaterialType.NOTES
        )
        file_obj = attrs.get("file") or getattr(self.instance, "file", None)
        video_url = attrs.get("external_video_url") or getattr(self.instance, "external_video_url", "")

        if material_type == StudyMaterial.MaterialType.VIDEOS:
            if not file_obj and not video_url:
                raise serializers.ValidationError(
                    "Videos require an external video URL or uploaded video file."
                )
        elif not file_obj:
            raise serializers.ValidationError("Provide a file upload for this material type.")

        return attrs
