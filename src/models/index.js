const Level = require('level');
const path = require('path');
const fs = require('fs');

const Users = require('./users');
const Matches = require('./match');
const MMRBracket = require('./brackets');
const SteamProfile = require('./profile');
const Seasons = require('./seasons');
const MatchState = require('./matchstate');

module.exports = Models;

const openDatabases = {};

function Models (options) {
  var dbdir = path.join(options.root, 'db');
  try {
    fs.mkdirSync(dbdir);
  } catch (e) {
  }
  var users = Users(createDB('users'));
  var matches = Matches(createDB('matches'));
  var profile = SteamProfile(options, createDB('steam_profiles'), users);
  var mmr = MMRBracket(createDB('mmr_bracket'), users, profile);
  var seasons = Seasons(options, createDB('seasons'));
  var matchstate = MatchState(createDB('matchstate'));

  return {
    users: users,
    matches: matches,
    mmr: mmr,
    profile: profile,
    seasons: seasons,
    matchstate: matchstate
  };

  function createDB (name) {
    if (openDatabases[name]) {
      return openDatabases[name];
    }
    var thisDbdir = path.join(dbdir, name);
    try {
      fs.mkdirSync(thisDbdir);
    } catch (e) {
    }
    var db = Level(thisDbdir);
    openDatabases[name] = db;
    return db;
  }
}
