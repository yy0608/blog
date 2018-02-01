var mongoose = require('mongoose')

module.exports = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  desc: {
    type: String,
    unique: false
  }
})
