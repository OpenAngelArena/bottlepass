const sendJSON = require('send-data/json');
const Boom = require('boom');

const { ActiveMatches } = require('./savestate');

module.exports = ActiveMatchController;

function ActiveMatchController (options) {
  return controller;

  function controller (req, res, opts, next) {
    return controllerAsync(req, res, opts)
      .catch(next);
  }

  async function controllerAsync (req, res, opts) {
    console.log(ActiveMatches);

    sendJSON(req, res, await Promise.all(Object.keys(ActiveMatches)
      .map(async (matchId) => {
        try {
          return await options.models.matches.get(matchId);
        } catch (err) {
          console.log(err.notFound, err);
          if (err.notFound) {
            return null;
          }
          throw err;
        }
      })
    ));
  }
}
