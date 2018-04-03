var mongoose = require('mongoose');

module.exports = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  manager: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  address: {
    type: String,
    address: true
  },
  desc: {
    type: String
  },
  email: {
    type: String
  },
  email_verified: {
    type: Boolean,
    default: false
  }
}, {
  versionKey: false, // 去掉__v字段
  timestamps: true // 添加创建时间和更新时间
})
