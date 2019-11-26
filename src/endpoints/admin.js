const Promise = require('bluebird');
const sendJSON = require('send-data/json');
const sendBoom = require('send-boom');
const Boom = require('boom');
const redirect = require('redirecter');
const { partial } = require('ap');
const parseUrl = require('url').parse;
const { createToken } = require('./oauth');

const jsonBody = Promise.promisify(require('body/json'));

const AuthRequired = require('../auth');

module.exports = OAuth;

function OAuth (options) {
  const postMethods = {
  };
  const getMethods = {
    impersonate
  };

  return {
    GET: AuthRequired(options, partial(controller, getMethods), { type: 'user' }),
    // GET: partial(controller, getMethods),
    POST: AuthRequired(options, partial(controller, postMethods), { type: 'user' })
  };

  async function controller (methods, req, res, opts, next) {
    const user = await options.models.users.getOrCreate(req.auth.user.steamid);
    if (!user.isAdmin) {
      throw Boom.forbidden('You are not an admin');
    }
    req.user = user;
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

  async function impersonate (req, res, opts) {
    const { user } = req;
    const { steamid } = parseUrl(req.url, true).query;
    const impersonatedUser = await options.models.users.getOrCreate(steamid);

    sendJSON(req, res, {
      token: await createToken(options, impersonatedUser)
    });
  }
}
