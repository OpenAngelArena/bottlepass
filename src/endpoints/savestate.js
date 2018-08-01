const sendJSON = require('send-data/json');
const Promise = require('bluebird');
const Joi = require('joi');
const AuthRequired = require('../auth');

const jsonBody = Promise.promisify(require('body/json'));

module.exports = SaveState;

const PlayerList = Joi.array().items(Joi.object().keys({
  steamid: Joi.string(),
  hero: Joi.string().optional().allow('')
}));
const BodyValidator = Joi.object().keys({
  players: Joi.object().keys({
    dire: PlayerList,
    radiant: PlayerList
  }),
  state: Joi.object()
});

function SaveState (options) {
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

    body = BodyValidator.validate(body);

    if (body.error) {
      throw body.error;
    }
    body = body.value;

    var match = await options.models.matches.get(req.matchid);
    // do stuff with match? i dunnno....
    var stateId = options.models.matchstate.stateID(body.players);

    if (match.stateId !== stateId) {
      match.stateId = stateId;
      options.models.matches.put(match);
    }

    await options.models.matchstate.put({
      id: stateId,
      state: body.state
    });

    sendJSON(req, res, {
      ok: true
    });
  }
}
