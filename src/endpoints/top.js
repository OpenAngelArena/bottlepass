const sendJSON = require('send-data/json');

module.exports = TopPlayers;

function TopPlayers (options) {
  return controller;

  function controller (req, res, opts, next) {
    return controllerAsync(req, res, opts)
      .catch(next);
  }

  async function controllerAsync (req, res, opts) {
    var topGroup = Number(opts.splat.substr(3));

    if (!Number.isFinite(topGroup)) {
      topGroup = 0;
    }
    topGroup = options.models.mmr.bracketForRanking(~~topGroup);

    var currentBucket = await options.models.mmr.getOrCreate('' + topGroup);

    sendJSON(req, res, {
      body: currentBucket.players,
      pretty: true,
      statusCode: 200
    });
  }
}
