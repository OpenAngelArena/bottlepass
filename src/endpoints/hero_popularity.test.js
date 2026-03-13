const test = require('tape');
const { parseMatchTime, mapToSortedArray } = require('./hero_popularity');

test('parseMatchTime', function (t) {
  t.test('numeric string timestamps', function (t) {
    var now = Date.now();
    t.equals(parseMatchTime({ startTime: '' + now }), now, 'parses numeric startTime');
    t.equals(parseMatchTime({ endTime: '' + now }), now, 'parses numeric endTime');
    t.equals(parseMatchTime({ startTime: '1500000000000' }), 1500000000000, 'parses large numeric string');
    t.end();
  });

  t.test('date string timestamps', function (t) {
    var dateStr = 'Fri Mar 13 2026 10:30:00 GMT-0700';
    var expected = new Date(dateStr).getTime();
    t.equals(parseMatchTime({ startTime: dateStr }), expected, 'parses date string startTime');
    t.equals(parseMatchTime({ endTime: dateStr }), expected, 'parses date string endTime');
    t.end();
  });

  t.test('prefers endTime over startTime', function (t) {
    t.equals(
      parseMatchTime({ startTime: '1000', endTime: '2000' }),
      2000,
      'uses endTime when both are present'
    );
    t.end();
  });

  t.test('falls back to startTime when endTime is missing or undefined', function (t) {
    t.equals(parseMatchTime({ startTime: '5000' }), 5000, 'uses startTime when no endTime');
    t.equals(
      parseMatchTime({ startTime: '5000', endTime: undefined }),
      5000,
      'uses startTime when endTime is undefined'
    );
    t.end();
  });

  t.test('returns 0 for unparseable or missing data', function (t) {
    t.equals(parseMatchTime({}), 0, 'returns 0 for empty object');
    t.equals(parseMatchTime({ startTime: 'garbage' }), 0, 'returns 0 for garbage startTime');
    t.equals(parseMatchTime({ startTime: 'not-a-date-at-all' }), 0, 'returns 0 for non-date string');
    t.end();
  });
});

test('mapToSortedArray', function (t) {
  t.test('sorts descending by count', function (t) {
    var result = mapToSortedArray({
      hero_a: 5,
      hero_b: 20,
      hero_c: 10
    });
    t.equals(result.length, 3, 'has correct length');
    t.equals(result[0].hero, 'hero_b', 'highest count first');
    t.equals(result[0].count, 20, 'first count is 20');
    t.equals(result[1].hero, 'hero_c', 'second is hero_c');
    t.equals(result[2].hero, 'hero_a', 'third is hero_a');
    t.end();
  });

  t.test('handles empty map', function (t) {
    var result = mapToSortedArray({});
    t.deepEquals(result, [], 'returns empty array for empty map');
    t.end();
  });

  t.test('handles single entry', function (t) {
    var result = mapToSortedArray({ hero_x: 42 });
    t.equals(result.length, 1, 'has one entry');
    t.equals(result[0].hero, 'hero_x', 'correct hero');
    t.equals(result[0].count, 42, 'correct count');
    t.end();
  });
});
