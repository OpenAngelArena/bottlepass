const Level = require('level');
const path = require('path');
const fs = require('fs');

const Users = require('./users');
const Matches = require('./match');
const MMRBracket = require('./brackets');
const SteamProfile = require('./profile');
const Seasons = require('./seasons');
const MatchState = require('./matchstate');
const Team = require('./team');

module.exports = Models;

const openDatabases = {};

function Models (options) {
  const dbdir = path.join(options.root, 'db');
  try {
    fs.mkdirSync(dbdir);
  } catch (e) {
  }
  const users = Users(options, createDB('users'));
  const matches = Matches(createDB('matches'));
  const profile = SteamProfile(options, createDB('steam_profiles'), users);
  const mmr = MMRBracket(options, createDB('mmr_bracket'), users, profile);
  const seasons = Seasons(options, createDB('seasons'));
  const matchstate = MatchState(createDB('matchstate'));
  const team = Team(options, createDB('team'), users);

  return {
    users: users,
    matches: matches,
    profile: profile,
    seasons: seasons,
    mmr: mmr,
    matchstate: matchstate,
    team: team
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
