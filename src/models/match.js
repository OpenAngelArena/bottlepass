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

  stateId: Joi.string().optional().allow(''),
  players: PlayerList,
  hostId: Joi.string(),

  isNewPlayerGame: Joi.boolean().default(false),
  isRankedGame: Joi.boolean().default(true),
  isCaptainsMode: Joi.boolean().default(false),

  teams: Joi.object().keys({
    dire: PlayerList,
    radiant: PlayerList
  }).default({
    dire: [],
    radiant: []
  }),

  banChoices: Joi.object().default({}),
  bans: Joi.array().items(Joi.string()).default([]),

  heroPicks: Joi.object().pattern(Joi.string(), Joi.object().keys({
    hero: Joi.string().required(),
    random: Joi.boolean().required(),
    rerandom: Joi.boolean().required()
  })).default({})
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
