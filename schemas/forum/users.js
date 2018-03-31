var mongoose = require('mongoose')
var Schema = mongoose.Schema

module.exports = new Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  created_ts: {
    type: Number,
    default: Date.now()
  }
})
