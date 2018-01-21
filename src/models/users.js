const Joi = require('joi');
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

  matches: Joi.array().items(Joi.string()).default([])
});

function User (db) {
  return CreateModel(UserValidator, 'steamid', db);
}
