const sendJSON = require('send-data/json');

module.exports = TopPlayers;

function TopPlayers (options) {
  return controller;

  function controller (req, res, opts, next) {
    return controllerAsync(req, res, opts)
      .catch(next);
  }

  async function controllerAsync (req, res, opts) {
    var bracket = 1000;
    var currentBucket = await options.models.mmr.getOrCreate(bracket + '');
    var topPlayers = [];

    while (Object.keys(currentBucket.players).length) {
      topPlayers = playersToList(currentBucket.players).concat(topPlayers);
      topPlayers.splice(100);

      bracket = bracket + options.models.mmr.BRACKET_BUCKETS;
      currentBucket = await options.models.mmr.getOrCreate(bracket + '');
    }

    sendJSON(req, res, {
      topPlayers: topPlayers
    });
  }
}

function playersToList (players) {
  return Object.keys(players)
    .map(function (player) {
      return {
        steamid: player,
        mmr: players[player]
      };
    })
    .sort(function (a, b) {
      var diff = a.mmr - b.mmr;

      if (diff === 0) {
        return 0;
      }
      return diff > 0 ? 1 : -1;
    });
}
