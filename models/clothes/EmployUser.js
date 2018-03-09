var mongoose = require('mongoose');
var employUserSchema = require('../../schemas/clothes/employ_users.js');

module.exports = mongoose.model('EmployUser', employUserSchema);
