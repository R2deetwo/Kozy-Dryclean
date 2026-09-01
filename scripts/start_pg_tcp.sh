#!/bin/bash
# Start embedded Postgres 16 (from pgserver/postgresql-wheel) with TCP on 127.0.0.1:54329
set -e
PGHOME=/home/z/my-project/work/pgvenv/lib/python3.12/site-packages/pgserver/pginstall
export LD_LIBRARY_PATH=$PGHOME/lib:$LD_LIBRARY_PATH
DATA=/home/z/my-project/work/pgdata-tcp
if [ ! -f "$DATA/PG_VERSION" ]; then
  $PGHOME/bin/initdb -D "$DATA" -U postgres --auth=trust -E UTF8 > /home/z/my-project/work/initdb.log 2>&1
  echo "listen_addresses = '127.0.0.1'" >> "$DATA/postgresql.conf"
  echo "port = 54329" >> "$DATA/postgresql.conf"
  echo "unix_socket_directories = '/home/z/my-project/work'" >> "$DATA/postgresql.conf"
fi
$PGHOME/bin/pg_ctl -D "$DATA" -l /home/z/my-project/work/pg-tcp.log -w start
$PGHOME/bin/psql -h 127.0.0.1 -p 54329 -U postgres -c "CREATE DATABASE kozy;" 2>/dev/null || echo "db kozy already exists"
$PGHOME/bin/psql -h 127.0.0.1 -p 54329 -U postgres -c "ALTER USER postgres PASSWORD 'postgres';" 
echo "READY: postgresql://postgres:postgres@127.0.0.1:54329/kozy"
