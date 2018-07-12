const test = require('tape');
const MatchState = require('./matchstate');
const rimraf = require('rimraf');
const path = require('path');
const Level = require('level');

const DB_DIR = path.join(__dirname, '../../test/state');

test('matchstate model', function (t) {
  var db = null;
  t.test('before', function (t) {
    rimraf(DB_DIR, function () {
      db = Level(DB_DIR);
      t.end();
    });
  });
  t.test('basic model', async function (t) {
    const state = MatchState(db);

    t.ok(state, 'can create model');

    t.end();
  });
  t.test('after', function (t) {
    db.close();
    t.end();
  });
});

test('id generation', function (t) {
  var players = testPlayers();

  var id = MatchState.stateID(players);
  players.dire = rearrangeTeam(players.dire);
  players.radiant = rearrangeTeam(players.radiant);
  var newId = MatchState.stateID(players);
  t.equals(id, newId, 'IDs should be the same with players in different order');

  newId = MatchState.stateID(testPlayers());
  t.notEquals(id, newId, 'IDs should be different for ridiculously different teams');

  t.end();
});

function testSteamid () {
  return Math.round(Math.random() * 999999) + 100000;
}

const heroes = [
  'ursa', 'lich', 'io',
  'chen', 'foo', 'bar', 'chrisinajar',
  'example', 'haiku'
];
function testHero () {
  return heroes[~~(Math.random() * heroes.length)];
}
function testPlayer () {
  return {
    hero: testHero(),
    steamid: testSteamid()
  };
}
function testTeam () {
  return [testPlayer(), testPlayer(), testPlayer(), testPlayer(), testPlayer()];
}
function testPlayers () {
  return {
    dire: testTeam(),
    radiant: testTeam()
  };
}
function rearrangeTeam (team) {
  var newTeam = [];
  while (team.length) {
    newTeam.push(team.splice(~~(Math.random() * team.length), 1)[0]);
  }
  return newTeam;
}
