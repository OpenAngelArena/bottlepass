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

  // make sure that K values are respected
  t.equal(MMR.getKFactor(1), 80, 'Maxmimum possible K factor is 80');
  t.ok(MMR.getKFactor(501) < 80, 'Maxmimum possible K factor only possible at low MMRs');

  var match = MMR.processScores({
    radiant: [{
      mmr: 1300
    }, {
      mmr: 1300
    }, {
      mmr: 1300
    }, {
      mmr: 1300
    }, {
      mmr: 1300
    }],
    dire: [{
      mmr: 1300
    }, {
      mmr: 1300
    }, {
      mmr: 1300
    }, {
      mmr: 1300
    }, {
      mmr: 1300
    }]
  }, 1, 0);

  console.log(match);

  t.end();
});
