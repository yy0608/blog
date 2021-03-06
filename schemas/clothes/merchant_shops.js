var mongoose = require('mongoose')

module.exports = new mongoose.Schema({
  merchant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MerchantUser'
  },
  name: {
    type: String,
    required: true
  },
  desc: {
    type: String,
    required: true
  },
  logo: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  location: {
    type: [ Number ],
    index: {
      type: '2dsphere',
      sparse: true
    }
  },
  manager: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  remark: {
    type: String
  }
}, {
  versionKey: false, // 去掉__v字段
  timestamps: true // 添加创建时间和更新时间
})
