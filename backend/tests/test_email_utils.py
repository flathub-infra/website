from app.email_utils import normalize_email


def test_normalize_email_removes_plus():
    assert normalize_email("user+alias@example.com") == "user@example.com"
    assert normalize_email("USER+foo@Example.com") == "user@example.com"


def test_normalize_email_no_plus():
    assert normalize_email("user@example.com") == "user@example.com"


def test_normalize_email_multiple_plus():
    assert normalize_email("user+foo+bar@example.com") == "user@example.com"


def test_normalize_email_empty():
    assert normalize_email("") == ""


def test_normalize_email_case_insensitive():
    assert normalize_email("User+Test@Example.COM") == "user@example.com"
