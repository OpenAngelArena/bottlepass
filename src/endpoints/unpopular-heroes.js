const Promise = require('bluebird');
const sendJSON = require('send-data/json');
const Joi = require('joi');

const AuthRequired = require('../auth');

const jsonBody = Promise.promisify(require('body/json'));

// pass in full hero list
const UnpopularHeroesValidator = Joi.object().keys({
  heroes: Joi.array().items(Joi.string())
});

module.exports = UnpopularHeroes;

function UnpopularHeroes (options) {
  return {
    POST: AuthRequired(options, postController)
  };

  function postController (req, res, opts, cb) {
    postControllerAsync(req, res, opts)
      .catch(cb);
  }

  async function postControllerAsync (req, res, opts) {
    // load up all the players in the match
    // figure out their *most* popular heroes

    var body = await jsonBody(req, res);

    body = UnpopularHeroesValidator.validate(body);

    if (body.error) {
      throw body.error;
    }
    body = body.value;
    
    var match = await options.models.matches.get(req.matchid);
    var players = await Promise.all(match.players.map(async (steamid) => {
      var player = await options.models.users.getOrCreate(steamid);
      player.heroes = player.heroes || {};
      return player;
    }));

    var heroCounts = {};
    players.forEach((player) => {
      Object.keys(player.heroes).forEach((hero) => {
        if (player.heroes[hero]) {
          heroCounts[hero] = (heroCounts[hero] || 0) + player.heroes[hero];
        }
      });
    });

    var sortedHeroes = Object.keys(heroCounts).sort((a, b) => {
      return heroCounts[a] - heroCounts[b];
    });

    
  }
}
