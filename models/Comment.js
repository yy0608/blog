var mongoose = require('mongoose')
var CommentSchema = require('../schemas/comments.js')

module.exports = mongoose.model('Comment', CommentSchema)
