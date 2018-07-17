const test = require('tape');
const Seasons = require('./seasons');
const rimraf = require('rimraf');
const path = require('path');
const Level = require('level');

const DB_DIR = path.join(__dirname, '../../test/sessions');
var options = {
  startSeason: true
};

test('seasons model', function (t) {
  var db = null;
  t.test('before', function (t) {
    rimraf(DB_DIR, function () {
      db = Level(DB_DIR);
      t.end();
    });
  });
  t.test('basic model', async function (t) {
    const season = Seasons(options, db);

    t.ok(season, 'can create model');

    var state = await season.getState();
    t.ok(state, 'can get state');
    t.ok(state.currentSeason > 0, 'has a current season');
    t.equal(state.seasonState, 'precallibration', 'can save current season');

    state.currentSeason = 2;

    await season.setState(state);
    state = await season.getState();
    t.equal(state.currentSeason, 2, 'can save current season');
    await season.setState({ currentSeason: 1 })
      .then(t.fail)
      .catch(t.ok);

    t.end();
  });
  t.test('after', function (t) {
    db.close();
    t.end();
  });
});
