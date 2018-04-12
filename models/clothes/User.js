var mongoose = require('mongoose');
var userSchema = require('../../schemas/clothes/users.js');

module.exports = mongoose.model('User', userSchema);
