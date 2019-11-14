const Joi = require('joi');
const Boom = require('boom');
const uuidv4 = require('uuid/v4');
const { partial } = require('ap');
const CreateModel = require('./model');

module.exports = Team;

const PlayerList = Joi.array().items(Joi.object()).default([]);
const TeamValidator = Joi.object().keys({
  // id as used in API's
  id: Joi.string().required(),

  name: Joi.string().default('Team Name'),
  captain: Joi.string().required(),

  invite: Joi.string(),

  players: PlayerList
});

function Team (options, db, users) {
  var model = CreateModel(TeamValidator, 'id', db);
  users.addUserProperty('team', model, async function mapUserToProp(id, userPromise) {
    const user = await userPromise;
    return user.teamId && user.teamId.length ? user.teamId : null;
  }, async function propGetter(prop, propId) {
    try {
      const props = await model.rawGet(propId);
      delete props.invite;
      return props;
    } catch (e) {
      console.error(e);
      return null;
    }
  });

  model.generateInvite = generateInvite;
  model.findTeamByInvite = partial(findTeamByInvite, model);


  const oldGet = model.get;
  const oldGetOrCreate = model.getOrCreate;

  model.rawGet = oldGet;
  model.get = getter(oldGet);
  model.getOrCreate = getter(oldGetOrCreate);

  function getter (method) {
    return async function get (id, data) {
      const team = await method(id, data);

      team.players = await Promise.all(team.players.map(async (player) => {
        const user = await users.rawGet(player.steamid);
        return {...player,
          mmr: user.unrankedMMR
        };
      }));

      return team;
    };
  }
  return model;
}

async function findTeamByPlayer (model, steamid) {
  return new Promise((resolve, reject) => {
    const found = [];
    model.createReadStream()
      .on('data', function (data) {
        const teamData = JSON.parse(data.value);
        const entry = teamData.players.filter(p => p.steamid === steamid);
        if (entry.length) {
          found.push(teamData);
        }
      })
      .on('error', function (err) {
        if (!found) {
          reject(err);
        }
      })
      .on('end', async function () {
        resolve(found);
      });
  });
}

async function findTeamByInvite (model, invite) {
  return new Promise((resolve, reject) => {
    let found = false;
    model.createReadStream()
      .on('data', function (data) {
        if (found) {
          return;
        }
        var teamData = JSON.parse(data.value);
        if (teamData.invite === invite) {
          found = true;
          resolve(teamData);
        }
      })
      .on('error', function (err) {
        if (!found) {
          reject(err);
        }
      })
      .on('end', async function () {
        if (!found) {
          reject(Boom.notFound('No team found with that invite code'));
        }
      });
  });
}

function generateInvite () {
  return uuidv4();
}
