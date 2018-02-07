var mongoose = require('mongoose')

module.exports = mongoose.Schema({
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  title: {
    type: String,
    required: true
  },
  intro: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  created_ts: {
    type: Number,
    default: Date.now()
  },
  updated_ts: {
    type: Number,
    default: 0
  }
})