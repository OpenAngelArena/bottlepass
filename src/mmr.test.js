const test = require('tape');
const MMR = require('./mmr');

test('mmr', function (t) {
  t.equals(MMR.MAX_K, MMR.getKFactor(1), 'lowest MMR gets k 64');
  t.equals(MMR.MAX_K / 4, MMR.getKFactor(999999), 'grandmasters gets k 16');

  t.equals(0.5, MMR.getElo(1, 1), 'same scores have 50 50 change of winning');
  t.equals(0.5, MMR.getElo(100, 100), 'same scores have 50 50 change of winning');
  t.equals(0.5, MMR.getElo(500, 500), 'same scores have 50 50 change of winning');
  t.equals(0.5, MMR.getElo(1000, 1000), 'same scores have 50 50 change of winning');
  t.equals(0.5, MMR.getElo(100000, 100000), 'same scores have 50 50 change of winning');
  t.ok(MMR.getElo(500, 200) > 0.5, 'elo is > 0.5 when first value is higher');
  t.equals(1, MMR.getElo(500, 200) + MMR.getElo(200, 500), 'elo values add up to 1');
  t.end();
});
