const Promise = require('bluebird');
const sendJSON = require('send-data/json');
const sendBoom = require('send-boom');
const Boom = require('boom');
const redirect = require('redirecter');
const { partial } = require('ap');
const uuidv4 = require('uuid/v4');
const parseUrl = require('url').parse;
const { createToken } = require('./oauth');

const jsonBody = Promise.promisify(require('body/json'));

const AuthRequired = require('../auth');

module.exports = OAuth;

function OAuth (options) {
  const postMethods = {
    create,
    createInvite,
    join,
    acceptInvite,
    rejectInvite,
    removePlayer: rejectInvite,
    leaveTeam,
    updateTeam,
  };
  const getMethods = {
    invite: getInvite,
    checkInvite,
    view,
    list: listTeams
  };

  return {
    GET: AuthRequired(options, partial(controller, getMethods), { type: 'user' }),
    // GET: partial(controller, getMethods),
    POST: AuthRequired(options, partial(controller, postMethods), { type: 'user' })
  };

  function controller (methods, req, res, opts, next) {
    var method = opts.splat;
    console.log('Looking up action', method, 'methods');
    if (methods[method]) {
      const result = methods[method](req, res, opts, next);
      if (result && result.catch) {
        return result.catch(next);
      }
      return result;
    }
    sendBoom(req, res, Boom.badRequest('Unknown action ' + method));
  }

  async function create (req, res, opts) {
    const body = await jsonBody(req, res);
    let user = await options.models.users.getOrCreate(req.auth.user.steamid);

    const teamId = (user.teamId && user.teamId.length) ? user.teamId : uuidv4();
    const { profile } = user;
    user.teamId = teamId;
    await options.models.users.put(user);
    const team = await options.models.team.put({
      id: teamId,
      name: body.name,
      captain: user.steamid,
      players: [{...profile,
        confirmed: true,
        mmr: user.unrankedMMR,
        standin: true
      }]
    });

    user = await options.models.users.getOrCreate(req.auth.user.steamid);

    sendJSON(req, res, {
      team,
      token: await createToken(options, user)
    });
  }

  async function createInvite (req, res, opts) {
    const user = await options.models.users.getOrCreate(req.auth.user.steamid);
    const teamId = user.teamId;

    const team = await options.models.team.getOrCreate(teamId);

    team.invite = options.models.team.generateInvite();
    await options.models.team.put(team);

    sendJSON(req, res, {
      token: team.invite
    });
  }

  async function getInvite (req, res, opts) {
    const user = await options.models.users.getOrCreate(req.auth.user.steamid);
    const teamId = user.teamId;

    const team = await options.models.team.getOrCreate(teamId);

    if (!team.invite) {
      team.invite = options.models.team.generateInvite();
      await options.models.team.put(team);
    }

    sendJSON(req, res, {
      token: team.invite
    });
  }

  async function checkInvite (req, res, opts) {
    const { token } = parseUrl(req.url, true).query;

    const team = await options.models.team.findTeamByInvite(token);

    delete team.invite;

    sendJSON(req, res, {
      team
    });
  }

  async function join (req, res, opts) {
    const user = await options.models.users.getOrCreate(req.auth.user.steamid);
    const { token } = await jsonBody(req, res);
    const team = await options.models.team.findTeamByInvite(token);

    team.players = team.players.filter((player) => player.steamid !== user.steamid);
    team.players.push({...user.profile,
      confirmed: false,
      mmr: user.unrankedMMR,
      standin: false
    });

    await options.models.team.put(team);

    sendJSON(req, res, {
      team
    });
  }

  async function view (req, res, opts) {
    const { id } = parseUrl(req.url, true).query;

    if (!id) {
      throw Boom.badRequest('Team ID is required');
    }

    const team = await options.models.team.get(id);
    delete team.invite;

    sendJSON(req, res, {
      team
    });
  }

  async function listTeams (req, res, opts) {
    const { steamid } = parseUrl(req.url, true).query;
    const playerCache = {};

    async function getPlayer (player) {
      const user = await options.models.users.rawGet(player.steamid);
      return {...player,
        mmr: user.unrankedMMR
      };
    }

    const data = await new Promise((resolve, reject) => {
      const found = [];
      options.models.team.createReadStream()
        .on('data', function (data) {
          const teamData = JSON.parse(data.value);
          delete teamData.invite;
          let isThisOne = false;

          if (steamid) {
            const entry = teamData.players.filter(p => p.steamid === steamid);
            if (entry.length) {
              isThisOne = true;
            }
          } else {
            isThisOne = true;
          }

          if (isThisOne) {
            teamData.players = teamData.players.map(async (player) => {
              if (playerCache[player.steamid]) {
                return playerCache[player.steamid];
              }
              playerCache[player.steamid] = await getPlayer(player);
              return playerCache[player.steamid];
            });
            found.push(teamData);
          }
        })
        .on('error', function (err) {
          if (!found) {
            reject(err);
          }
        })
        .on('end', async function () {
          resolve(found);
        });
    });
    await Promise.all(data.map(async (team) => {
      team.players = await Promise.all(team.players);
    }));
    sendJSON(req, res, {
      data
    });
  }

  async function acceptInvite (req, res, opts) {
    const { steamid } = await jsonBody(req, res);

    const user = await options.models.users.getOrCreate(req.auth.user.steamid);
    const { teamId } = user;

    if (!teamId || !teamId.length) {
      throw Boom.badRequest('You do not own a team');
    }

    let team = await options.models.team.getOrCreate(teamId);
    team.players.forEach((player) => {
      if (player.steamid !== steamid) {
        return;
      }
      player.confirmed = true;
    });
    team = await options.models.team.put(team);

    sendJSON(req, res, {
      team
    });
  }

  async function rejectInvite (req, res, opts) {
    const { steamid } = await jsonBody(req, res);

    const user = await options.models.users.getOrCreate(req.auth.user.steamid);
    const { teamId } = user;

    if (!teamId || !teamId.length) {
      throw Boom.badRequest('You do not own a team');
    }

    let team = await options.models.team.getOrCreate(teamId);
    team.players = team.players.filter((p) => p.steamid !== steamid);
    team = await options.models.team.put(team);

    sendJSON(req, res, {
      team
    });
  }

  async function leaveTeam (req, res, opts) {
    const { teamId } = await jsonBody(req, res);
    if (!teamId) {
      return sendBoom(req, res, Boom.badRequest('teamId is required'));
    }
    const team = await options.models.team.getOrCreate(teamId);
    const { user } = req.auth;

    team.players = team.players.filter((player) => player.steamid !== user.steamid);
    await options.models.team.put(team);
    sendJSON(req, res, {
      team
    });
  }

  async function updateTeam (req, res, opts) {
    const { name } = await jsonBody(req, res);

    const user = await options.models.users.getOrCreate(req.auth.user.steamid);
    const { teamId } = user;

    if (!teamId || !teamId.length) {
      throw Boom.badRequest('You do not own a team');
    }

    let team = await options.models.team.getOrCreate(teamId);
    if (name) {
      team.name = name;
    }
    await options.models.team.put(team);
    sendJSON(req, res, {
      team
    });
  }
}
