var mongoose = require('mongoose')
var categorySchema = require('../../schemas/forum/categories.js')

module.exports = mongoose.model('Category', categorySchema)
