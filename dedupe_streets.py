"""Deduplicate a newline-delimited GeoJSON file by street name.

Reads `data.csv` (NDJSON where each line is a GeoJSON feature), and writes a new
file `data.deduped.csv` that keeps only the first record seen per street.

Usage:
  python dedupe_streets.py

If you want to overwrite the original file, you can rename the output file.
"""

import json
import re

INPUT_PATH = "data.csv"
OUTPUT_PATH = "data.deduped.csv"


def normalize_street(street: str) -> str:
    """Normalize a street string for deduplication."""
    if street is None:
        return ""
    s = street.strip().upper()
    # Collapse whitespace and strip punctuation that tends to vary (e.g. periods)
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\.", "", s)
    return s


def main() -> None:
    seen = set()
    written = 0
    skipped = 0

    with open(INPUT_PATH, "r", encoding="utf-8") as fin, open(OUTPUT_PATH, "w", encoding="utf-8") as fout:
        for line in fin:
            line = line.strip()
            if not line:
                continue

            try:
                feature = json.loads(line)
            except json.JSONDecodeError:
                # Keep malformed lines in output so you can inspect them
                fout.write(line + "\n")
                continue

            street = feature.get("properties", {}).get("street", "")
            norm = normalize_street(street)
            if norm in seen:
                skipped += 1
                continue

            seen.add(norm)
            fout.write(json.dumps(feature, ensure_ascii=False) + "\n")
            written += 1

    print(f"Wrote {written} unique street records to {OUTPUT_PATH} (skipped {skipped} duplicates)")


if __name__ == "__main__":
    main()