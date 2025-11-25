import os
import sys
from pathlib import Path


def main():
    project_root = Path(__file__).resolve().parents[1]
    sys.path.append(str(project_root))

    # Import inside function to avoid side effects before sys.path adjustment
    from main import bootstrap_schema  # pylint: disable=import-error

    bootstrap_schema()
    print("✅ Database schema migrations completed.")


if __name__ == "__main__":
    main()

