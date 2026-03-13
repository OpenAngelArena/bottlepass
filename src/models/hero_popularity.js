const Joi = require('joi');
const CreateModel = require('./model');

module.exports = HeroPopularity;

const HeroEntry = Joi.object().keys({
  hero: Joi.string().required(),
  count: Joi.number().required()
});

const HeroPopularityValidator = Joi.object().keys({
  months: Joi.string().required(),
  lastCalculated: Joi.number().default(0),
  picks: Joi.array().items(HeroEntry).default([]),
  bans: Joi.array().items(HeroEntry).default([])
});

function HeroPopularity (db) {
  return CreateModel(HeroPopularityValidator, 'months', db);
}
