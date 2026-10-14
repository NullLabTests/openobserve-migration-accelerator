"""Allow ``python -m openobserve_cost`` to run the CLI without installing."""

from .cli import main

if __name__ == "__main__":
    raise SystemExit(main())
