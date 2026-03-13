const sendJSON = require('send-data/json');
const parseUrl = require('url').parse;

module.exports = HeroPopularity;
HeroPopularity.parseMatchTime = parseMatchTime;
HeroPopularity.mapToSortedArray = mapToSortedArray;

var TOP_PLAYERS = 1000;
var MS_PER_DAY = 1000 * 60 * 60 * 24;

function HeroPopularity (options) {
  return controller;

  function controller (req, res, opts, next) {
    return controllerAsync(req, res, opts)
      .catch(next);
  }

  async function controllerAsync (req, res, opts) {
    var query = parseUrl(req.url, true).query;
    var months = Math.max(1, Math.min(12, parseInt(query.months, 10) || 3));
    var monthsKey = '' + months;

    var cached = null;
    try {
      cached = await options.models.heroPopularity.get(monthsKey);
    } catch (err) {
      if (!err.notFound) {
        throw err;
      }
    }

    if (cached && (Date.now() - cached.lastCalculated) < months * MS_PER_DAY) {
      return sendJSON(req, res, cached);
    }

    var result = await recalculate(months);
    return sendJSON(req, res, result);
  }

  async function recalculate (months) {
    var cutoff = Date.now() - (months * 30 * MS_PER_DAY);
    var bracket0 = await options.models.mmr.getOrCreate('0');
    var topPlayers = bracket0.players.slice(0, TOP_PLAYERS);

    var picks = {};
    var bans = {};
    var seenMatches = {};

    for (var i = 0; i < topPlayers.length; i++) {
      var player;
      try {
        player = await options.models.users.rawGet(topPlayers[i].steamid);
      } catch (err) {
        if (err.notFound) continue;
        throw err;
      }

      if (player.lastGameOfTheDay < cutoff) continue;
      if (!player.matches || !player.matches.length) continue;

      for (var j = player.matches.length - 1; j >= 0; j--) {
        var matchId = player.matches[j];
        if (seenMatches[matchId]) continue;

        var match;
        try {
          match = await options.models.matches.get(matchId);
        } catch (err) {
          if (err.notFound) continue;
          throw err;
        }

        var matchTime = parseMatchTime(match);
        if (!matchTime) continue;
        if (matchTime < cutoff) break;

        seenMatches[matchId] = true;

        if (match.heroPicks) {
          var steamids = Object.keys(match.heroPicks);
          for (var k = 0; k < steamids.length; k++) {
            var hero = match.heroPicks[steamids[k]].hero;
            if (hero) {
              picks[hero] = (picks[hero] || 0) + 1;
            }
          }
        }

        if (match.banChoices) {
          var banSteamids = Object.keys(match.banChoices);
          for (var b = 0; b < banSteamids.length; b++) {
            var bannedHero = match.banChoices[banSteamids[b]];
            if (bannedHero) {
              bans[bannedHero] = (bans[bannedHero] || 0) + 1;
            }
          }
        }
      }
    }

    var result = {
      months: '' + months,
      lastCalculated: Date.now(),
      picks: mapToSortedArray(picks),
      bans: mapToSortedArray(bans)
    };

    await options.models.heroPopularity.put(result);
    return result;
  }
}

function mapToSortedArray (map) {
  return Object.keys(map)
    .map(function (hero) {
      return { hero: hero, count: map[hero] };
    })
    .sort(function (a, b) {
      return b.count - a.count;
    });
}

function parseMatchTime (match) {
  if (match.endTime) {
    var end = Number(match.endTime);
    if (Number.isFinite(end)) return end;
    var endDate = new Date(match.endTime).getTime();
    if (Number.isFinite(endDate)) return endDate;
  }
  if (match.startTime) {
    var start = Number(match.startTime);
    if (Number.isFinite(start)) return start;
    var startDate = new Date(match.startTime).getTime();
    if (Number.isFinite(startDate)) return startDate;
  }
  return 0;
}
