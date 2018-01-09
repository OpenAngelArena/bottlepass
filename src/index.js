const http = require('http');
const rc = require('rc');
const HttpHashRouter = require('http-hash-router');
const Boom = require('boom');
const Corsify = require('corsify');
const sendBoom = require('send-boom');

var router = HttpHashRouter();

router.set('/health', function health(req, res) {
  res.end('OK');
});

var options = rc('oaaserver', {
  port: 6969
});

var cors = Corsify({
  'Access-Control-Allow-Headers': 'X-Auth-Token, Content-Type'
});

var server = http.createServer(cors(handler));
server.listen(options.port);

function handler(req, res) {
  router(req, res, {}, onError);

  function onError (err, data) {
    if (!err) {
      console.log('Why does this ever get called with no err?', data);
      err = Boom.internal('An unknown error occured');
    } else if (!err.isBoom) {
      if (err.statusCode) {
        err = Boom.create(err.statusCode, err.message, err);
      } else {
        err = Boom.create(500, err.message, err);
      }
    }
    sendBoom(req, res, err);
  }
};
