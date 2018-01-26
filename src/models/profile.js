const Joi = require('joi');
const CreateModel = require('./model');
const IDConvertor = require('steam-id-convertor');
const request = require('request-promise');
const partial = require('ap').partial;
module.exports = Profile;

const ProfileValidator = Joi.object().keys({
  // steamid as used in API's
  steamid: Joi.string().required(),

  lastUpdated: Joi.number().default(() => Date.now(), 'now'),

  steam64Id: Joi.string(),
  name: Joi.string(),
  profileurl: Joi.string().uri(),
  avatar: Joi.string().uri()
});

function Profile (options, db, users) {
  var model = CreateModel(ProfileValidator, 'steamid', db);
  users.addUserProperty('profile', model);

  delete model.get;
  var oldGetOrCreate = model.getOrCreate;

  if (options.steamkey) {
    model.getOrCreate = getOrCreate;
  }

  return model;

  async function getOrCreate (id, requeue) {
    if (id === 0) {
      return {
        name: 'Dota 2 Bot'
      };
    }
    var data = await oldGetOrCreate(id, {
      lastUpdated: Date.now()
    });
    if (!data.name) {
      data = await queueProfileRead(options, model, id);
    } else if (requeue && Date.now() - data.lastUpdated > 60000) {
      queueProfileRead(options, model, id);
    }

    return data;
  }
}

var runningRequest = null;
var idQueue = {};

async function queueProfileRead (options, model, steamid) {
  var id64 = IDConvertor.to64(steamid);

  if (!idQueue[id64]) {
    console.log('queueing ', steamid, id64);
  }

  idQueue[id64] = true;

  if (runningRequest) {
    await runningRequest;
  }
  await wait(1000);
  var userData = await checkRequestUsers(options, model);

  if (!userData) {
    userData = {};
  }
  if (!userData[id64]) {
    userData[id64] = {
      lastUpdated: Date.now(),
      name: 'Unknown',
      steamid: id64
    };
  }

  return userData[id64];
}

async function checkRequestUsers (options, model) {
  if (!runningRequest) {
    runningRequest = getUserProfiles(options, model);
    runningRequest.then(() => runningRequest = null);
  }
  return runningRequest;
}

async function getUserProfiles (options, model) {
  var idList = Object.keys(idQueue).splice(20);
  if (!idList.length) {
    console.log('Theres no id list');
    return;
  }
  idList.forEach(function (id) {
    delete idQueue[id];
  });
  var url = 'http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=' + options.steamkey + '&steamids=' + idList.join(',');

  console.log(url);

  var data = await request({
    method: 'GET',
    uri: url,
    json: true
  });

  console.log('Request complete, data: ', data);
  var result = {};

  await Promise.all(data.response.players.map(async function (player) {
    result[player.steamid] = {
      steamid: IDConvertor.to32(player.steamid),
      steam64Id: player.steamid,
      name: player.personaname,
      profileurl: player.profileurl,
      avatar: player.avatarfull,
      lastUpdated: Date.now()
    };

    return model.put(result[player.steamid]);
  }));

  await wait(1000);

  if (Object.keys(idQueue).length) {
    setTimeout(partial(checkRequestUsers, options, model));
  }

  return result;
}

async function wait (ms) {
  return new Promise(function (resolve, reject) {
    setTimeout(resolve, ms);
  });
}
