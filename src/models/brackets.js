const Joi = require('joi');
const CreateModel = require('./model');
const crypto = require('crypto');
const extend = require('xtend');
const partial = require('ap').partial;

module.exports = MMRBracket;

const BRACKET_BUCKETS = 100;

const PlayerList = Joi.array().items(Joi.string()).default([]);
const MMRBracketValidator = Joi.object().keys({
  // id as used in API's
  bracket: Joi.string().required(),
  players: Joi.object().default({})
});

function MMRBracket (db) {
  var model = CreateModel(MMRBracketValidator, 'bracket', db);

  model.bracketForMMR = bracketForMMR;
  model.updateMMR = partial(updateMMR, model);

  model.BRACKET_BUCKETS = BRACKET_BUCKETS;

  return model;
}

async function updateMMR (model, steamid, previousMMR, mmr) {
  var previousBracket = '' + model.bracketForMMR(previousMMR);
  var newBracket = '' + model.bracketForMMR(mmr);
  var previousModel = await model.getOrCreate(previousBracket);

  if (previousBracket == newBracket) {
    previousModel.players[steamid] = mmr;
    return model.put(previousModel);
  } else {
    previousModel.players[steamid] = null;
    delete previousModel.players[steamid];

    var newModel = await model.getOrCreate(newBracket);

    newModel.players[steamid] = mmr;

    return Promise.all([
      model.put(previousModel),
      model.put(newModel)
    ]);
  }
}

function bracketForMMR (mmr) {
  return mmr - (mmr % BRACKET_BUCKETS);
}
