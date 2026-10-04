import sqlite3

for db_path in ['confidence.db', 'ai-service/confidence.db']:
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cur.fetchall()
        print(f"DB: {db_path} -> tables: {tables}")
        for t in tables:
            tname = t[0]
            cur.execute(f"SELECT count(*) FROM {tname}")
            cnt = cur.fetchone()[0]
            print(f"  Table {tname}: {cnt} rows")
            if cnt > 0:
                cur.execute(f"SELECT * FROM {tname} LIMIT 1")
                col_names = [d[0] for d in cur.description]
                row = cur.fetchone()
                print(f"    Columns: {col_names}")
                print(f"    Sample: {row}")
    except Exception as e:
        print(f"Error reading {db_path}: {e}")
