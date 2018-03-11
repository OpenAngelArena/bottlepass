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

  // match ID they're currently supposedly in
  currentMatch: Joi.string().empty('').default(''),

  // MMR stats
  rankedMMR: Joi.number().default(1000),
  unrankedMMR: Joi.number().default(1000),

  // string filename of the custom bottle
  customBottle: Joi.string().empty('').default(''),

  matches: Joi.array().items(Joi.string()).default([]),

  bestRanking: Joi.number(),
  seasonPlacings: Joi.number().default(0)
});

function User (db) {
  var user = CreateModel(UserValidator, 'steamid', db);

  user.addUserProperty = partial(addUserProperty, user);

  return user;
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
