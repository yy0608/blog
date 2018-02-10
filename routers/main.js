var express = require('express')
var router = express.Router()
var Category = require('../models/Category.js')
var Topic = require('../models/Topic.js')
var Comment = require('../models/Comment.js')

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

router.get('/topic/detail', function (req, res, next) {
  var responseData = {
    code: 0,
    msg: ''
  }
  var reqQuery = req.query
  var _id = reqQuery._id
  var parsePage = parseInt(reqQuery.page)
  var parseLimit = parseInt(reqQuery.limit)
  var categoryId = reqQuery._id
  var where = categoryId ? { category: categoryId } : {}
  var page = isNaN(parsePage) || parsePage <=0 ? 1 : parsePage
  var limit = isNaN(parseLimit) ? 10 : parseLimit
  var skip = (page - 1) * limit
  Comment.count({ topic_id: _id })
    .then(count => {
      Comment.find({ topic_id: _id }, {
        topic_id: 0,
        __v: 0
      }).limit(limit).skip(skip).populate({
        path: 'author_id',
        select: {
          _id: 0,
          username: 1
        }
      }).sort({ _id: -1 })
        .then(commentsData => {
          Topic.findOne({ _id: _id }, {
            __v: 0,
            updated_ts: 0,
            _id: 0
          }).populate([{
            path: 'category',
            select: {
              name: 1,
              _id: 0
            }
          }, {
            path: 'author',
            select: {
              username: 1
            }
          }])
            .then(data => {
              var view_count = data.view_count + 1
              Topic.update({
                _id: _id
              }, {
                view_count: view_count
              })
                .then(() => {
                  console.log('修改文章阅读数成功')
                })
                .catch(err => {
                  console.log('修改文章阅读数失败，err: ' + err)
                })
              if (data) {
                responseData.msg = '查找该_id的文章信息成功'
                responseData.detail = data
                responseData.comments = commentsData
                responseData.comments_count = count
                res.json(responseData)
              } else {
                responseData.code = 1
                responseData.msg = '无该_id的文章信息'
                res.json(responseData)
              }
            })
            .catch(err => {
              responseData.code = 9
              responseData.msg = '获取该文章息出错'
              responseData.message = err
              res.json(responseData)
            })
        })
        .catch(err => {
          console.log(err)
        })
    })
    .catch(err => {
      console.log('获取总数失败，err: ' + err)
    })
})

router.post('/topic/comment', function (req, res, next) {
  var responseData = {
    code: 0,
    msg: ''
  }
  var reqBody = req.body
  var comment = new Comment(reqBody)
  comment.save()
    .then(() => {
      responseData.msg = '评论成功'
      res.json(responseData)
    })
    .catch(err => {
      responseData.code = 9
      responseData.msg = '评论失败'
      responseData.message = err
      res.json(responseData)
    })
})

module.exports = router