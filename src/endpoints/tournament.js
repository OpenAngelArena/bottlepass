const Promise = require('bluebird');
const sendJSON = require('send-data/json');
const Boom = require('boom');
const path = require('path');
const fs = Promise.promisifyAll(require('fs'));
const csv = Promise.promisifyAll(require('csv'));

module.exports = TournamentSeeding;


function TournamentSeeding (options) {
  var teams = {};

  fs.readFileAsync(path.join(__dirname, '../../teams.csv'), {
      encoding: 'utf8'
    })
    .then(csv.parseAsync)
    .then(function (data) {
      data.forEach(function (team) {
        var teamName = team.shift();
        teams[teamName] = [];

        var entry = {};
        var isName = true;

        team.forEach(function (player) {
          if (isName) {
            entry = {
              name: player
            };
            isName = false;
          } else {
            entry.steamid = player;
            if (player.length) {
              teams[teamName].push(entry);
            }
            isName = true;
          }
        })
      });
    });

  return controller;

  function controller (req, res, opts, next) {
    return controllerAsync(req, res, opts)
      .catch(next);
  }

  async function controllerAsync (req, res, opts) {
    var data = await Promise.all(Object.keys(teams).map(async function (teamName) {
      var players = teams[teamName];

      var thisTeam = await Promise.all(players.map(async function (entry) {
        return safeGetUser(entry);
      }));
      thisTeam = {
        players: thisTeam,
        team: teamName
      };
      thisTeam.averageMMR = thisTeam.players.reduce(function (memo, player) {
        return memo + player.unrankedMMR;
      }, 0);
      thisTeam.averageMMR /= thisTeam.players.length;

      return thisTeam;
    }));

    data = data.sort(function (a, b) {
      if (a.averageMMR > b.averageMMR) {
        return -1;
      } else if (a.averageMMR < b.averageMMR) {
        return 1;
      } else {
        return 0;
      }
    });

    data.forEach(function (entry, i) {
      entry.preseed = i + 1;
    });

    return sendJSON(req, res, {
      body: data,
      pretty: true,
      statusCode: 200
    });
  }

  async function safeGetUser (entry) {
    try {
      var data = await options.models.users.rawGet(entry.steamid);
      var profile = await options.models.profile.get(entry.steamid);
      data.name = entry.name;
      data.discordName = profile.name;
      return data;
    } catch (err) {
      if (err.notFound) {
        return {
          steamid: entry.steamid,
          rankedMMR: 1000,
          unrankedMMR: 300,
          discordName: entry.name
        };
      }
      throw err;
    }
  }
}
