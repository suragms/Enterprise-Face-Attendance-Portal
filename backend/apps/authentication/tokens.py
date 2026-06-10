from rest_framework_simplejwt.tokens import RefreshToken


def build_auth_tokens(user):
    refresh = RefreshToken.for_user(user)
    refresh["token_version"] = user.token_version
    refresh.access_token["token_version"] = user.token_version
    refresh.access_token["role"] = user.normalized_role
    if user.active_organization_id:
        refresh.access_token["organization_id"] = str(user.active_organization_id)
    return refresh
