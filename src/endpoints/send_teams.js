const sendJSON = require('send-data/json');
const Jwt = require('jsonwebtoken');
const Promise = require('bluebird');
const Joi = require('joi');
const partial = require('ap').partial;
const AuthRequired = require('../auth');

const jsonBody = Promise.promisify(require('body/json'));

const PlayerEntry = Joi.string();

const SendTeamsValidator = Joi.object().keys({
  dire: Joi.array().items(PlayerEntry),
  radiant: Joi.array().items(PlayerEntry)
});

module.exports = SendTeams;

function SendTeams (options) {
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

    body = SendTeamsValidator.validate(body);

    if (body.error) {
      return cb(body.error);
    }
    body = body.value;

    var match = await options.models.matches.get(req.matchid);
    match.teams.dire = body.dire;
    match.teams.radiant = body.radiant;

    await options.models.matches.put(match);
    await Promise.all(match.players.map(partial(updatePlayerEntry, req.matchid)));

    match = await options.models.matches.get(req.matchid);

    console.log(match);

    sendJSON(req, res, {
      ok: true
    });
  }

  async function updatePlayerEntry (matchid, steamid) {
    var player = await options.models.users.getOrCreate(steamid);

    player.matchesStarted = player.matchesStarted + 1;

    player.matches.push(matchid);

    return options.models.users.put(player);
  }
}
