"""SQLAlchemy ORM base. Product tables are added in later migrations."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
