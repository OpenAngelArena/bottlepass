const sendJSON = require('send-data/json');

module.exports = TopPlayers;

function TopPlayers (options) {
  return controller;

  function controller (req, res, opts, next) {
    return controllerAsync(req, res, opts)
      .catch(next);
  }

  async function controllerAsync (req, res, opts) {
    var currentBucket = await options.models.mmr.getOrCreate('0');

    sendJSON(req, res, {
      topPlayers: currentBucket.players
    });
  }
}
