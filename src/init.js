const http = require('http');
const https = require('https');
const HttpHashRouter = require('http-hash-router');
const Boom = require('boom');
const Corsify = require('corsify');
const sendBoom = require('send-boom');
const fs = require('fs');
const path = require('path');
const steam = require('steam-auth');

const Models = require('./models');
const SeasonWatcher = require('./season');
// const IMBA = require('./imba');

module.exports = Init;

function Init (options) {
  try {
    fs.mkdirSync(options.root);
  } catch (e) {
  }

  if (!options.baseurl) {
    options.baseurl = 'http://localhost:' + options.port;
  }

  options.steam = new steam.Auth(options.baseurl + '/auth/verify', options.baseurl);
  options.steamApi = new steam.Api(options.steamkey);
  options.models = Models(options);
  // options.imba = IMBA(options);
  options.season = SeasonWatcher(options);

  var router = HttpHashRouter();

  router.set('/health', function health (req, res) {
    res.end('OK');
  });

  router.set('/admin/*', require('./endpoints/admin')(options));
  router.set('/auth/*', require('./endpoints/oauth')(options));
  router.set('/state/save', require('./endpoints/savestate')(options));
  router.set('/state/load', require('./endpoints/loadstate')(options));
  router.set('/match/calculate', require('./endpoints/calculate')(options));
  router.set('/match/complete', require('./endpoints/complete')(options));
  router.set('/match/send_teams', require('./endpoints/send_teams')(options));
  router.set('/match/send_bans', require('./endpoints/send_bans')(options));
  router.set('/match/send_heroes', require('./endpoints/send_heroes')(options));
  router.set('/auth', require('./endpoints/auth')(options));
  router.set('/history', require('./endpoints/history')(options));
  router.set('/tournament', require('./endpoints/tournament')(options));
  router.set('/tournament.csv', require('./endpoints/tournament.csv')(options));
  router.set('/team/*', require('./endpoints/team')(options));
  router.set('/users/*', require('./endpoints/users')(options));
  router.set('/matches/*', require('./endpoints/matches')(options));
  router.set('/active_matches', require('./endpoints/active_matches')(options));
  router.set('/top*', require('./endpoints/top')(options));

  var cors = Corsify({
    'Access-Control-Allow-Headers': 'Authorization, X-Auth-Token, Content-Type, Auth-Checksum'
  });

  var server = http.createServer(cors(handler));
  console.log('Listening on port', options.port);
  server.listen(options.port);

  if (options.ssl_port) {
    let servers = https.createServer({
      key: fs.readFileSync(path.join(__dirname, '../privkey.pem')),
      cert: fs.readFileSync(path.join(__dirname, '../cert.pem'))
    }, cors(handler));
    console.log('Listening on port', options.ssl_port);
    servers.listen(options.ssl_port);
  }

  return server;

  function handler (req, res) {
    console.log(req.url);
    router(req, res, {}, onError);

    function onError (err, data) {
      if (!err) {
        console.log('Why does this ever get called with no err?', data);
        err = Boom.internal('An unknown error occured');
      } else if (!err.isBoom) {
        if (err.statusCode) {
          err = new Boom(err.message, {
            statusCode: err.statusCode,
            data: err
          });
        } else if (err.isJoi) {
          err = new Boom(err.message, {
            statusCode: 400,
            data: err.details
          });
        } else {
          console.error('Uncaught non-boom error', err.stack || err);

          err = new Boom(err.message, {
            data: err
          });
        }
      }
      console.log(err);
      sendBoom(req, res, err);
    }
  }
}
