#!/usr/bin/env python3
"""Apply explicit category moves without changing project contents or dates."""
import copy
import json
import sys
from pathlib import Path

SUBJECTS = ('physics', 'chemistry', 'biology', 'earth', 'environment', 'tools')


def organize(data):
    result = copy.deepcopy(data)
    if 'groups' not in result:
        if not isinstance(result.get('projects'), list):
            raise ValueError('Expected groups or a legacy project list')
        source = {key: [] for key in SUBJECTS}
        for item in result.pop('projects'):
            subject = item.get('subject', 'tools')
            if subject not in source:
                raise ValueError('Unknown legacy subject')
            source[subject].append(item)
    else:
        if 'projects' in result:
            raise ValueError('Both data formats exist; refusing an ambiguous rewrite')
        source = result['groups']
    if not isinstance(source, dict) or set(source) - set(SUBJECTS):
        raise ValueError('Unknown category; refusing to discard data')
    groups = {key: [] for key in SUBJECTS}
    moved = {key: [] for key in SUBJECTS}
    for subject in SUBJECTS:
        items = source.get(subject, [])
        if not isinstance(items, list):
            raise ValueError('Category must be a list')
        for item in items:
            if not isinstance(item, dict) or not isinstance(item.get('title'), str):
                raise ValueError('Invalid project')
            target = item.get('move_to') or subject
            if target not in groups:
                raise ValueError('Unknown move destination')
            item.pop('move_to', None)
            item['subject'] = target
            (groups if target == subject else moved)[target].append(item)
    for subject in SUBJECTS:
        groups[subject].extend(moved[subject])
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
