var mongoose = require('mongoose')

module.exports = new mongoose.Schema({
  topic_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    required: true
  },
  author_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  comment: {
    type: String,
    require: true
  },
  status: { // -2：需要再次审核，-1：未审核，0：审核通过，1：水贴，2：广告，3：涉黄，4：暴力
    type: Number,
    default: -1
  },
  like_count: { // 点赞量
    type: Number,
    default: 0
  }
}, {
  versionKey: false, // 去掉__v字段
  timestamps: true // 添加创建时间和更新时间
})
