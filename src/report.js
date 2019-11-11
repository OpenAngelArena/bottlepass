
test();

async function test () {
  userData();
  matchData();
}

function userData () {
  var totalUsers = 0;
  var finishedGames = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var activePlayers = 0;
  var recentPlayers = 0;
  var totalMatches = 0;
  var activeMatches = 0;
  var recentMatches = 0;
  var totalMatchesFinished = 0;
  var activeMatchesFinished = 0;
  var recentMatchesFinished = 0;
  var daysSpent = 0;
  var daysSpentPeople = 0;
  var recently = new Date();
  var mostPlayedGames = 0;
  recently.setHours(0, 0, 0, 0);
  recently = (recently - 0) - (1000 * 60 * 60 * 24 * 365 / 2);
  options.models.users.createReadStream()
    .on('data', function (data) {
      var userData = JSON.parse(data.value);
      totalUsers++;
      totalMatches += userData.matchesStarted;
      totalMatchesFinished += userData.matchesFinished;

      mostPlayedGames = Math.max(userData.matchesStarted, mostPlayedGames);

      if (totalUsers === 2) {
        // console.log(userData);
      }
      for (let i = 0; i < 10; ++i) {
        if (userData.matchesFinished > i) {
          finishedGames[i]++;
        }
      }

      if (userData.lastGameOfTheDay > recently) {
        recentPlayers++;
        recentMatches += userData.matchesStarted;
        recentMatchesFinished += userData.matchesFinished;
      }
      if (userData.daysPlayed > 3) {
        activePlayers++;
        activeMatches += userData.matchesStarted;
        activeMatchesFinished += userData.matchesFinished;
      }
      if (userData.daysPlayed > 0) {
        daysSpentPeople++;
        daysSpent += userData.daysPlayed;
      }
    })
    .on('end', async function () {
      console.log('-- users --');
      console.log('total users\t', totalUsers);
      console.log('recent users\t', recentPlayers);
      console.log('active users\t', activePlayers);
      console.log('average days spent\t', daysSpent / daysSpentPeople);
      console.log('average game started\t', totalMatches / totalUsers);
      console.log('average game finished\t', totalMatchesFinished / totalUsers);
      console.log('average game started (recent players)\t', recentMatches / recentPlayers);
      console.log('average game finished (recent players)\t', recentMatchesFinished / recentPlayers);
      console.log('average game started (active players)\t', activeMatches / activePlayers);
      console.log('average game finished (active players)\t', activeMatchesFinished / activePlayers);

      for (let i = 1; i < 10; ++i) {
        console.log('% of users who ' + i + ' games and played another\t', finishedGames[i] / finishedGames[i - 1] * 100);
      }
      console.log('most played games\t', mostPlayedGames);
    });
}

function matchData () {
  var totalMatches = 0;
  var totalFullMatches = 0;
  var totalOutcomes = 0;
  var totalLength = 0;
  var totalFinishedLength = 0;
  var firstMatchRecorded = null;
  options.models.matches.createReadStream()
    .on('data', function (data) {
      var matchData = JSON.parse(data.value);
      totalMatches++;
      totalLength += Number(matchData.gameLength || 0);
      if (matchData.players.length === 10) {
        totalFullMatches++;
        if (matchData.outcome) {
          totalOutcomes++;
          totalFinishedLength += matchData.gameLength;
        }
      }
      if (!firstMatchRecorded && matchData.outcome) {
        console.log(matchData);
        firstMatchRecorded = matchData;
      }
    })
    .on('end', async function () {
      console.log('-- matches --');
      console.log('first match recorded\t', firstMatchRecorded.startTime.substr(0, 8));
      console.log('total matches\t', totalMatches);
      console.log('total game time logged (hours)\t', Math.round(totalLength / 60 / 60 * 100) / 100);
      console.log('total 10v10 matches\t', totalFullMatches);
      console.log('total 10v10 matches that finished\t', totalOutcomes);
      console.log('avaerage game length (minutes)\t', Math.round(100 * totalFinishedLength / 60 / totalOutcomes) / 100);
    });
}
