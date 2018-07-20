const sendJSON = require('send-data/json');
const Promise = require('bluebird');
const Joi = require('joi');
const Boom = require('boom');
const partial = require('ap').partial;
const MMR = require('../mmr');
const AuthRequired = require('../auth');

const jsonBody = Promise.promisify(require('body/json'));

const CompleteMatchValidator = Joi.object().keys({
  winner: Joi.string().only('dire', 'radiant'),
  endTime: Joi.string().required(),
  gameLength: Joi.number().min(1).required(),
  players: Joi.array().items(Joi.string()).required(),
  abandoned: Joi.array().items(Joi.string()).required(),
  isValid: Joi.boolean()
});

module.exports = CompleteMatch;

function CompleteMatch (options) {
  return {
    // GET: getController,
    POST: AuthRequired(options, postController)
  };

  function postController (req, res, opts, cb) {
    postControllerAsync(req, res, opts)
      .catch(function (err) {
        console.error(err.stack || err);
        cb(err);
      });
  }

  async function postControllerAsync (req, res, opts) {
    var body = await jsonBody(req, res);
    console.log(body);
    body = CompleteMatchValidator.validate(body);

    if (body.error) {
      throw body.error;
    }
    body = body.value;

    var match = await options.models.matches.get(req.matchid);

    if (match.outcome) {
      throw Boom.badRequest('This match has already completed');
    }

    console.log(body);
    console.log(req.matchid);

    match.outcome = body.winner;
    match.endTime = body.endTime;
    match.gameLength = body.gameLength;
    match.hostId = match.hostId + '';

    var connectedPlayers = {};

    body.players.forEach(function (steamid) {
      steamid = steamid + '';
      connectedPlayers[steamid] = steamid;
    });
    var abandonedPlayers = {};

    body.abandoned.forEach(function (steamid) {
      steamid = steamid + '';
      abandonedPlayers[steamid] = steamid;
    });
    var playerDiffs = [];

    if (match.players.length === 10 && body.players.length >= 4) {
      if (match.isRankedGame && match.gameLength > 600 && body.isValid) {
        let mmrMatch = {
          radiant: await Promise.all(match.teams.radiant.map(getPlayerEntry)),
          dire: await Promise.all(match.teams.dire.map(getPlayerEntry))
        };
        if (body.winner === 'dire') {
          mmrMatch = MMR.processScores(mmrMatch, 1, 0);
        } else {
          mmrMatch = MMR.processScores(mmrMatch, 0, 1);
        }
        console.log(mmrMatch);
        console.log(match);

        playerDiffs = await Promise.all([
          Promise.all(mmrMatch.dire.map(partial(endRankedGame, connectedPlayers, abandonedPlayers, match, (body.winner === 'dire')))),
          Promise.all(mmrMatch.radiant.map(partial(endRankedGame, connectedPlayers, abandonedPlayers, match, (body.winner === 'radiant'))))
        ]);
        playerDiffs = playerDiffs[0].concat(playerDiffs[1]);

        options.models.mmr.updateMMR();
      } else {
        playerDiffs = await Promise.all(body.players.map(partial(endFullUnrankedGame, match, abandonedPlayers)));
      }
    } else {
      await Promise.all(body.players.map(endUnrankedGame));
    }

    await options.models.matches.put(match);

    match = await options.models.matches.get(req.matchid);

    console.log(match);
    console.log(playerDiffs);

    sendJSON(req, res, {
      playerDiffs: playerDiffs,
      ok: true
    });
  }

  async function endRankedGame (connectedPlayers, abandonedPlayers, match, didWin, mmrData) {
    var player = await options.models.users.getOrCreate(mmrData.steamid + '');
    if (!Number.isFinite(mmrData.adjustedMMR)) {
      mmrData.adjustedMMR = player.unrankedMMR;
    }
    var playerDiff = {
      steamid: player.steamid + '',
      mmrDiff: mmrData.adjustedMMR - player.unrankedMMR,
      mmr: mmrData.adjustedMMR
    };

    player.unrankedMMR = mmrData.adjustedMMR;

    if (connectedPlayers[player.steamid]) {
      player.matchesFinished = player.matchesFinished + 1;
      if (player.abandonPenalty > 0) {
        player.abandonPenalty -= 1;
      } else {
        playerDiff.bottlepass = updateBottlepass(player, match, didWin);
      }
    }
    if (abandonedPlayers[player.steamid]) {
      player.matchesAbandoned += 1;
      player.abandonPenalty += 2;
    }

    await options.models.users.put(player);
    return playerDiff;
  }

  async function endFullUnrankedGame (match, abandonedPlayers, steamid) {
    var player = await options.models.users.getOrCreate(steamid + '');
    var winningTeam = match.outcome === 'radiant' ? match.teams.radiant : match.teams.dire;
    var didWin = winningTeam.indexOf(player.steamid) !== -1;
    var bottleDiff = 0;

    player.matchesFinished = player.matchesFinished + 1;
    if (player.abandonPenalty > 0) {
      player.abandonPenalty -= 1;
    } else {
      bottleDiff = updateBottlepass(player, match, didWin);
    }

    await options.models.users.put(player);

    return {
      steamid: player.steamid,
      mmrDiff: 0,
      mmr: player.unrankedMMR,
      bottlepass: bottleDiff
    };
  }

  async function getPlayerEntry (steamid) {
    steamid = steamid + '';
    var player = await options.models.users.getOrCreate(steamid);

    return {
      mmr: player.unrankedMMR,
      steamid: steamid
    };
  }

  async function endUnrankedGame (steamid) {
    steamid = steamid + '';
    var player = await options.models.users.getOrCreate(steamid);

    player.matchesFinished = player.matchesFinished + 1;

    return options.models.users.put(player);
  }

  /*

  1 xp for every 2 minutes the game lasts. If the game lasts at least 25 minutes then there is a “Full Game Bonus” which is random between 20-30.
  100 xp/level
  50% xp bonus for hosting a lobby
  +5 First game of the day bonus
  +5 first win of the day bonus
  100% Bonus XP to everybody in the lobby if someone in the lobby is playing one of their first 3 games

  */

  function updateBottlepass (player, match, didWin) {
    var isHost = player.steamid === match.hostId;
    var isNewPlayerGame = match.isNewPlayerGame;
    var isFullGame = match.gameLength > (25 * 60);
    var fullGameXP = isFullGame ? Math.random() * 10 + 20 : 0;
    var minutesXP = ~~(match.gameLength / 120);
    var isFirstGameToday = Date.now() > player.lastGameOfTheDay + (1000 * 60 * 60 * 24);
    var isFirstWinToday = didWin && Date.now() > player.lastWinOfTheDay + (1000 * 60 * 60 * 24);

    var experience = (minutesXP + fullGameXP + (isFirstGameToday ? 5 : 0) + (isFirstWinToday ? 5 : 0));
    if (isHost) {
      experience *= 1.5;
    }
    if (isNewPlayerGame) {
      experience *= 2;
    }

    var oldXP = player.bottlepassXP;
    player.bottlepassXP += ~~experience;
    player.bottlepassXP = Math.min(100 * 100, player.bottlepassXP);
    var oldLevel = player.bottlepassLevel;
    player.bottlepassLevel = Math.min(100, ~~(player.bottlepassXP / 100));

    if (isFirstWinToday) {
      player.lastWinOfTheDay = Date.now();
    }
    if (isFirstGameToday) {
      player.lastGameOfTheDay = Date.now();
    }

    console.log('I won!', player.steamid, didWin, experience);

    return {
      xp: player.bottlepassXP - oldXP,
      levelUp: player.bottlepassLevel - oldLevel
    };
  }
}
