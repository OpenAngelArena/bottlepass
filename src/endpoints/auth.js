const sendJSON = require('send-data/json');
const Jwt = require('jsonwebtoken');
const Promise = require('bluebird');

const jsonBody = Promise.promisify(require('body/json'));

module.exports = Create;

function Create (options) {
  return {
    // GET: getController,
    POST: postController
  };

  function postController (req, res, opts, cb) {
    postControllerAsync(req, res, opts)
      .catch(cb);
  }

  async function postControllerAsync (req, res, opts) {
    var body = await jsonBody(req, res);
    console.log(body);
    body.users = body.users.map((val) => val + '');
    var users = await Promise.all(body.users.map(async (steamid) => {
      return options.models.users.getOrCreate(steamid);
    }));

    console.log(users);

    var matchid = options.models.matches.getMatchID(body.gametime, body.users);
    console.log('This is a match id', matchid);
    var match = await options.models.matches.getOrCreate(matchid, {
      startTime: body.gametime,
      players: body.users
    });

    var userData = {};

    users.forEach(function (user) {
      userData[user.steamid] = {
        mmr: user.rankedMMR,
        unrankedMMR: user.unrankedMMR,
        bottle: user.customBottle
      };
    });

    var token = await Jwt.sign({
      type: 'match',
      matchid: matchid
    }, options.secret);

    sendJSON(req, res, {
      matchid: matchid,
      userData: userData,
      token: token
    });
  }
}
