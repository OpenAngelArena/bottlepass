const sendJSON = require('send-data/json');
// const Boom = require('boom');

const { ActiveMatches } = require('./savestate');

module.exports = ActiveMatchController;

function ActiveMatchController (options) {
  return controller;

  function controller (req, res, opts, next) {
    return controllerAsync(req, res, opts)
      .catch(next);
  }

  async function controllerAsync (req, res, opts) {
    return sendJSON(req, res, await Promise.all(Object.keys(ActiveMatches)
      .map(async (matchId) => {
        try {
          const match = await options.models.matches.get(matchId);
          let state = null;
          if (match.stateId) {
            try {
              state = await options.models.matchstate.get(match.stateId);
            } catch (err) {
              // don't care
            }
          }

          return {
            matchId,
            match,
            score: state ? state.state.points : null,
            time: state ? state.state.time : null
          };
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
