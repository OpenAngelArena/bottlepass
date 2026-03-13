const test = require('tape');
const { parseMatchTime, parseTimestamp, mapToSortedArray } = require('./hero_popularity');

test('parseTimestamp', function (t) {
  t.test('numeric strings', function (t) {
    t.equals(parseTimestamp('1500000000000'), 1500000000000, 'parses millisecond timestamp');
    t.equals(parseTimestamp('12345'), 12345, 'parses small number');
    t.end();
  });

  t.test('JS date strings', function (t) {
    var dateStr = 'Fri Mar 13 2026 10:30:00 GMT-0700';
    var expected = new Date(dateStr).getTime();
    t.equals(parseTimestamp(dateStr), expected, 'parses JS date string');
    t.end();
  });

  t.test('OAA game client format (MM/DD/YYHH:MM:SS)', function (t) {
    var result = parseTimestamp('08/14/2415:12:11');
    var expected = new Date(2024, 7, 14, 15, 12, 11).getTime();
    t.equals(result, expected, 'parses OAA format correctly');

    result = parseTimestamp('01/08/2516:03:41');
    expected = new Date(2025, 0, 8, 16, 3, 41).getTime();
    t.equals(result, expected, 'parses OAA format with leading zeros');

    result = parseTimestamp('12/31/2923:59:59');
    expected = new Date(2029, 11, 31, 23, 59, 59).getTime();
    t.equals(result, expected, 'parses end-of-year edge case');
    t.end();
  });

  t.test('returns 0 for bad input', function (t) {
    t.equals(parseTimestamp(null), 0, 'returns 0 for null');
    t.equals(parseTimestamp(undefined), 0, 'returns 0 for undefined');
    t.equals(parseTimestamp(''), 0, 'returns 0 for empty string');
    t.equals(parseTimestamp('garbage'), 0, 'returns 0 for garbage');
    t.equals(parseTimestamp('not-a-date-at-all'), 0, 'returns 0 for non-date string');
    t.end();
  });
});

test('parseMatchTime', function (t) {
  t.test('prefers endTime over startTime', function (t) {
    t.equals(
      parseMatchTime({ startTime: '1000', endTime: '2000' }),
      2000,
      'uses endTime when both are present'
    );
    t.end();
  });

  t.test('falls back to startTime', function (t) {
    t.equals(parseMatchTime({ startTime: '5000' }), 5000, 'uses startTime when no endTime');
    t.equals(
      parseMatchTime({ startTime: '5000', endTime: undefined }),
      5000,
      'uses startTime when endTime is undefined'
    );
    t.end();
  });

  t.test('handles OAA format in match objects', function (t) {
    var expected = new Date(2024, 7, 14, 15, 53, 33).getTime();
    t.equals(
      parseMatchTime({ startTime: '08/14/2415:53:33', endTime: '08/14/2415:56:24' }),
      new Date(2024, 7, 14, 15, 56, 24).getTime(),
      'prefers endTime in OAA format'
    );
    t.equals(
      parseMatchTime({ startTime: '08/14/2415:53:33' }),
      expected,
      'falls back to startTime in OAA format'
    );
    t.end();
  });

  t.test('returns 0 when nothing is parseable', function (t) {
    t.equals(parseMatchTime({}), 0, 'returns 0 for empty object');
    t.equals(parseMatchTime({ startTime: 'garbage' }), 0, 'returns 0 for garbage');
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
