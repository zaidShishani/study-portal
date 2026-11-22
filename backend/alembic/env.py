from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine

import app.models.decks  # noqa: F401  registers tables on Base.metadata
import app.models.events  # noqa: F401
import app.models.notes  # noqa: F401
import app.models.problems  # noqa: F401
import app.models.users  # noqa: F401
from app.core.config import settings
from app.core.db import Base


def run(connection) -> None:
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()


# Tests pass their own connection (test DB); otherwise use DATABASE_URL.
connection = context.config.attributes.get("connection")
if connection is not None:
    run(connection)
else:
    fileConfig(context.config.config_file_name)
    with create_engine(settings.database_url).connect() as conn:
        run(conn)
