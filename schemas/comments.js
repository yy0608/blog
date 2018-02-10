var mongoose = require('mongoose')

module.exports = new mongoose.Schema({
  topic_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic'
  },
  author_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  comment: {
    type: String,
    require: true
  },
  created_ts: {
    type: Number,
    default: Date.now()
  }
})
