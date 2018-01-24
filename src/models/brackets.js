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

    setTimeout(async function () {
      var hasReturned = false;
      await calculateBrackets(model, users);
      if (hasReturned) {
        console.log('Returned twice into check update');
        return;
      }
      hasReturned = true;
      isRunning = false;
      return checkUpdateBrackets();
    }, 5000);
  }
}

async function calculateBrackets (model, users, cb) {
  return checkMoreUsers(false, 0);

  async function checkMoreUsers (maxMMR, curRanking) {
    console.log('Writing next ranking batch of players... ' + curRanking + ' / ' + maxMMR);
    var players = await calculateBracketsAfter(model, users, maxMMR, curRanking);
    if (players.length) {
      await model.put({
        bracket: '' + curRanking,
        players: players
      });
      return checkMoreUsers(players[players.length - 1].mmr, curRanking + BRACKET_BUCKETS);
    }
  }
}
async function calculateBracketsAfter (model, users, afterMMR, ranking) {
  if (!ranking) {
    ranking = 0;
  }
  return new Promise(function (resolve, reject) {
    console.log('CALCULATING BRACKETS');
    var top100 = SortedArray.comparing((entry) => 0 - entry.mmr, []);

    users.createReadStream()
      .on('data', function (data) {
        var userData = JSON.parse(data.value);
        if (!afterMMR || userData.unrankedMMR < afterMMR) {
          top100.insert({
            steamid: userData.steamid,
            mmr: userData.unrankedMMR
          });
          top100.array.splice(BRACKET_BUCKETS);
        }
      })
      .on('error', function (err) {
        console.log('Error reading users!', err);
        reject(err);
      })
      .on('end', async function () {
        console.log('Finished calculating top MMR');
        top100.array.forEach(function (playerEntry) {
          playerEntry.ranking = ++ranking;
        });
        resolve(top100.array);
      });
  });
}

function bracketForRanking (mmr) {
  return '' + (mmr - (mmr % BRACKET_BUCKETS));
}
