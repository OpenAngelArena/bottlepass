const test = require('tape');
const path = require('path');
const request = require('request-promise');
const rimraf = require('rimraf');
const Promise = require('bluebird');
const sha = require('sha.js');

const Init = require('./init');

process.on('unhandledRejection', (err) => {
  console.error(err);
  process.exit(1);
});

const TEST_PORT = 12345;

const USER_1 = 123123;
const USER_2 = 223123;
const USER_3 = 323123;
const USER_4 = 423123;
const USER_5 = 523123;
const USER_6 = 623123;
const USER_7 = 723123;
const USER_8 = 823123;
const USER_9 = 923123;
const USER_0 = 23123;

const USER_STR_1 = USER_1 + '';
const USER_STR_2 = USER_2 + '';
const USER_STR_3 = USER_3 + '';
const USER_STR_4 = USER_4 + '';
const USER_STR_5 = USER_5 + '';
const USER_STR_6 = USER_6 + '';
const USER_STR_7 = USER_7 + '';
const USER_STR_8 = USER_8 + '';
const USER_STR_9 = USER_9 + '';
const USER_STR_0 = USER_0 + '';

const ALL_PLAYERS = [
  USER_1,
  USER_2,
  USER_3,
  USER_4,
  USER_5,
  USER_6,
  USER_7,
  USER_8,
  USER_9,
  USER_0
];

const ALL_PLAYERS_STR = [
  USER_STR_1,
  USER_STR_2,
  USER_STR_3,
  USER_STR_4,
  USER_STR_5,
  USER_STR_6,
  USER_STR_7,
  USER_STR_8,
  USER_STR_9,
  USER_STR_0
];

const AUTHKEY = 'asdfasfdasdf';

test('full server test', function (t) {
  var server = null;
  var dataPath = path.join(__dirname, '../test/');
  var token = null;

  console.log(ALL_PLAYERS_STR);

  t.test('before', function (t) {
    rimraf(dataPath, function () {
      server = Init({
        port: TEST_PORT,
        root: dataPath,
        secret: 'testcase',
        authkey: AUTHKEY
      });
      t.end();
    });
  });
  t.test('match runthrough', async function (t) {
    try {
      await post('auth');
      t.fail('auth should fail without proper params');
    } catch (e) {
      t.equal(e.error.statusCode, 400, 'gets error when sending invalud auth');
    }
    try {
      await post('auth', {
        users: ALL_PLAYERS,
        gametime: (new Date()).toString(),
        toolsMode: false,
        cheatsMode: true
      });
      t.fail('auth should fail while in cheats mode');
    } catch (e) {
      t.equal(e.error.statusCode, 400, 'gets error when sending cheats mode game');
    }
    try {
      let data = await post('auth', {
        users: ALL_PLAYERS,
        gametime: (new Date()).toString(),
        toolsMode: false,
        cheatsMode: false
      });
      console.log(data);
      t.ok(data.token, 'gets auth token');
      t.ok(data.match, 'gets match data');
      t.ok(data.userData, 'gets userdata with mmr values');
      token = data.token;

      Object.keys(data.userData).forEach(function (user) {
        t.equals(data.userData[user].mmr, 1000, 'new user mmr is 1000');
      });
    } catch (e) {
      console.log(e.error);
      t.fail('Should allow auth when all params are sent');
    }

    try {
      await post('match/send_teams', {
        radiant: [
          USER_STR_1,
          USER_STR_2,
          USER_STR_3,
          USER_STR_4,
          USER_STR_5
        ],
        dire: [
          USER_STR_6,
          USER_STR_7,
          USER_STR_8,
          USER_STR_9,
          USER_STR_0
        ]
      });
      t.fail('requires auth token to lock in teams');
    } catch (e) {
      t.equals(e.statusCode, 401, 'requires auth token to lock in teams');
    }

    try {
      let data = await post('match/send_teams', {
        radiant: [
          USER_STR_1,
          USER_STR_2,
          USER_STR_3,
          USER_STR_4,
          USER_STR_5
        ],
        dire: [
          USER_STR_6,
          USER_STR_7,
          USER_STR_8,
          USER_STR_9,
          USER_STR_0
        ]
      }, token);

      t.ok(data.ok, 'should work');
    } catch (e) {
      console.log(e);
      t.fail('Should be able to lock in teams');
    }

    try {
      let data = await get('users/' + USER_0);
      console.log(data);
      t.equals(data.steamid, USER_STR_0, 'has steamid as string');
      t.equals(data.matchesStarted, 1, 'matches started goes up');
      t.equals(data.matchesFinished, 0, 'finished matches is still 0');
      t.equals(data.unrankedMMR, 1000, 'mmr is 1000 before first game');
    } catch (e) {
      console.log(e.error);
      t.fail('should be able to get user data');
    }

    try {
      let data = await post('match/complete', {
        winner: 'dire',
        endTime: (new Date()).toString(),
        gameLength: 123,
        players: [USER_STR_0]
      }, token);

      t.ok(data.ok, 'should work');
    } catch (e) {
      console.log(e.error);
      t.fail('Should be able to send in results');
    }

    try {
      let data = await get('users/' + USER_0);
      console.log(data);
      t.equals(data.steamid, USER_STR_0, 'has steamid as string');
      t.equals(data.matchesFinished, 1, 'finished matches goes up');
      t.ok(data.unrankedMMR > 1000, 'MMR goes up when you win');
    } catch (e) {
      console.log(e.error);
      t.fail('should be able to get user data');
    }

    var user1MMR = 0;
    try {
      let data = await get('users/' + USER_1);
      console.log(data);
      t.equals(data.steamid, USER_STR_1, 'has steamid as string');
      t.equals(data.matchesFinished, 0, 'disconnected players dont get matchesFinished');
      t.ok(data.unrankedMMR < 1000, 'MMR goes down when you win');
      user1MMR = data.unrankedMMR;
    } catch (e) {
      console.log(e.error);
      t.fail('should be able to get user data');
    }

    await wait(1000);

    try {
      let data = await get('top');
      t.equals(data.length, 10, 'has top players');
      let preMMR = data[0].mmr;
      data.forEach(function (player) {
        t.ok(player.mmr <= preMMR, 'mmr is sorted in top players');
        preMMR = player.mmr;
      });
    } catch (e) {
      console.log(e.error);
      t.fail('should be able to get top user list');
    }

    await runMatch(t, [
      USER_STR_6,
      USER_STR_2,
      USER_STR_3,
      USER_STR_4,
      USER_STR_5
    ], [
      USER_STR_1,
      USER_STR_7,
      USER_STR_8,
      USER_STR_9
    ]);

    try {
      let data = await get('users/' + USER_1);
      console.log(data);
      t.equals(data.steamid, USER_STR_1, 'has steamid as string');
      t.equals(data.matchesFinished, 1, 'increases matchesFinished');
      t.equals(data.unrankedMMR, user1MMR, 'doesnt increase when you have less than 10 players');
    } catch (e) {
      console.log(e.error);
      t.fail('should be able to get user data');
    }

    try {
      let data = await get('top');
      t.equals(data.length, 10, 'has top players');
      let preMMR = data[0].mmr;
      data.forEach(function (player) {
        t.ok(player.mmr <= preMMR, 'mmr is sorted in top players');
        preMMR = player.mmr;
      });
    } catch (e) {
      console.log(e.error);
      t.fail('should be able to get top user list');
    }

    await runMatch(t, [
      USER_STR_1,
      USER_STR_7,
      USER_STR_8,
      USER_STR_9,
      USER_STR_5
    ], [
      USER_STR_6,
      USER_STR_2,
      USER_STR_3,
      USER_STR_4,
      USER_STR_0
    ]);

    try {
      let data = await get('top');
      t.equals(data.length, 10, 'has top players');
      let preMMR = data[0].mmr;
      data.forEach(function (player) {
        t.ok(player.mmr <= preMMR, 'mmr is sorted in top players');
        preMMR = player.mmr;
      });
    } catch (e) {
      console.log(e.error);
      t.fail('should be able to get top user list');
    }

    await runMatch(t, [
      USER_STR_1,
      USER_STR_7,
      USER_STR_8,
      USER_STR_9,
      USER_STR_5
    ], [
      USER_STR_6,
      USER_STR_2,
      USER_STR_3,
      USER_STR_4,
      USER_STR_0
    ]);

    try {
      let data = await get('top');
      t.equals(data.length, 10, 'has top players');
      let preMMR = data[0].mmr;
      data.forEach(function (player) {
        t.ok(player.mmr <= preMMR, 'mmr is sorted in top players');
        preMMR = player.mmr;
      });
    } catch (e) {
      console.log(e.error);
      t.fail('should be able to get top user list');
    }

    await runMatch(t, [
      USER_STR_1,
      USER_STR_7,
      USER_STR_8,
      USER_STR_9,
      USER_STR_0
    ], [
      USER_STR_6,
      USER_STR_2,
      USER_STR_3,
      USER_STR_4,
      USER_STR_5
    ]);

    try {
      let data = await get('top');
      console.log(data);
    } catch (e) {
      console.log(e.error);
      t.fail('should be able to get top user list');
    }

    t.end();
  });
  t.test('end', function (t) {
    server.close();
    t.end();
  });
});

async function post (path, data, token) {
  var text = JSON.stringify(data || {});

  return request({
    method: 'POST',
    uri: 'http://localhost:' + TEST_PORT + '/' + path,
    body: data || {},
    json: true,
    headers: {
      'X-Auth-Token': token,
      'auth-checksum': sha('sha256').update(text + AUTHKEY).digest('hex')
    }
  });
}

async function get (path, data) {
  return request({
    method: 'GET',
    uri: 'http://localhost:' + TEST_PORT + '/' + path,
    qs: data || {},
    json: true
  });
}

async function runMatch (t, radiant, dire) {
  var token = null;
  var allPlayers = [].concat(radiant).concat(dire);
  try {
    let data = await post('auth', {
      users: allPlayers,
      gametime: (new Date()).toString() + Math.random(),
      toolsMode: false,
      cheatsMode: false
    });
    t.ok(data.token, 'gets auth token');
    t.ok(data.match, 'gets match data');
    t.ok(data.userData, 'gets userdata with mmr values');
    token = data.token;

    Object.keys(data.userData).forEach(function (user) {
      t.equals(data.userData[user].mmr, 1000, 'new user mmr is 1000');
    });
  } catch (e) {
    t.fail('Should allow auth when all params are sent');
  }

  try {
    let data =
    await post('match/send_teams', {
        radiant: radiant,
        dire: dire
      }, token);

    t.ok(data.ok, 'should work');
  } catch (e) {
    console.log(e);
    t.fail('Should be able to lock in teams');
  }

  try {
    let data = await post('match/complete', {
      winner: 'dire',
      endTime: (new Date()).toString() + Math.random(),
      gameLength: 123,
      players: allPlayers
    }, token);

    t.ok(data.ok, 'should work');
  } catch (e) {
    console.log(e.error);
    t.fail('Should be able to send in results');
  }
}

async function wait (ms) {
  return new Promise(function (resolve, reject) {
    setTimeout(resolve, ms);
  });
}
