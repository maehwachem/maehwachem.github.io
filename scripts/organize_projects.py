#!/usr/bin/env python3
"""Apply explicit category moves without changing project contents or dates."""
import copy
import json
import sys
from pathlib import Path

KINDS = ('lab', 'real', 'game', 'tool', 'lesson')


def organize(data):
    result = copy.deepcopy(data)
    if 'groups' not in result:
        if not isinstance(result.get('projects'), list):
            raise ValueError('Expected groups or a legacy project list')
        source = {key: [] for key in KINDS}
        for item in result.pop('projects'):
            kind = item.get('kind')
            if kind not in source:
                raise ValueError('Unknown legacy kind')
            source[kind].append(item)
    else:
        if 'projects' in result:
            raise ValueError('Both data formats exist; refusing an ambiguous rewrite')
        source = result['groups']
    if not isinstance(source, dict) or set(source) - set(KINDS):
        raise ValueError('Unknown category; refusing to discard data')
    groups = {key: [] for key in KINDS}
    moved = {key: [] for key in KINDS}
    for kind in KINDS:
        items = source.get(kind, [])
        if not isinstance(items, list):
            raise ValueError('Category must be a list')
        for item in items:
            if not isinstance(item, dict) or not isinstance(item.get('title'), str):
                raise ValueError('Invalid project')
            target = item.get('move_to') or kind
            if target not in groups:
                raise ValueError('Unknown move destination')
            item.pop('move_to', None)
            item['kind'] = target
            (groups if target == kind else moved)[target].append(item)
    for kind in KINDS:
        groups[kind].extend(moved[kind])
    result['groups'] = groups
    return result


if __name__ == '__main__':
    path = Path(sys.argv[1] if len(sys.argv) > 1 else 'content/projects.json')
    data = json.loads(path.read_text())
    organized = organize(data)
    if organized != data:
        path.write_text(json.dumps(organized, ensure_ascii=False, indent=2) + '\n')
        print('Applied project category moves.')
    else:
        print('Project categories and order are already consistent.')

