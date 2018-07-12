const Joi = require('joi');
const CreateModel = require('./model');
const crypto = require('crypto');

module.exports = MatchState;

MatchState.stateID = stateID;

const PlayerList = Joi.array().items(Joi.object().keys({
  steamid: Joi.string(),
  hero: Joi.string()
})).default([]);

const MatchStateValidator = Joi.object().keys({
  // id as used in API's
  id: Joi.string().required(),
  players: Joi.object().keys({
    radiant: PlayerList,
    dire: PlayerList
  }),

  state: Joi.object()
});

function MatchState (db) {
  var model = CreateModel(MatchStateValidator, 'id', db);

  model.stateID = stateID;

  return model;
}

function stateID (players) {
  const hash = crypto.createHmac('sha256', 'stateaid')
    .update(reduceTeam(players.radiant))
    .update(reduceTeam(players.dire))
    .digest('hex');

  return hash;
}

function reduceTeam (team) {
  return team.sort(function (a, b) {
    return Number(a.steamid) > Number(b.steamid) ? 1 : -1;
  }).reduce(function (memo, val) {
    return memo + val.hero + val.steamid;
  }, '');
}
