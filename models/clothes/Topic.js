var mongoose = require('mongoose');
var topicSchema = require('../../schemas/clothes/topics.js');

module.exports = mongoose.model('Topic', topicSchema);
