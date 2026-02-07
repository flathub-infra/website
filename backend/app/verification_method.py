# This module exists to break a circular dependency between verification.py and search.py.
# By moving DBSession to its own module, both can import it without creating a cycle.

from enum import StrEnum


class VerificationMethod(StrEnum):
    # The app is not verified.
    NONE = "none"
    # The app was verified (or blocked from verification) by the admins.
    MANUAL = "manual"
    # The app was verified via website.
    WEBSITE = "website"
    # The app was verified via a login provider.
    LOGIN_PROVIDER = "login_provider"
