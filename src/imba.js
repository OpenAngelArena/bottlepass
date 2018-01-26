const amqp = require('amqp-connection-manager');
const Promise = require('bluebird');
const Joi = require('joi');

module.exports = IMBA;

const CosmeticMEssageValidator = Joi.object().keys({
  source: Joi.string().required().only('imba', 'oaa'),
  cosmetic: Joi.string().required(),
  steamid: Joi.number().required()
});
const CosmeticQueueName = 'unlocked_cosmetics';

function IMBA (options) {
  var imbaHost = [
    'amqp://',
    options.imba.user, ':', options.imba.password, '@',
    options.imba.host, ':', options.imba.port
  ].join('');
  console.log('Trying to connect to IMBA MQ', imbaHost);
  var connection = amqp.connect([imbaHost]);

  connection.on('connect', function () {
    console.log('Connected to IMAB MQ');
  });
  connection.on('disconnect', function (err) {
    console.log('Disconnected from IMAB MQ!!!', err);
  });

  var channelWrapper = connection.createChannel({
    json: true,
    setup: async function (channel) {
      console.log('Settings up IMBA MQ');
      return Promise.all([
        channel.assertQueue(CosmeticQueueName, { durable: true }),
        channel.prefetch(1),
        channel.consume(CosmeticQueueName, handleMessage)
      ]);
    }
  });

  sendToQueue({
    steamid: 0,
    cosmetic: 'tidehammer',
    source: 'oaa'
  });

  async function sendToQueue (data) {
    var result = CosmeticMEssageValidator.validate(data);
    if (result.error) {
      throw result.error;
    }
    data = result.value;

    await channelWrapper.sendToQueue(CosmeticQueueName, data);
  }

  async function handleMessage (data) {
    console.log(data);
  }
}
