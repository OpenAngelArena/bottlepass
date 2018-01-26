const Joi = require('joi');
const CreateModel = require('./model');

module.exports = Profile;

const ProfileValidator = Joi.object().keys({
  // steamid as used in API's
  steamid: Joi.string().required(),

  steam64Id: Joi.string().required(),
  name: Joi.string().required()
});

function Profile (db) {
  return CreateModel(ProfileValidator, 'steamid', db);
}
