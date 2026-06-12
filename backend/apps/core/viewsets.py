from rest_framework import viewsets
from apps.core.permissions import normalize_role


class TenantScopedModelViewSet(viewsets.ModelViewSet):
    organization_field = "organization"

    def get_active_organization(self):
        user = self.request.user
        return getattr(user, "active_organization", None)

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return queryset.none()
        
        organization = self.get_active_organization()
        if normalize_role(getattr(user, "role", None)) == "SUPER_ADMIN":
            if organization:
                return queryset.filter(**{f"{self.organization_field}_id": organization.id})
            return queryset
            
        if organization is None:
            return queryset.none()
        return queryset.filter(**{f"{self.organization_field}_id": organization.id})

    def perform_create(self, serializer):
        user = self.request.user
        save_kwargs = {"created_by": user, "updated_by": user}
        if self.organization_field in [field.name for field in serializer.Meta.model._meta.fields]:
            model_field = serializer.Meta.model._meta.get_field(self.organization_field)
            active_org = getattr(user, "active_organization", None)
            if active_org is None and not model_field.null:
                from rest_framework import serializers
                raise serializers.ValidationError({
                    self.organization_field: "Active tenant organization is not set. Please select or switch to an active organization first."
                })
            save_kwargs.setdefault(self.organization_field, active_org)
        serializer.save(**save_kwargs)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
