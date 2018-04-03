var mongoose = require('mongoose');

module.exports = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  desc: {
    type: String,
    required: true
  },
  level: {
    type: Number,
    required: true
  },
  icon: {
    type: String,
    default: ''
  },
  parent_id: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  }
}, {
  versionKey: false, // 去掉__v字段
  timestamps: true // 添加创建时间和更新时间
})
