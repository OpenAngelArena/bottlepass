const http = require('http');
const rc = require('rc');
const HttpHashRouter = require('http-hash-router');
const Boom = require('boom');
const Corsify = require('corsify');
const sendBoom = require('send-boom');
const path = require('path');
const fs = require('fs');

const Models = require('./models');

process.on('unhandledRejection', (err) => {
  console.error(err);
  process.exit(1);
});

var options = rc('oaaserver', {
  port: 6969,
  root: path.join(__dirname, '../data/')
});

try {
  fs.mkdirSync(options.root);
} catch (e) {
}

options.models = Models(options);

var router = HttpHashRouter();

router.set('/health', function health (req, res) {
  res.end('OK');
});

router.set('/match/calculate', require('./endpoints/calculate')(options));
router.set('/match/complete', require('./endpoints/complete')(options));
router.set('/match/send_teams', require('./endpoints/send_teams')(options));
router.set('/auth', require('./endpoints/auth')(options));
router.set('/top', require('./endpoints/top')(options));

var cors = Corsify({
  'Access-Control-Allow-Headers': 'X-Auth-Token, Content-Type'
});

var server = http.createServer(cors(handler));
server.listen(options.port);

function handler (req, res) {
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
      } else {
        err = new Boom(err.message, {
          data: err
        });
      }
    }
    sendBoom(req, res, err);
  }
}
