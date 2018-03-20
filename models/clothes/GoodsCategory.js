var mongoose = require('mongoose');
var goodsCategorySchema = require('../../schemas/clothes/goods_categories.js');

module.exports = mongoose.model('GoodsCategory', goodsCategorySchema);
