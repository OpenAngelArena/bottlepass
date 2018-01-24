const Joi = require('joi');
const CreateModel = require('./model');
const partial = require('ap').partial;
const Event = require('geval/event');
const SortedArray = require('sorted-array');

module.exports = MMRRankings;

const BRACKET_BUCKETS = 100;

const MMRRankingsValidator = Joi.object().keys({
  // id as used in API's
  bracket: Joi.string().required(),
  players: Joi.array().items(Joi.object().keys({
    ranking: Joi.number().required(),
    steamid: Joi.string().required(),
    mmr: Joi.number().required()
  })).default([])
});

function MMRRankings (db, users) {
  const updateBracketEvent = Event();
  var model = CreateModel(MMRRankingsValidator, 'bracket', db);

  var isRunning = false;
  var needsToRun = true;

  model.bracketForRanking = bracketForRanking;
  model.updateMMR = checkUpdateBrackets;

  model.BRACKET_BUCKETS = BRACKET_BUCKETS;

  checkUpdateBrackets();

  return model;

  function needsUpdateBrackets () {
    needsToRun = true;
    checkUpdateBrackets();
  }

  function checkUpdateBrackets () {
    if (isRunning || !needsToRun) {
      return;
    }
    needsToRun = false;
    isRunning = true;

    var hasReturned = false;
    calculateBrackets(model, users, function () {
      if (hasReturned) {
        console.log('Returned twice into check update');
        return;
      }
      hasReturned = true;
      isRunning = false;
      checkUpdateBrackets();
    });
  }
}

async function calculateBrackets (model, users, cb) {
  console.log('CALCULATING BRACKETS');
  var top100 = SortedArray.comparing((entry) => 0 - entry.mmr, []);

  users.createReadStream()
    .on('data', function (data) {
      var userData = JSON.parse(data.value);
      top100.insert({
        steamid: userData.steamid,
        mmr: userData.unrankedMMR
      });
      top100.array.splice(100);
    })
    .on('error', function (err) {
      console.log('Error reading users!', err);
    })
    .on('end', async function () {
      console.log('Finished calculating top MMR');
      console.log(top100.array);
      ranking = 1;
      top100.array.forEach(function (playerEntry) {
        playerEntry.ranking = ranking++;
      });
      await model.put({
        bracket: '0',
        players: top100.array
      });
      cb();
    });
}

function bracketForRanking (mmr) {
  return '' + (mmr - (mmr % BRACKET_BUCKETS));
}
