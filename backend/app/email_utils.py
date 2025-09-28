# Utility to normalize emails for account merging


def normalize_email(email: str) -> str:
    """
    Normalize email by removing any "+..." before the @, and lowercasing.
    E.g. user+alias@example.com -> user@example.com
    """
    if not email:
        return email
    local, sep, domain = email.partition("@")
    plus_index = local.find("+")
    if plus_index != -1:
        local = local[:plus_index]
    return f"{local.lower()}@{domain.lower()}"
