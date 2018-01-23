const Boom = require('boom');
const partial = require('ap').partial;
const extend = require('xtend');
const createStore = require('weakmap-shim/create-store');

var CACHE_ID = 0;

module.exports = CreateModel;

function CreateModel (ModelValidator, idkey, db) {
  const CacheStore = createStore;
  var cache = {};

  return {
    close: partial(close, db),
    getOrCreate: partial(getOrCreate, db),
    get: partial(get, db),
    put: partial(put, db)
  };

  async function open (db, id, method) {
    var cacheID = CACHE_ID;
    CACHE_ID = CACHE_ID + 1;

    if (cache[id]) {
      cache[id].opened++;
      if (cache[id].opened > 20) {
        console.log('This is almost certainly broken', idkey, id);
        console.log(method);
      }
    } else {
      cache[id] = {
        opened: 1,
        cacheID: cacheID,
        value: decoratedMethod()
      };
    }

    return cache[id].value;

    async function decoratedMethod () {
      var data = await method();
      CacheStore(data).cached = true;
      CacheStore(data).cacheID = cacheID;
      return data;
    }
  }
  function close (db, data) {
    if (!CacheStore(data).cached) {
      return;
    }
    if (CacheStore(data).closed) {
      throw Boom.badImplementation('Tried to close an already closed value');
    }
    var id = data[idkey];

    CacheStore(data).closed = true;
    if (cache[id]) {
      if (CacheStore(data).cacheID !== cache[id].cacheID) {
        throw Boom.badImplementation('Tried to close an old cache entry');
      }
      cache[id].opened--;

      if (cache[id].opened === 0) {
        delete cache[id];
      }
    }
  }

  async function put (db, data) {
    close(db, data);
    return _put(db, data);
  }
  async function _put (db, data) {
    var result = ModelValidator.validate(data);

    if (result.error) {
      throw Boom.badRequest(result.error);
    }

    data = result.value;

    await db.put(data[idkey], JSON.stringify(data));
    return data;
  }

  async function get (db, id) {
    // basically just to let the error fire
    var data = await _get(db, id);
    var originalData = data;
    // once the error's had it's chance, we open the data
    // if it's already open we get the reference,
    // otherwise we register our own data
    data = await open(db, id, async function () {
      return originalData;
    });

    return data;
  }
  async function _get (db, id) {
    var data = await db.get(id);
    data = JSON.parse(data);

    var result = ModelValidator.validate(data);

    if (result.error) {
      throw Boom.badRequest(result.error);
    }

    data = result.value;

    return data;
  }

  async function getOrCreate (db, id, defaultData) {
    return open(db, id, partial(_getOrCreate, db, id, defaultData));
  }
  async function _getOrCreate (db, id, defaultData) {
    if (!defaultData) {
      defaultData = {};
    }
    try {
      var data = await _get(db, id);
      console.log(data);
      return data;
    } catch (err) {
      if (err.notFound) {
        var newObj = extend(defaultData);
        newObj[idkey] = id;
        return _put(db, newObj);
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
