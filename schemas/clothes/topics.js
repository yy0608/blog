var mongoose = require('mongoose');

module.exports = new mongoose.Schema({
  author_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmployUser',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  content: {
    type: [{}]
  }
}, {
  versionKey: false, // 去掉__v字段
  timestamps: true // 添加创建时间和更新时间
})
