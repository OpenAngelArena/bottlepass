const Joi = require('joi');
const CreateModel = require('./model');
const crypto = require('crypto');

module.exports = Team;

const PlayerList = Joi.array().items(Joi.string()).default([]);
const TeamValidator = Joi.object().keys({
  // id as used in API's
  id: Joi.string().required(),

  name: Joi.string().required(),
  captain: Joi.string().required(),

  players: PlayerList,
  standins: PlayerList
});

function Team (options, db, users) {
  var model = CreateModel(TeamValidator, 'id', db);
  users.addUserProperty('team', model, async function mapUserToProp(id, userPromise) {
    const user = await userPromise;
    return user.teamId;
  });

  return model;
}
