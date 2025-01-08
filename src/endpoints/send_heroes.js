const sendJSON = require('send-data/json');
const Promise = require('bluebird');
const Joi = require('joi');
const partial = require('ap').partial;
const AuthRequired = require('../auth');

const jsonBody = Promise.promisify(require('body/json'));

// controller for receiving all the final hero choices for a match
// add them into the match itself and then also update the user objects to increment their pick counts

const SendHeroesValidator = Joi.object().keys({
  // map of steamid -> { hero: string, random: bool, rerandom: bool }
  picks: Joi.object().pattern(Joi.string(), Joi.object().keys({
    hero: Joi.string().required(),
    random: Joi.boolean().required(),
    rerandom: Joi.boolean().required()
  })).required()
});

module.exports = SendHeroes;

function SendHeroes (options) {
  return {
    // GET: getController,
    POST: AuthRequired(options, postController)
  };

  function postController (req, res, opts, cb) {
    postControllerAsync(req, res, opts)
      .catch(cb);
  }

  async function postControllerAsync (req, res, opts) {
    console.log('Authed and ready to rock');

    var body = await jsonBody(req, res);

    console.log(body);
    console.log(req.matchid);

    body = SendHeroesValidator.validate(body);

    if (body.error) {
      throw body.error;
    }
    body = body.value;

    var match = await options.models.matches.get(req.matchid);

    // save data i guess
    match.heroPicks = body.picks;

    await options.models.matches.put(match);

    await Promise.all(Object.keys(body.picks).map(async (steamid) => {
      var user = await options.models.users.getOrCreate(steamid);
      const pickChoice = body.picks[steamid].hero;
      user.heroPicks = user.heroPicks || {};
      user.heroPicks[pickChoice] = (user.heroPicks[pickChoice] || 0) + 1;

      if (Object.keys(user.popularHeroes).length < 5) {
        user.popularHeroes = user.heroPicks || {};
      }
      // 1 point for pickin a hero
      user.popularHeroes[pickChoice] = (user.popularHeroes[pickChoice] || user.heroPicks[pickChoice] || user.heroBans[pickChoice] || 0) + 1;

      await options.models.users.put(user);
    }));

    sendJSON(req, res, {
      ok: true
    });
  }
}
