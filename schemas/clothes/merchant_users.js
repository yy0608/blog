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
  created_ts: {
    type: Number,
    default: Date.now()
  }
}, {
  versionKey: false // 去掉__v字段
})
