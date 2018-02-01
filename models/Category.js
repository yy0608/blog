var mongoose = require('mongoose')
var categorySchema = require('../schemas/categories.js')

module.exports = mongoose.model('Category', categorySchema)
