const Joi = require('joi');
const CreateModel = require('./model');
const crypto = require('crypto');

module.exports = Match;

const PlayerList = Joi.array().items(Joi.string()).default([]);
const MatchValidator = Joi.object().keys({
  // id as used in API's
  id: Joi.string().required(),

  startTime: Joi.string().required(),
  endTime: Joi.string(),
  gameLength: Joi.number(),

  outcome: Joi.string().optional(),

  players: PlayerList,

  teams: Joi.object().keys({
    dire: PlayerList,
    radiant: PlayerList
  }).default({
    dire: [],
    radiant: []
  })
});

function Match (db) {
  var model = CreateModel(MatchValidator, 'id', db);

  model.getMatchID = getMatchID;

  return model;
}

function getMatchID (startTime, players) {
  const hash = crypto.createHmac('sha256', 'matchid')
    .update(startTime)
    .update(players.reduce((memo, val) => memo + '/' + val, ''))
    .digest('hex');

  return hash;
}
