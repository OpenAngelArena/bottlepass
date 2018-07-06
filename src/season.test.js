const test = require('tape');
const Season = require('./season');
const names = require('american-sounding-names');

test('season methods', function (t) {
  var playerList = [];
  for (let i = 0; i < 1000; ++i) {
    playerList.push(names());
  }
  var result = Season.normalDistribute(playerList, 800, 1300);
  t.ok(result);
  t.end();
});
