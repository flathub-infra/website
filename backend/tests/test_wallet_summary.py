import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app.wallet.fakewallet import FAKE_TXNS, FakeWallet


def test_fake_transaction_summary_includes_primary_recipient():
    summary = FakeWallet._summary_with_recipient(FAKE_TXNS[0])

    assert summary.recipient == "org.flathub.Flathub"


def test_fake_transaction_summary_without_details_has_no_recipient():
    transaction = FAKE_TXNS[0].model_copy(update={"details": []})

    summary = FakeWallet._summary_with_recipient(transaction)

    assert summary.recipient is None
