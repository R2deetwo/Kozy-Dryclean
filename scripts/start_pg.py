#!/usr/bin/env python3
"""Start an embedded Postgres server (pgserver) for local Kozy dev.

Keeps running in the foreground. The data dir persists at
/home/z/my-project/work/pgdata so restarts keep the data.
Prints the connection URI on stdout when ready.
"""
import sys
import os

sys.path.insert(0, "/home/z/my-project/work/pgvenv/lib/python3.12/site-packages")

import pgserver

DATA_DIR = "/home/z/my-project/work/pgdata"

if __name__ == "__main__":
    db = pgserver.get_server(DATA_DIR)
    uri = db.get_uri()
    # Normalize host for external TCP connections (defaults work for prisma)
    print("PG_URI=" + uri, flush=True)
    # Also create the kozy database if missing
    import subprocess
    psql = db.psql
    try:
        db.psql("CREATE DATABASE kozy;", ignore_error=True)
        print("DATABASE kozy ready", flush=True)
    except Exception as e:
        print("db create note:", e, flush=True)
    # Keep alive forever
    import time
    while True:
        time.sleep(3600)
