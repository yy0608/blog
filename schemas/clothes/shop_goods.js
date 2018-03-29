var mongoose = require('mongoose')

module.exports = new mongoose.Schema({
  shop_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MerchantShop'
  },
  category_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GoodsCategory'
  },
  title: {
    type: String,
    required: true
  },
  desc: {
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
  },
  created_ts: {
    type: Number,
    default: Date.now()
  }
}, {
  versionKey: false // 去掉__v字段
})
