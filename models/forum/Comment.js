var mongoose = require('mongoose')
var CommentSchema = require('../../schemas/forum/comments.js')

module.exports = mongoose.model('Comment', CommentSchema)
