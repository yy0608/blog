var express = require('express')
var router = express.Router()
var Category = require('../models/Category.js')
var Topic = require('../models/Topic.js')

router.get('/category/list', function (req, res, next) {
  var responseData = {
    code: 0,
    msg: ''
  }
  var reqQuery = req.query
  var parsePage = parseInt(reqQuery.page)
  var parseLimit = parseInt(reqQuery.limit)
  var page = isNaN(parsePage) || parsePage <=0 ? 1 : parsePage
  var limit = isNaN(parseLimit) ? 10 : parseLimit
  var skip = (page - 1) * limit
  Category.count()
    .then(count => {
      Category.find({}, {
        name: 1
      }).limit(limit).skip(skip)
        .then(data => {
          responseData.msg = '获取分类列表成功'
          responseData.total_count = count
          responseData.category_list = data
          res.json(responseData)
        })
        .catch(err => {
          responseData.code = 2
          responseData.msg = '获取分类列表失败'
          responseData.message = err
          res.json(responseData)
        })
    })
    .catch(err => {
      responseData.code = 8
      responseData.msg = '查询分类总数出错'
      responseData.message = err
      res.json(responseData)
    })
})

router.get('/topic/list', function (req, res, next) {
  var responseData = {
    code: 0,
    msg: ''
  }
  var reqQuery = req.query
  var parsePage = parseInt(reqQuery.page)
  var parseLimit = parseInt(reqQuery.limit)
  var categoryId = reqQuery._id
  var where = categoryId ? { category: categoryId } : {}
  var page = isNaN(parsePage) || parsePage <=0 ? 1 : parsePage
  var limit = isNaN(parseLimit) ? 10 : parseLimit
  var skip = (page - 1) * limit
  Topic.count(where)
    .then(count => {
      responseData.total_count = count
      Topic.find(where, { updated_ts: 0, __v: 0 }).limit(limit).skip(skip).sort({ _id: -1 }).populate([{
        path: 'category',
        select: {
          _id: 0,
          name: 1
        }
      }, {
        path: 'author',
        select: {
          username: 1,
          _id: 0
        }
      }])
        .then(data => {
          responseData.msg = '查询文章列表成功'
          responseData.topic_list = data
          res.json(responseData)
        })
        .catch(err => {
          console.log(err)
          responseData.code = 8
          responseData.msg = '查询文章列表失败'
          responseData.message = err
          res.json(responseData)
        })
    })
    .catch(err => {
      console.log(err)
      responseData.code = 9
      responseData.msg = '查询是否有相同分类名称失败'
      responseData.message = err
      res.json(responseData)
    })
})

module.exports = router