const sendJSON = require('send-data/json');
const Promise = require('bluebird');
const Joi = require('joi');
const MMR = require('../mmr');
const AuthRequired = require('../auth');

const jsonBody = Promise.promisify(require('body/json'));

const PlayerEntry = Joi.string();

const CalculateValidator = Joi.object().keys({
  dire: Joi.array().items(PlayerEntry),
  radiant: Joi.array().items(PlayerEntry)
});

module.exports = Calculate;

function Calculate (options) {
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

    body = CalculateValidator.validate(body);

    if (body.error) {
      throw body.error;
    }
    body = body.value;

    var match = await options.models.matches.get(req.matchid);
    match.dire = await Promise.all(body.dire.map(getPlayerEntry));
    match.radiant = await Promise.all(body.radiant.map(getPlayerEntry));

    sendJSON(req, res, {
      odds: MMR.getExpectedScore(match)
    });
  }

  async function getPlayerEntry (steamid) {
    var player = await options.models.users.getOrCreate(steamid);

    return {
      mmr: player.unrankedMMR,
      steamid: steamid
    };
  }
}
