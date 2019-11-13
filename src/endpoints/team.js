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
    join
  };
  const getMethods = {
    invite: getInvite,
    checkInvite,
    view
  };

  return {
    GET: AuthRequired(options, partial(controller, getMethods), { type: 'user' }),
    // GET: partial(controller, getMethods),
    POST: AuthRequired(options, partial(controller, postMethods), { type: 'user' }),
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
    const user = await options.models.users.getOrCreate(req.auth.user.steamid);

    const teamId = (user.teamId && user.teamId.length) ? user.teamId : uuidv4();
    user.teamId = teamId;
    await options.models.users.put({...user});
    console.log('Creating team with id', teamId);
    const team = await options.models.team.put({
      id: teamId,
      name: body.name,
      captain: user.steamid,
      players: [user.profile]
    });

    sendJSON(req, res, {
      team,
      token: await createToken(options, user)
    });
  }

  async function createInvite (req, res, opts) {
    const user = await options.models.users.getOrCreate(req.auth.user.steamid);
    const teamId = user.teamId;
    if (user.steamid !== user.team.captain) {
      throw Boom.forbidden('Only the captain can create invite links');
    }
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
    console.log('Looking up token', token);
    const team = await options.models.team.findTeamByInvite(token);

    console.log('Add user', user, 'to team', team);

    team.players = team.players.filter((player) => player.steamid !== user.steamid);
    team.players.push({...user.profile,
      confirmed: false,
      standin: false
    });

    await options.models.team.put(team);

    sendJSON(req, res, {
      team
    });
  }

  async function view (req, res, opts) {
    const { id } = parseUrl(req.url, true).query;

    console.log(id);

    const team = await options.models.team.get(id);
    delete team.invite;

    team.players = await Promise.all(team.players.map(async (player) => {
      const user = await options.models.users.getOrCreate(player.steamid);
      console.log(user);
      return {...player,
        mmr: user.unrankedMMR
      };
    }));

    sendJSON(req, res, {
      team
    });
  }
}
