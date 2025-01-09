const sendJSON = require('send-data/json');
const sendBoom = require('send-boom');
const Boom = require('boom');
const redirect = require('redirecter');
const { partial } = require('ap');
const IDConvertor = require('steam-id-convertor');
const Jwt = require('jsonwebtoken');

const AuthRequired = require('../auth');

module.exports = OAuth;

OAuth.createToken = createToken;

async function createToken (options, user) {
  user = {...user};
  delete user.matches;
  delete user.heroPicks;
  delete user.heroBans;
  delete user.popularHeroes;
  delete user.team;

  return Jwt.sign({
    type: 'user',
    user: user,
    baseUrl: options.baseurl
  }, options.secret);
}

function OAuth (options) {
  const methods = {
    authenticate,
    verify,
    token: AuthRequired(options, token, { type: 'user' })
  };

  return controller;

  function controller (req, res, opts, next) {
    var method = opts.splat;
    if (methods[method]) {
      const result = methods[method](req, res, options, next);
      if (result && result.catch) {
        return result.catch(next);
      }
      return result;
    }
    sendBoom(req, res, Boom.badRequest('Unknown action ' + method));
  }

  async function authenticate (req, res, opts) {
    const sendRedirect = partial(redirect, req, res);
    res.redirect = sendRedirect;
    return options.steam.authenticate(req, res);
  }
  async function verify (req, res, opts) {
    const sendRedirect = partial(redirect, req, res);
    res.redirect = sendRedirect;
    res.locals = {};
    return options.steam.verify(req, res, async function (steamid) {
      var steamid32 = IDConvertor.to32(steamid);
      var user = await options.models.users.getOrCreate(steamid32 + '');

      var myToken = await createToken(options, user);

      sendRedirect(options.weburl + '/auth/' + myToken);
    });
  }
  async function token (req, res, opts) {
    // const token = createToken(options, user);
    const user = await options.models.users.getOrCreate(req.auth.user.steamid);
    sendJSON(req, res, {
      user: user,
      token: await createToken(options, user)
    });
  }
}
