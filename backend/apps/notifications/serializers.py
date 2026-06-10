from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from apps.notifications.models import ChannelType, Notification, NotificationSchedule, NotificationTemplate, TriggerType
from apps.notifications.scheduling import compute_next_run

User = get_user_model()


class NotificationTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationTemplate
        fields = "__all__"
        read_only_fields = (
            "id",
            "organization",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "is_deleted",
            "deleted_at",
        )


class NotificationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = "__all__"
        read_only_fields = (
            "id",
            "organization",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "is_deleted",
            "deleted_at",
            "sent_at",
            "read_at",
            "provider_message_id",
        )


class TriggerNotificationSerializer(serializers.Serializer):
    trigger_type = serializers.ChoiceField(choices=TriggerType.choices)
    channel = serializers.ChoiceField(choices=ChannelType.choices)
    recipient = serializers.CharField(max_length=255)
    subject = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    message_body = serializers.CharField(required=False, allow_blank=True, default="")
    context = serializers.DictField(required=False, default=dict)
    user_id = serializers.UUIDField(required=False, allow_null=True)


class NotificationScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationSchedule
        fields = "__all__"
        read_only_fields = (
            "id",
            "organization",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "is_deleted",
            "deleted_at",
            "last_run_at",
            "last_error",
        )

    def validate_channels(self, value):
        if not value:
            raise serializers.ValidationError("Select at least one channel.")
        allowed = {c[0] for c in ChannelType.choices}
        invalid = [c for c in value if c not in allowed]
        if invalid:
            raise serializers.ValidationError(f"Invalid channels: {', '.join(invalid)}")
        return value

    def create(self, validated_data):
        validated_data["next_run_at"] = validated_data.get("scheduled_at") or timezone.now()
        return super().create(validated_data)

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        if "scheduled_at" in validated_data or "repeat_interval" in validated_data:
            instance.next_run_at = instance.scheduled_at if not instance.last_run_at else compute_next_run(
                instance, instance.scheduled_at
            )
            instance.save(update_fields=["next_run_at", "updated_at"])
        return instance


class BulkRetrySerializer(serializers.Serializer):
    notification_ids = serializers.ListField(child=serializers.UUIDField(), required=False)
    failed_only = serializers.BooleanField(default=True)
