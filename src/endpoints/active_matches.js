const sendJSON = require('send-data/json');
const Boom = require('boom');

const { ActiveMatches } = require('./savestate');

module.exports = ActiveMatchController;

function ActiveMatchController (options) {
  return controller;

  function controller (req, res, opts, next) {
    return controllerAsync(req, res, opts)
      .catch(next);
  }

  async function controllerAsync (req, res, opts) {
    sendJSON(req, res, ActiveMatches);
  }
}
