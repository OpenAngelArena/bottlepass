const sendJSON = require('send-data/json');
const Promise = require('bluebird');
const Joi = require('joi');
const AuthRequired = require('../auth');

const jsonBody = Promise.promisify(require('body/json'));

const SendBansValidator = Joi.object().keys({
  banChoices: Joi.object(),
  bans: Joi.array().items(Joi.string())
});

module.exports = SendBans;

function SendBans (options) {
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

    body = SendBansValidator.validate(body);

    if (body.error) {
      throw body.error;
    }
    body = body.value;

    var match = await options.models.matches.get(req.matchid);

    // save data i guess
    match.bans = body.bans;
    match.banChoices = body.banChoices;

    await options.models.matches.put(match);

    await Promise.all(Object.keys(body.banChoices).map(async (steamid) => {
      var user = await options.models.users.getOrCreate(steamid);
      const banChoice = body.banChoices[steamid];
      user.popularHeroes = user.popularHeroes || {};
      user.heroBans = user.heroBans || {};
      user.heroPicks = user.heroPicks || {};

      user.heroBans[banChoice] = Math.round((user.heroBans[banChoice] || 0) + 1);

      if (Object.keys(user.popularHeroes).length < 5) {
        user.popularHeroes = {...user.heroPicks} || {};
      }
      // half a point for banning a hero
      user.popularHeroes[banChoice] = (user.popularHeroes[banChoice] || user.heroPicks[banChoice] || user.heroBans[banChoice] || 0) + 0.5;

      await options.models.users.put(user);
    }));

    sendJSON(req, res, {
      ok: true
    });
  }
}
