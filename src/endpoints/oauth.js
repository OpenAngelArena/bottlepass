const sendJSON = require('send-data/json');
const sendBoom = require('send-boom');
const Boom = require('boom');
const redirect = require('redirecter')
const { partial } = require('ap');
const IDConvertor = require('steam-id-convertor');
const Jwt = require('jsonwebtoken');

module.exports = OAuth;

function OAuth (options) {
  const methods = {
    authenticate,
    verify,
  };

  return controller;

  function controller (req, res, opts, next) {
    var method = opts.splat;
    if (methods[method]) {
      return methods[method](req, res, opts)
        .catch(next);
    }
    sendBoom(req, res, Boom.badRequest('Unknown action ' + method));
  }

  async function authenticate (req, res, opts) {
    res.redirect = partial(redirect, req, res);
    return options.steam.authenticate(req, res);
  }
  async function verify (req, res, opts) {
    res.redirect = partial(redirect, req, res);
    res.locals = {};
    return options.steam.verify(req, res, async function (steamid) {
      console.log('Hey this worked', steamid, IDConvertor.to32(steamid));

      var steamid32 = IDConvertor.to32(steamid);
      var user = await options.models.users.getOrCreate(steamid32 + '');

      delete user.matches;

      var token = await Jwt.sign({
        type: 'user',
        user: user
      }, options.secret);

      sendJSON(req, res, {
        steamid32: steamid32,
        user: user,
        token: token
      });
    });
  }
}

// auth.verify(req, res, function(steamId) {
