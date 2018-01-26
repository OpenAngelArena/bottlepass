const Boom = require('boom');
const partial = require('ap').partial;
const extend = require('xtend');

module.exports = CreateModel;

function CreateModel (ModelValidator, idkey, db) {
  return {
    getOrCreate: partial(getOrCreate, db),
    get: partial(get, db),
    put: partial(put, db),
    createReadStream: db.createReadStream.bind(db)
  };

  async function put (db, data) {
    var result = ModelValidator.validate(data);

    if (result.error) {
      throw Boom.badRequest(result.error);
    }

    data = result.value;

    await db.put(data[idkey], JSON.stringify(data));
    return data;
  }

  async function get (db, id) {
    var data = await db.get(id);
    data = JSON.parse(data);
    console.log(data);

    var result = ModelValidator.validate(data);

    if (result.error) {
      throw Boom.badRequest(result.error);
    }

    data = result.value;

    return data;
  }

  async function getOrCreate (db, id, defaultData) {
    if (!defaultData) {
      defaultData = {};
    }
    try {
      var data = await get(db, id);
      return data;
    } catch (err) {
      if (err.notFound) {
        var newObj = extend(defaultData);
        newObj[idkey] = id;
        return put(db, newObj);
      }
      return returnError(err);
    }
  }

  async function returnError (err) {
    if (Boom.isBoom(err)) {
      throw err;
    } else {
      throw Boom.boomify(err);
    }
  }
}
