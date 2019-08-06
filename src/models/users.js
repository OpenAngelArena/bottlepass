const Joi = require('joi');
const Promise = require('bluebird');
const partial = require('ap').partial;
const CreateModel = require('./model');

module.exports = User;

const UserValidator = Joi.object().keys({
  // steamid as used in API's
  steamid: Joi.string().required(),

  matchesStarted: Joi.number().default(0),
  matchesFinished: Joi.number().default(0),
  matchesAbandoned: Joi.number().default(0),

  // match ID they're currently supposedly in
  currentMatch: Joi.string().empty('').default(''),

  // MMR stats
  unrankedMMR: Joi.number().default(1000),

  // string filename of the custom bottle
  customBottle: Joi.string().empty('').default(''),

  matches: Joi.array().items(Joi.string()).default([]),

  daysPlayed: Joi.number().default(0),
  daysPlayedThisMonth: Joi.number().default(0),
  lastMonthPlayed: Joi.number().default(0),
  averageMonthlyDays: Joi.number().default(0),

  bestRanking: Joi.number(),
  seasonPlacings: Joi.number().default(0),

  bottlepassXP: Joi.number().default(0),
  bottlepassLevel: Joi.number().default(0),

  lastGameOfTheDay: Joi.number().default(0),
  lastWinOfTheDay: Joi.number().default(0),

  abandonPenalty: Joi.number().default(0)
});

function User (db) {
  var user = CreateModel(UserValidator, 'steamid', db);

  db.del('undefined');

  user.addUserProperty = partial(addUserProperty, user);
  user.get = adjustMMR(user.get);
  user.getOrCreate = adjustMMR(user.getOrCreate);

  return user;

  function adjustMMR (method) {
    return async function get (id, data) {
      let user = await method(id, data);
      if (user.matchesFinished < 20) {
        user.unrankedMMR = Math.min(user.unrankedMMR, 980 + (user.matchesFinished * 5));
      }
      return user;
    }
  }
}

function addUserProperty (model, name, prop) {
  var oldGet = model.get;
  var oldGetOrCreate = model.getOrCreate;
  var oldPut = model.put;

  model.rawGet = oldGet;
  model.get = getter(oldGet);
  model.getOrCreate = getter(oldGetOrCreate);

  model.put = put;

  function getter (method) {
    return async function get (id, data) {
      return Promise.all([
        method(id, data),
        prop.getOrCreate(id, true)
      ]).spread(function (user, propData) {
        user[name] = propData;

        return user;
      });
    };
  }

  async function put (data) {
    delete data[name];
    return oldPut(data);
  }
}

/*

1 xp for every 2 minutes the game lasts. If the game lasts at least 25 minutes then there is a “Full Game Bonus” which is random between 20-30.
100 xp/level
50% xp bonus for hosting a lobby
+5 First game of the day bonus
+5 first win of the day bonus
100% Bonus XP to everybody in the lobby if someone in the lobby is playing one of their first 3 games

*/

// function levelForExperience (xp) {
//   return ~~(xp / 100);
// }
