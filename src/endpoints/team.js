const Promise = require('bluebird');
const sendJSON = require('send-data/json');
const sendBoom = require('send-boom');
const Boom = require('boom');
const redirect = require('redirecter');
const { partial } = require('ap');
const uuidv4 = require('uuid/v4');
const { createToken } = require('./oauth');

const jsonBody = Promise.promisify(require('body/json'));

const AuthRequired = require('../auth');

module.exports = OAuth;

function OAuth (options) {
  const postMethods = {
    create
  };
  const getMethods = {
  };

  return {
    GET: AuthRequired(options, partial(controller, getMethods), { type: 'user' }),
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
    const team = await options.models.team.put({
      id: teamId,
      name: body.name,
      captain: user.steamid
    });

    sendJSON(req, res, {
      team,
      token: await createToken(options, user)
    });
  }
}
