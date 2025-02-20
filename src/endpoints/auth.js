const sendJSON = require('send-data/json');
const Jwt = require('jsonwebtoken');
const Promise = require('bluebird');
const Joi = require('joi');
const Boom = require('boom');
const sha = require('sha.js');

// const jsonBody = Promise.promisify(require('body/json'));
const textBody = Promise.promisify(require('body'));

module.exports = Create;

const AuthValidator = Joi.object().keys({
  users: Joi.array().items(Joi.number().min(1)).min(1).required(),
  gametime: Joi.string().required(),
  toolsMode: Joi.boolean().required(),
  cheatsMode: Joi.boolean().required(),
  hostId: Joi.number(),
  authKey: Joi.string(),
  isCM: Joi.boolean().required(),
  isRanked: Joi.boolean().required()
});

function Create (options) {
  return {
    // GET: getController,
    POST: postController
  };

  function postController (req, res, opts, cb) {
    postControllerAsync(req, res, opts)
      .catch(cb);
  }

  async function postControllerAsync (req, res, opts) {
    var text = await textBody(req, res);
    var body = JSON.parse(text);
    console.log(text);

    if (req.headers['auth-checksum'] !== sha('sha256').update(text + options.authkey).digest('hex')) {
      throw Boom.badRequest('Bad auth checksum');
    }
    body = AuthValidator.validate(body);

    if (body.error) {
      throw body.error;
    }
    body = body.value;

    if (body.cheatsMode && !body.toolsMode) {
      throw Boom.badRequest('Cannot use Bottlepass in cheats mode');
    }

    body.users = body.users.map((val) => val + '');
    var users = await Promise.all(body.users.map(async (steamid) => {
      return options.models.users.getOrCreate(steamid);
    }));

    console.log(users);

    var matchid = options.models.matches.getMatchID(body.gametime, body.users);
    console.log('This is a match id', matchid);

    var userData = {};
    var isNewPlayerGame = true;
    var isRankedGame = users.length > 1 && (body.isRanked || body.isCM);

    users.forEach(function (user) {
      if (user.matchesStarted > 3) {
        isNewPlayerGame = false;
      } else {
        // isRankedGame = false;
      }
      userData[user.steamid] = {
        mmr: user.rankedMMR,
        unrankedMMR: user.unrankedMMR,
        bottlepassLevel: user.bottlepassLevel,
        bottle: user.customBottle
      };
    });

    var match = await options.models.matches.getOrCreate(matchid, {
      startTime: body.gametime,
      players: body.users,
      hostId: body.hostId + '',
      isNewPlayerGame: isNewPlayerGame,
      isRankedGame: isRankedGame,
      isCaptainsMode: body.isCM
    });

    var token = await Jwt.sign({
      type: 'match',
      matchid: matchid
    }, options.secret);

    console.log({
      matchid: matchid,
      userData: userData,
      match: match,
      token: token
    });

    sendJSON(req, res, {
      matchid: matchid,
      userData: userData,
      match: match,
      token: token
    });
  }
}
