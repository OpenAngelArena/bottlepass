const MAX_K = 80;
const MIN_MMR = 500;
const MID_MMR = 1000;
const MASTER_MMR = 2000;

module.exports = {
  processScores: processScores,
  getExpectedScore: getExpectedScore,

  // for tests
  getKFactor: getKFactor,
  getElo: getElo,
  calculateTeamScores: calculateTeamScores,

  MAX_K: MAX_K,
  MIN_MMR: MIN_MMR,
  MID_MMR: MID_MMR,
  MASTER_MMR: MASTER_MMR
};

function getKFactor (mmr) {
  if (mmr < MIN_MMR) {
    return MAX_K;
  } else if (mmr >= MIN_MMR && mmr < MID_MMR) {
    return MAX_K / 2;
  } else if (mmr >= MID_MMR && mmr < MASTER_MMR) {
    // eaze from MID_MMR to MASTER_MMR approaching 16
    return (MAX_K / 2) - ((MAX_K / 4) * (mmr / MID_MMR - 1));
  } else {
    return (MAX_K / 4); // master player
  }
}

function getElo (score0, score1) {
  // still just elo
  return 1 / (1 + Math.pow(10, (score1 - score0) / 400));
}

function calculateTeamScores (team, scoreChange, matchID) {
  scoreChange = Math.round(scoreChange * (team.length));
  // scoreChange = Math.round(scoreChange * 2);
  team.forEach(function (player) {
    var myElo = 1;
    if (team.length > 1) {
      var averageMMRWithoutMe = team.filter(function (otherPlayer) {
        return player !== otherPlayer;
      }).reduce(function (score, otherPlayer) {
        return otherPlayer.mmr + score;
      }, 0) / (team.length - 1);
      myElo = getElo(averageMMRWithoutMe, player.mmr);
    }

    player.adjustedMMR = player.mmr + scoreChange * myElo;
  });
}

function getExpectedScore (match) {
  var team0 = match.dire;
  var team1 = match.radiant;

  var team0MMR = team0.reduce(function (score, player) {
    return score + player.mmr;
  }, 0);
  var team1MMR = team1.reduce(function (score, player) {
    return score + player.mmr;
  }, 0);
  var team0AverageMMR = team0MMR / team0.length;
  var team1AverageMMR = team1MMR / team1.length;
  var team0ExpectedScore = getElo(team0AverageMMR, team1AverageMMR);
  var team1ExpectedScore = getElo(team1AverageMMR, team0AverageMMR);

  return [team0ExpectedScore, team1ExpectedScore];
}

function processScores (match, score0, score1) {
  var team0 = match.radiant;
  var team1 = match.dire;

  var team0MMR = team0.reduce(function (score, player) {
    return score + player.mmr;
  }, 0);
  var team1MMR = team1.reduce(function (score, player) {
    return score + player.mmr;
  }, 0);
  var team0AverageMMR = team0MMR / team0.length;
  var team1AverageMMR = team1MMR / team1.length;
  var team0ExpectedScore = getElo(team0AverageMMR, team1AverageMMR);
  var team1ExpectedScore = getElo(team1AverageMMR, team0AverageMMR);
  var team0Score = score0 > score1 ? 0 : 1;
  var team1Score = 1 - team0Score;
  var team0K = getKFactor(team0AverageMMR);
  var team1K = getKFactor(team1AverageMMR);
  var team0MMRAdjustment = team0K * (team0Score - team0ExpectedScore);
  var team1MMRAdjustment = team1K * (team1Score - team1ExpectedScore);

  calculateTeamScores(team0, team0MMRAdjustment, match._id);
  calculateTeamScores(team1, team1MMRAdjustment, match._id);

  match.state = 'done';

  return match;
}
