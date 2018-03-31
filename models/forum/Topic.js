var mongoose = require('mongoose')
var TopicSchema = require('../../schemas/forum/topics.js')

module.exports = mongoose.model('Topic', TopicSchema)
