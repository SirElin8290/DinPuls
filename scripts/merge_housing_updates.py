"""Merge an already validated fetch into main without overwriting newer municipal checks."""
import argparse
import copy
import json
from datetime import datetime, timezone
from pathlib import Path


def timestamp(row):
    try:
        value = datetime.fromisoformat((row.get('checkedAt') or row.get('updatedAt') or row.get('generatedAt') or '').replace('Z', '+00:00'))
        return value.replace(tzinfo=value.tzinfo or timezone.utc)
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)


def merge(current, candidate):
    result = copy.deepcopy(current)
    rows = result.setdefault('municipalities', {})
    for name, row in candidate.get('municipalities', {}).items():
        if timestamp(row) >= timestamp(rows.get(name, {})):
            rows[name] = copy.deepcopy(row)
    result['generatedAt'] = max(timestamp(current), timestamp(candidate)).isoformat(timespec='seconds')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('candidate', type=Path)
    parser.add_argument('--output', type=Path, default=Path('data/housing.json'))
    args = parser.parse_args()
    current = json.loads(args.output.read_text(encoding='utf-8'))
    candidate = json.loads(args.candidate.read_text(encoding='utf-8'))
    args.output.write_text(json.dumps(merge(current, candidate), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
