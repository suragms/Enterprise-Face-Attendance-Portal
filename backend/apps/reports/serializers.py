from rest_framework import serializers

from apps.reports.models import ReportHistory


class ReportHistorySerializer(serializers.ModelSerializer):
    generated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ReportHistory
        fields = [
            "id",
            "report_type",
            "title",
            "generated_by",
            "generated_by_name",
            "branch",
            "department",
            "semester",
            "parameters",
            "file_format",
            "storage_path",
            "file_size_bytes",
            "row_count",
            "status",
            "error_message",
            "completed_at",
            "expires_at",
            "created_at",
        ]
        read_only_fields = fields

    def get_generated_by_name(self, obj):
        if not obj.generated_by:
            return ""
        return obj.generated_by.get_full_name() or obj.generated_by.username


class ReportGenerateSerializer(serializers.Serializer):
    report_type = serializers.ChoiceField(
        choices=["daily", "weekly", "monthly", "semester", "department", "student", "faculty", "subject"]
    )
    format = serializers.ChoiceField(choices=["csv", "excel", "pdf"], default="pdf")
    async_export = serializers.BooleanField(default=True)
    filters = serializers.DictField(child=serializers.CharField(allow_blank=True), required=False, default=dict)
