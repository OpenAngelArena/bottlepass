const Joi = require('joi');
const CreateModel = require('./model');
const SortedArray = require('sorted-array');
// const partial = require('ap').partial;

module.exports = MMRRankings;

const BRACKET_BUCKETS = 100;

const MMRRankingsValidator = Joi.object().keys({
  // id as used in API's
  bracket: Joi.string().required(),
  players: Joi.array().items(Joi.object().keys({
    ranking: Joi.number().required(),
    steamid: Joi.string().required(),
    mmr: Joi.number().required(),
    name: Joi.string()
  })).default([])
});

function MMRRankings (db, users, profiles) {
  var model = CreateModel(MMRRankingsValidator, 'bracket', db);

  var isRunning = false;
  var needsToRun = true;

  model.bracketForRanking = bracketForRanking;
  model.updateMMR = needsUpdateBrackets;

  model.BRACKET_BUCKETS = BRACKET_BUCKETS;

  checkUpdateBrackets();

  return model;

  function needsUpdateBrackets () {
    needsToRun = true;
    checkUpdateBrackets();
  }

  async function checkUpdateBrackets () {
    if (isRunning || !needsToRun) {
      return;
    }
    needsToRun = false;
    isRunning = true;

    await calculateBrackets(model, users, profiles);
    isRunning = false;
    return checkUpdateBrackets();
  }
}

async function calculateBrackets (model, users, profiles) {
  return checkMoreUsers(false, 0);

  async function checkMoreUsers (maxMMR, curRanking) {
    console.log('Writing next ranking batch of players... ' + curRanking + ' / ' + maxMMR);
    var players = await calculateBracketsAfter(model, users, maxMMR, curRanking);
    await Promise.all(players.map(async function (player) {
      var profile = await profiles.getOrCreate(player.steamid);
      if (profile) {
        player.name = profile.name;
      }
      return player;
    }));
    await model.put({
      bracket: '' + curRanking,
      players: players
    });
    if (players.length) {
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
