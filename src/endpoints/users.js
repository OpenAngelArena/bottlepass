const sendJSON = require('send-data/json');
const Boom = require('boom');

module.exports = Users;

function Users (options) {
  return controller;

  function controller (req, res, opts, next) {
    return controllerAsync(req, res, opts)
      .catch(next);
  }

  async function controllerAsync (req, res, opts) {
    var steamid = opts.splat;

    try {
      var user = await options.models.users.get(steamid);
      options.models.users.close(user);

      return sendJSON(req, res, user);
    } catch (err) {
      console.log(err.notFound, err);
      if (err.notFound) {
        throw Boom.notFound('User with that id not found', err);
      }
      throw err;
    }
  }
}
