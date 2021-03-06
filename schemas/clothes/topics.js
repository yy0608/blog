var mongoose = require('mongoose');

module.exports = new mongoose.Schema({
  author_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  content: {
    type: [{}]
  },
  status: { // -2：需要再次审核，-1：未审核，0：审核通过，1：水贴，2：广告，3：涉黄，4：暴力
    type: Number,
    default: -1
  },
  view_count: { // 浏览量
    type: Number,
    default: 0
  },
  liked_users: [{ // 点赞
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  versionKey: false, // 去掉__v字段
  timestamps: true // 添加创建时间和更新时间
})
