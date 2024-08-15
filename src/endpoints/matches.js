const sendJSON = require('send-data/json');
const Boom = require('boom');

module.exports = Matches;

function Matches (options) {
  return controller;

  function controller (req, res, opts, next) {
    return controllerAsync(req, res, opts)
      .catch(next);
  }

  async function controllerAsync (req, res, opts) {
    var matchId = opts.splat;

    try {
      var match = await options.models.matches.get(matchId);

      return sendJSON(req, res, match);
    } catch (err) {
      console.log(err.notFound, err);
      if (err.notFound) {
        throw Boom.notFound('Match with that id not found', err);
      }
      throw err;
    }
  }
}
