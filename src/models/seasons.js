const Joi = require('joi');
const CreateModel = require('./model');
const { partial } = require('ap');

module.exports = Seasons;

const STATE_ID = 'state';
var mostRecentSeason = 0;

const SeasonStateValidator = Joi.object().keys({
  // id as used in API's
  id: Joi.string().required().allow(STATE_ID),
  currentSeason: Joi.number().default(1),
  nextSeason: Joi.number().default(0),
  nextStep: Joi.number(),

  seasonState: Joi.string().default('running').allow([
    'precallibration',
    'callibration',
    'running'
  ])
});

const SeasonScoreboard = Joi.object().keys({
  // id as used in API's
  season: Joi.number().required().min(1),
  players: Joi.array().items(Joi.object().keys({
    ranking: Joi.number().required(),
    steamid: Joi.string().required(),
    mmr: Joi.number().required(),
    name: Joi.string()
  })).default([])
});

function Seasons (options, db) {
  var stateModel = CreateModel(SeasonStateValidator, 'id', db);
  var topScoresModel = CreateModel(SeasonScoreboard, 'season', db);

  stateModel.getOrCreate(STATE_ID)
    .then((data) => {
      console.log('Starting season', data.currentSeason);
    });

  return {
    getState: partial(getState, stateModel, options),
    setState: partial(setState, stateModel),
    topPlayers: topScoresModel
  };
}

async function getState (model, options) {
  var data = await model.getOrCreate(STATE_ID);

  mostRecentSeason = Math.max(data.currentSeason, mostRecentSeason);

  // don't start new seasons unless I say so.
  if (data.currentSeason < Number(options.currentSeason || 0)) {
    return startSeason(model);
  }

  return data;
}

async function setState (model, data) {
  mostRecentSeason = Math.max(data.currentSeason, mostRecentSeason);
  if (mostRecentSeason > data.currentSeason) {
    throw new Error('Cannot rewind seasons');
  }

  data.id = STATE_ID;
  return model.put(data);
}

async function startSeason (model) {
  var state = await model.get(STATE_ID);

  state.currentSeason++;
  state.seasonState = 'precallibration';
  state.nextStep = state.nextSeason;

  var d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  d.setMonth(d.getMonth() + 6);
  state.nextSeason = d - 0;

  await setState(model, state);

  return state;
}
