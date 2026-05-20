"""
ETL Step 1: DBF → JSON intermediate
อ่าน DBF ทุกไฟล์จาก source dir → เขียน JSON ลง etl/output/

ใช้:
  python3 etl/01-dbf-to-json.py
  python3 etl/01-dbf-to-json.py --source /path/to/Invoice
"""
import os
import sys
import json
import argparse
import shutil
import tarfile
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

try:
    from dbfread import DBF
except ImportError:
    sys.exit("ERROR: pip install dbfread")


DEFAULT_SOURCE = Path(os.environ.get(
    "DBF_SOURCE_DIR",
    "/Users/narutomen/Claude/ออกใบกำกับ/Invoice"
))

ROOT = Path(__file__).parent
OUT_DIR = ROOT / "output"
SNAPSHOT_DIR = ROOT / "snapshots"

ENCODINGS_TRY = ["cp874", "tis-620", "cp1252"]


def open_dbf(path: Path):
    last_err = None
    for enc in ENCODINGS_TRY:
        try:
            t = DBF(
                str(path),
                encoding=enc,
                ignore_missing_memofile=True,
                char_decode_errors="replace",
            )
            _ = t.fields
            return t, enc
        except Exception as e:
            last_err = e
    raise last_err


def json_default(o):
    if isinstance(o, (date, datetime)):
        return o.isoformat()
    if isinstance(o, Decimal):
        return float(o)
    if isinstance(o, bytes):
        try:
            return o.decode("cp874", errors="replace")
        except Exception:
            return o.hex()
    return str(o)


def snapshot_source(source: Path, snapshot_dir: Path) -> Path:
    """tar.gz ของ DBF ทั้งโฟลเดอร์ ก่อน ETL — เผื่อ rollback"""
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out = snapshot_dir / f"dbf_snapshot_{ts}.tar.gz"
    print(f"  -> snapshot: {out}")
    with tarfile.open(out, "w:gz") as tf:
        for p in source.iterdir():
            if p.suffix.lower() in (".dbf", ".cdx", ".fpt", ".dct", ".dcx", ".dbc"):
                tf.add(p, arcname=p.name)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default=str(DEFAULT_SOURCE))
    ap.add_argument("--no-snapshot", action="store_true")
    args = ap.parse_args()

    source = Path(args.source).expanduser().resolve()
    if not source.exists():
        sys.exit(f"ERROR: source not found: {source}")

    print(f"\n=== ETL Step 1: DBF → JSON ===")
    print(f"Source: {source}")
    print(f"Output: {OUT_DIR}\n")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # 1. snapshot
    if not args.no_snapshot:
        snapshot_source(source, SNAPSHOT_DIR)

    # 2. extract
    summary = []
    for path in sorted(source.iterdir()):
        if path.suffix.lower() != ".dbf":
            continue

        try:
            table, enc = open_dbf(path)
        except Exception as e:
            print(f"  [SKIP] {path.name}: {e}")
            continue

        records = []
        for r in table:
            try:
                records.append(dict(r))
            except Exception as e:
                print(f"    [warn] {path.name} bad record: {e}")
                continue

        out_file = OUT_DIR / f"{path.stem}.json"
        with open(out_file, "w", encoding="utf-8") as fp:
            json.dump(
                {
                    "source": path.name,
                    "encoding": enc,
                    "fields": [
                        {
                            "name": f.name,
                            "type": f.type,
                            "length": f.length,
                            "decimal": f.decimal_count,
                        }
                        for f in table.fields
                    ],
                    "records": records,
                },
                fp,
                ensure_ascii=False,
                indent=2,
                default=json_default,
            )

        kb = out_file.stat().st_size / 1024
        print(f"  ✓ {path.name:<25} encoding={enc:<8} records={len(records):>6,}  →  {kb:>8,.1f} KB")
        summary.append({
            "source": path.name,
            "encoding": enc,
            "records": len(records),
            "fields": len(table.fields),
        })

    (OUT_DIR / "_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"\n✓ Done. {len(summary)} tables exported to {OUT_DIR}")


if __name__ == "__main__":
    main()
