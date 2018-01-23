const Boom = require('boom');
const Jwt = require('jsonwebtoken');

module.exports = auth;

function auth (options, next) {
  return controller;

  function controller (req, res, opts, cb) {
    var token = getTokenFromRequest(req);
    var decoded = null;

    if (!token) {
      return cb(Boom.unauthorized('No auth token!'));
    }

    try {
      decoded = Jwt.decode(token, options.secret);
    } catch (ex) {
      // invalid token
      return cb(Boom.badRequest('Bad JWT: ' + ex.message));
    }

    if (decoded.type !== 'match') {
      return cb(Boom.unauthorized('Only matches can use this API'));
    }

    req.matchid = decoded.matchid;

    return next(req, res, opts, cb);
  }
}

function getTokenFromRequest (req) {
  return req.headers['x-auth-token'];
}
