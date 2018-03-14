var mongoose = require('mongoose')

module.exports = new mongoose.Schema({
  merchant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MerchantUser'
  },
  logo: {
    type: String,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  latitude: {
    type: Number,
    required: true
  },
  created_ts: {
    type: Number,
    default: Date.now()
  }
})
