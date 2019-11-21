const sendJSON = require('send-data/json');

module.exports = HistoryBoard;

function HistoryBoard (options) {
  return controller;

  function controller (req, res, opts, next) {
    return controllerAsync(req, res, opts)
      .catch(next);
  }

  async function controllerAsync (req, res, opts) {
    var players = await options.models.seasons.topPlayers.get(options.currentSeason - 1);

    sendJSON(req, res, {
      body: players,
      pretty: true,
      statusCode: 200
    });
  }
}
