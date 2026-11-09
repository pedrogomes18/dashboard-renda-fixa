import os
import tempfile
from pathlib import Path

# Banco SQLite temporário: precisa ser definido antes de importar app.db.
_tmp = Path(tempfile.mkdtemp()) / "teste.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.as_posix()}"
