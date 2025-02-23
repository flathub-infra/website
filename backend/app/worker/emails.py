import dramatiq

from .. import emails
from .core import WorkerDB


@dramatiq.actor
def send_email_new(email):
    with WorkerDB() as db:
        emails.send_email_new(dict(**email), db)


@dramatiq.actor
def send_one_email_new(message: dict, dest: str):
    emails.send_one_email_new(message, dest)
