const Promise = require('bluebird');
const Joi = require('joi');
const sendJSON = require('send-data/json');
const Boom = require('boom');
const AuthRequired = require('../auth');

const jsonBody = Promise.promisify(require('body/json'));

module.exports = LoadState;

const PlayerList = Joi.array().items(Joi.object().keys({
  steamid: Joi.string(),
  hero: Joi.string().optional().allow('')
}));
const BodyValidator = Joi.object().keys({
  players: Joi.object().keys({
    dire: PlayerList,
    radiant: PlayerList
  })
});

function LoadState (options) {
  return {
    // GET: getController,
    POST: AuthRequired(options, postController)
  };

  function postController (req, res, opts, cb) {
    postControllerAsync(req, res, opts)
      .catch(cb);
  }

  async function postControllerAsync (req, res, opts) {
    var body = await jsonBody(req, res);

    console.log(body);
    body = BodyValidator.validate(body);

    if (body.error) {
      throw body.error;
    }
    body = body.value;

    var stateId = options.models.matchstate.stateID(body.players);

    try {
      var matchState = await options.models.matchstate.get(stateId);
      console.log(matchState.state);
      console.log(JSON.stringify(matchState.state, null, 2));

      return sendJSON(req, res, matchState);
    } catch (err) {
      console.log(err.notFound, err);
      if (err.notFound) {
        throw Boom.notFound('No saved state was found with those players', err);
      }
      throw err;
    }
  }
}
