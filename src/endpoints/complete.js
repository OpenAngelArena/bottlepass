const sendJSON = require('send-data/json');
const Jwt = require('jsonwebtoken');
const Promise = require('bluebird');
const Joi = require('joi');
const Boom = require('boom');
const MMR = require('../mmr');
const AuthRequired = require('../auth');

const jsonBody = Promise.promisify(require('body/json'));

const PlayerEntry = Joi.string();

const CompleteMatchValidator = Joi.object().keys({
  winner: Joi.string().only('dire', 'radiant'),
  endTime: Joi.string(),
  gameLength: Joi.number(),
  players: Joi.array().items(Joi.string())
});

module.exports = CompleteMatch;

function CompleteMatch (options) {
  return {
    // GET: getController,
    POST: AuthRequired(options, postController)
  };

  function postController (req, res, opts, cb) {
    postControllerAsync(req, res, opts)
      .catch(function (err) {
        console.error(err.stack || err);
        cb(err);
      });
  }

  async function postControllerAsync (req, res, opts) {
    var body = await jsonBody(req, res);

    body = CompleteMatchValidator.validate(body);

    if (body.error) {
      throw body.error;
    }
    body = body.value;

    var match = await options.models.matches.get(req.matchid);

    if (match.outcome) {
      throw Boom.badRequest('This match has already completed');
    }

    console.log(body);
    console.log(req.matchid);

    match.outcome = body.winner;
    match.endTime = body.endTime;
    match.gameLength = body.gameLength;

    await Promise.all(body.players.map(incrementGameCount));

    if (match.players.length == 10) {
      let mmrMatch = {
        radiant: await Promise.all(match.teams.radiant.map(getPlayerEntry)),
        dire: await Promise.all(match.teams.dire.map(getPlayerEntry))
      }
      if (body.winner == 'dire') {
        mmrMatch = MMR.processScores(mmrMatch, 1, 0);
      } else {
        mmrMatch = MMR.processScores(mmrMatch, 0, 1);
      }
      console.log(mmrMatch);
      console.log(match);

      await Promise.all([
        Promise.all(mmrMatch.dire.map(updateMMR)),
        Promise.all(mmrMatch.radiant.map(updateMMR))
      ]);
    }

    await options.models.matches.put(match);

    match = await options.models.matches.get(req.matchid);

    console.log(match);

    sendJSON(req, res, {
      ok: true
    });
  }

  async function updateMMR (data) {
    var player = await options.models.users.getOrCreate(data.steamid);

    await options.models.mmr.updateMMR(player.steamid, player.unrankedMMR, data.adjustedMMR);

    player.unrankedMMR = data.adjustedMMR;

    return options.models.users.put(player);
  }

  async function getPlayerEntry (steamid) {
    var player = await options.models.users.getOrCreate(steamid);

    return {
      mmr: player.unrankedMMR,
      steamid: steamid
    };
  }

  async function incrementGameCount (steamid) {
    var player = await options.models.users.getOrCreate(steamid);

    player.matchesFinished = player.matchesFinished + 1;

    return options.models.users.put(player);
  }
}
