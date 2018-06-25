const sendJSON = require('send-data/json');
const Promise = require('bluebird');
const Joi = require('joi');
const partial = require('ap').partial;
const AuthRequired = require('../auth');

const jsonBody = Promise.promisify(require('body/json'));

module.exports = SaveState;

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

    console.log(body);
    console.log(req.matchid);

    var match = await options.models.matches.get(req.matchid);

    await options.models.matchstate.put({
      id: req.matchid,
      state: body
    });

    sendJSON(req, res, {
      ok: true
    });
  }
}
