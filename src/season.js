
module.exports = SeasonWatcher;

SeasonWatcher.normalDistribute = normalDistribute;

function SeasonWatcher (options) {
  init(options);

  return {
  };
}

async function init (options) {
  var state = await options.models.seasons.getState();

  console.log(state);

  if (state.seasonState === 'precallibration') {
    console.log('precallibrateing!!');
    precallibrate(state, options);
  }
}

async function precallibrate (state, options) {
  var topPlayers = await options.models.mmr.getOrCreate('0');
  topPlayers = topPlayers.players.slice(0, 100);

  // await options.models.seasons.topPlayers.put({
  //   season: state.currentSeason - 1,
  //   players: topPlayers
  // });

  // await Promise.all(topPlayers.map(async function (player) {
  //   var user = await options.models.users.rawGet(player.steamid);
  //   user.seasonPlacings++;
  //   if (!user.bestRanking || player.ranking < user.bestRanking) {
  //     user.bestRanking = player.ranking;
  //   }
  //   // console.log(user);
  //   return options.models.users.put(user);
  // }));
  var allPlayers = await getAllSortedPlayers(options);
  var allSteamids = allPlayers.map((p) => p.steamid);
  var newMMRs = normalDistribute(allSteamids, 700, 1400);

  // this part can probably take a while
  await Promise.all(newMMRs.map(async function (player) {
    var user = await options.models.users.rawGet(player.steamid);
    if (!player.mmr || !player.steamid) {
      console.log('!!!!!!!!!!', player);
    }
    user.unrankedMMR = player.mmr;
    return options.models.users.put(user);
  }));

  state.seasonState = 'running';
  await options.models.seasons.setState(state);
  await options.models.mmr.updateMMR();
}

async function getAllSortedPlayers (options) {
  return new Promise(function (resolve, reject) {
    var allPlayers = [];

    options.models.users.createReadStream()
      .on('data', function (data) {
        var userData = JSON.parse(data.value);
        const user = {
          steamid: data.key,
          mmr: userData.unrankedMMR || 1000
        };

        var index = allPlayers.length;
        while (index && allPlayers[index - 1].mmr < user.mmr) {
          index--;
        }
        allPlayers.splice(index, 0, user);
      })
      .on('error', function (err) {
        console.log('Error reading users!', err);
        reject(err);
      })
      .on('end', async function () {
        console.log('Finished reading in all MMR values');

        resolve(allPlayers);
      });
  });
}

function normalDistribute (players, min, max) {
  return players.map(function (steamid, i) {
    var t = i / (players.length - 1); // t is now 0 -1
    t = 2 * t - 1; // t is now -1 to 1
    var tFactor = t * t * t; // still -1 to 1, curves the way we want
    t *= Math.abs(tFactor);
    var factor = (t + 1) / 2; // scale to 0-2 then half for 0-1

    return {
      steamid: steamid,
      mmr: 1000
    };
  });
}
