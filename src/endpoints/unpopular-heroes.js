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
      player.popularHeroes = player.popularHeroes || {};
      if (Object.keys(player.popularHeroes).length < 5) {
        player.popularHeroes = player.heroPicks || {};
      }
      return player;
    }));

    var heroCounts = {};
    players.forEach((player) => {
      Object.keys(player.popularHeroes).forEach((hero) => {
        if (player.popularHeroes[hero]) {
          heroCounts[hero] = (heroCounts[hero] || 0) + player.popularHeroes[hero];
        }
      });
    });

    var sortedHeroes = Object.keys(heroCounts).sort((a, b) => {
      return heroCounts[b] - heroCounts[a];
    });
    // sorted heroes has the most picked heroes at the start of the list
    // we want to remove the most picked heroes but leave a large enough pool to play
    // we leave at least enough for every player to have 2 choices and then try to remove 1/2 the remaining options
    let heroesRemoved = 0;
    const heroesRemovedGoal = Math.floor((body.heroes.length - (players.length * 2)) * 0.5);
    while (sortedHeroes.length && heroesRemoved < heroesRemovedGoal) {
      var hero = sortedHeroes.shift();
      body.heroes = body.heroes.filter((h) => h !== hero);
      heroesRemoved++;
    }

    sendJSON(req, res, {
      body: body.heroes,
      pretty: true,
      statusCode: 200
    });
  }
}
