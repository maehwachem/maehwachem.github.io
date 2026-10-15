import copy
import unittest
from organize_projects import KINDS, organize


class ProjectMoves(unittest.TestCase):
    def setUp(self):
        self.data = {'display_order': 'manual', 'show_dates': True,
                     'groups': {subject: [] for subject in KINDS}}
        self.item = {'title': '환경 대응팀', 'subject': 'chemistry',
                     'kind': 'real', 'date': '2026-10-13',
                     'links': [{'label': '수업', 'url': 'https://example.org/'}],
                     'extra': {'preserve': True}}
        self.data['groups']['real'] = [copy.deepcopy(self.item)]
        self.data['groups']['lab'] = [{'title': '기존 물리 자료', 'subject': 'physics'}]

    def test_move_appends_preserving_every_other_field(self):
        for target in KINDS:
            with self.subTest(target=target):
                source = copy.deepcopy(self.data)
                source['groups']['real'][0]['move_to'] = target
                result = organize(source)
                moved = next(p for p in result['groups'][target] if p['title'] == self.item['title'])
                expected = {**self.item, 'kind': target}
                self.assertEqual(moved, expected)
                if target == 'lab':
                    self.assertEqual(result['groups'][target][-1], moved)
                self.assertEqual(sum(map(len, result['groups'].values())), 2)
                self.assertEqual(result, organize(result))
                self.assertIn('move_to', source['groups']['real'][0])

    def test_manual_order_unchanged(self):
        self.data['groups']['real'].append({'title': '첫 번째로 옮긴 항목'})
        self.data['groups']['real'].reverse()
        result = organize(self.data)
        self.assertEqual([p['title'] for p in result['groups']['real']],
                         ['첫 번째로 옮긴 항목', '환경 대응팀'])

    def test_unknown_destination_is_rejected_without_mutation(self):
        self.data['groups']['real'][0]['move_to'] = 'invalid'
        before = copy.deepcopy(self.data)
        with self.assertRaises(ValueError):
            organize(self.data)
        self.assertEqual(self.data, before)

    def test_unknown_group_and_ambiguous_formats_are_rejected(self):
        for change in ({'groups': {'unrecognized': []}}, {'projects': []}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                organize({**self.data, **change})

    def test_legacy_input_and_settings_are_preserved(self):
        result = organize({'display_order': 'newest', 'show_dates': False,
                           'projects': [self.item]})
        self.assertEqual(result['groups']['real'], [self.item])
        self.assertEqual(result['display_order'], 'newest')
        self.assertFalse(result['show_dates'])


if __name__ == '__main__':
    unittest.main()

