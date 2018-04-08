var mongoose = require('mongoose')

module.exports = new mongoose.Schema({
  merchant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MerchantUser',
    required: true,
  },
  shop_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MerchantShop',
    required: true,
  },
  category_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GoodsCategory',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  valuation: {
    type: Number,
    required: true
  },
  figure_imgs: {
    type: [],
    required: true
  },
  detail_imgs: {
    type: [],
    required: true
  }
}, {
  versionKey: false, // 去掉__v字段
  timestamps: true // 添加创建时间和更新时间
})
