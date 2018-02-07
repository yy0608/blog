var mongoose = require('mongoose')
var TopicSchema = require('../schemas/topics.js')

module.exports = mongoose.model('Topic', TopicSchema)
