const Joi = require('joi');
const CreateModel = require('./model');

module.exports = MMRRankings;

const BRACKET_BUCKETS = 5000;

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

function MMRRankings (options, db, users, profiles) {
  var model = CreateModel(MMRRankingsValidator, 'bracket', db);

  var isRunning = false;
  var needsToRun = true;

  model.bracketForRanking = bracketForRanking;
  model.updateMMR = needsUpdateBrackets;

  model.BRACKET_BUCKETS = BRACKET_BUCKETS;

  if (!options.startSeason && !options.disable_recalculation) {
    checkUpdateBrackets();
  }

  return model;

  async function needsUpdateBrackets () {
    needsToRun = true;
    return checkUpdateBrackets();
  }

  async function checkUpdateBrackets () {
    if (isRunning || !needsToRun) {
      return isRunning;
    }
    needsToRun = false;
    isRunning = calculateBrackets(model, users, profiles);
    await isRunning;
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
    // array of users, keep sorted by mmr and trim constantly
    const top100 = [];

    users.createReadStream()
      .on('data', function (data) {
        var userData = JSON.parse(data.value);
        if (!afterMMR || userData.unrankedMMR < afterMMR) {
          // insert user into the array at the correct position
          // if the array is full, pop the last user off
          const user = {
            steamid: data.key,
            mmr: userData.unrankedMMR
          };
          // users come back in a random order, so we have to insert them in the correct order
          var index = top100.length;
          while (index && top100[index - 1].mmr < user.mmr) {
            index--;
          }
          top100.splice(index, 0, user);
          if (top100.length > BRACKET_BUCKETS) {
            top100.pop();
          }
        }
      })
      .on('error', function (err) {
        console.log('Error reading users!', err);
        reject(err);
      })
      .on('end', async function () {
        console.log('Finished calculating top MMR');
        top100.forEach(function (playerEntry) {
          playerEntry.ranking = ++ranking;
        });
        resolve(top100);
      });
  });
}

function bracketForRanking (mmr) {
  return '' + (mmr - (mmr % BRACKET_BUCKETS));
}
