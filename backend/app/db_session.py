# This module exists to break a circular dependency between models.py and database.py.
# - models.py needs DBSession for type hints
# - database.py needs models for database operations
# By moving DBSession to its own module, both can import it without creating a cycle.

from sqlalchemy.orm import Session


class DBSession:
    def __init__(self, session: Session):
        self._session = session

    def __getattr__(self, name):
        return getattr(self._session, name)

    @property
    def session(self):
        return self._session
