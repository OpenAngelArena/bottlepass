const Joi = require('joi');
const CreateModel = require('./model');

module.exports = MatchState;

const MatchStateValidator = Joi.object().keys({
  // id as used in API's
  id: Joi.string().required(),

  state: Joi.object()
});

function MatchState (db) {
  var model = CreateModel(MatchStateValidator, 'id', db);

  return model;
}
