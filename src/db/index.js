const Users = require('./users');

module.exports = DB;

function DB (option) {
  return {
    users: Users(options)
  };
}
