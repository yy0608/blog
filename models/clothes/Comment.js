var mongoose = require('mongoose');
var commentSchema = require('../../schemas/clothes/comments.js');

module.exports = mongoose.model('Comment', commentSchema);
