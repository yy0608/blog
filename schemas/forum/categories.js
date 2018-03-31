var mongoose = require('mongoose')

module.exports = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  desc: {
    type: String,
    required: false
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
