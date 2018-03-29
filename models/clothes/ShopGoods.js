var mongoose = require('mongoose');
var shopGoodsSchema = require('../../schemas/clothes/shop_goods.js');

module.exports = mongoose.model('ShopGoods', shopGoodsSchema);
