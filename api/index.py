import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "apps" / "api"))

from server.app import app
