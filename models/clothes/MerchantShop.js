var mongoose = require('mongoose');
var merchantShopSchema = require('../../schemas/clothes/merchant_shops.js');

module.exports = mongoose.model('MerchantShop', merchantShopSchema);
