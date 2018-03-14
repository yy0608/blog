var mongoose = require('mongoose');
var merchantUserSchema = require('../../schemas/clothes/merchant_users.js');

module.exports = mongoose.model('MerchantUser', merchantUserSchema);
