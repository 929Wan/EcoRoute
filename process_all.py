#!/usr/bin/env python3
import json
import re
import sys

INPUT_PATH = "vsls:/data.csv"
OUTPUT_PATH = "vsls:/streets_deduplicated.txt"

def normalize_street(street):
    """Normalize a street string for deduplication."""
    if street is None or not street:
        return ""
    s = str(street).strip().upper()
    # Collapse whitespace
    s = re.sub(r"\s+", " ", s)
    # Remove trailing punctuation
    s = re.sub(r"\.", "", s)
    return s

def main():
    seen = set()
    written = 0
    skipped = 0
    total_lines = 0
    
    print(f"Reading from: {INPUT_PATH}")
    print(f"Writing to: {OUTPUT_PATH}")
    print()
    
    # First pass: count lines
    try:
        with open(INPUT_PATH, "r", encoding="utf-8") as f:
            total_lines = sum(1 for _ in f)
        print(f"Total lines in file: {total_lines}")
    except Exception as e:
        print(f"ERROR counting lines: {e}")
        return
    
    # Second pass: process all records
    try:
        with open(INPUT_PATH, "r", encoding="utf-8") as fin, \
             open(OUTPUT_PATH, "w", encoding="utf-8") as fout:
            
            for line_num, line in enumerate(fin, 1):
                line = line.strip()
                
                if not line:
                    continue
                
                try:
                    feature = json.loads(line)
                except json.JSONDecodeError:
                    skipped += 1
                    continue
                
                street = feature.get("properties", {}).get("street", "")
                norm = normalize_street(street)
                
                # Skip empty streets
                if not norm:
                    skipped += 1
                    continue
                
                # Skip duplicates
                if norm in seen:
                    skipped += 1
                    continue
                
                # Write unique street
                seen.add(norm)
                fout.write(street + "\n")
                written += 1
                
                # Progress every 5000 lines
                if line_num % 5000 == 0:
                    print(f"Progress: {line_num:,} / {total_lines:,} lines processed... ({written:,} unique streets found)")
        
        print()
        print("=" * 60)
        print(f"✓ COMPLETE!")
        print("=" * 60)
        print(f"Total lines processed: {total_lines:,}")
        print(f"Unique streets found: {written:,}")
        print(f"Duplicates removed: {skipped:,}")
        print(f"Output file: {OUTPUT_PATH}")
        print("=" * 60)
        
    except Exception as e:
        print(f"ERROR during processing: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
