var express = require('express')
var User = require('../models/User.js')
var Category = require('../models/Category.js')
var router = express.Router()

var responseData

router.use(function (req, res, next) { // 有权限才能拿到后台数据
  var _id = req.cookies.get('_id')
  responseData = {
    code: 0,
    msg: ''
  }
  if (!_id) {
    responseData.code = 1
    responseData.msg = '_id不存在'
    res.json(responseData)
    return
  }
  try {
    _id = JSON.parse(_id)
  } catch (e) {
    _id = _id
  }
  User.findOne({
    _id
  }).then(res => {
    if (!res) {
      responseData.code = 2
      responseData.msg = '用户不存在'
      res.json(responseData)
      return
    }
    if (!res.isAdmin) {
      responseData.code = 3
      responseData.msg = '用户无权限'
      res.json(responseData)
      return
    }
    next()
  }).catch(err => {
    responseData.code = 9
    responseData.msg = '查询数据库出错'
    responseData.message = err
    res.json(responseData)
    return
  })
})

router.get('/user/list', function (req, res, next) { // 注意此处获取用户条数和isNaN方法
  var reqQuery = req.query
  var parsePage = parseInt(reqQuery.page)
  var parseLimit = parseInt(reqQuery.limit)
  var page = isNaN(parsePage) || parsePage <= 0 ? 1 : parsePage
  var limit = isNaN(parseLimit) ? 2 : parseLimit
  var skip = (page - 1) * limit
  User.count().then(count => {
    // User.find({}, null, {
    //   limit,
    //   skip
    // }).then(data => {
    //   responseData.msg = '获取用户列表成功'
    //   responseData.user_list = data
    //   responseData.total_count = count
    //   res.json(responseData)
    //   return
    // }).catch(err => {
    //   responseData.code = 9
    //   responseData.msg = '查询用户列表出错'
    //   responseData.message = err
    //   res.json(responseData)
    // })
    User.find().limit(limit).skip(skip)
      .then(data => {
        responseData.msg = '获取用户列表成功'
        responseData.user_list = data
        responseData.total_count = count
        res.json(responseData)
        return
      })
      .catch(err => {
        responseData.code = 9
        responseData.msg = '查询用户列表出错'
        responseData.message = err
        res.json(responseData)
      })
    })
    .catch(err => {
      responseData.code = 8
      responseData.msg = '查询用户总数出错'
      responseData.message = err
      res.json(responseData)
    })
})

router.post('/user/delete', function (req, res, next) {
  var _id = req.body._id
  User.remove({
    _id: _id
  }).then(data => {
    responseData.msg = '删除用户成功'
    res.json(responseData)
  }).catch(err => {
    responseData.code = 9
    responseData.msg = '删除用户失败'
    responseData.message = err
    res.json(responseData)
  })
})

router.get('/category/list', function (req, res) {
  var reqQuery = req.query
  var parsePage = parseInt(reqQuery.page)
  var parseLimit = parseInt(reqQuery.limit)
  var page = isNaN(parsePage) || parsePage <=0 ? 1 : parsePage
  var limit = isNaN(parseLimit) ? 2 : parseLimit
  var skip = (page - 1) * limit
  Category.count()
    .then(count => {
      Category.find().limit(limit).skip(skip)
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

router.post('/category/add', function (req, res) {
  var reqBody = req.body
  var category = new Category({
    name: reqBody.name,
    desc: reqBody.desc
  })
  category.save()
    .then(data => {
      responseData.msg = '保存分类成功'
      res.json(responseData)
    })
    .catch(err => {
      responseData.code = 2
      responseData.msg = '保存分类失败'
      responseData.message = err
      res.json(responseData)
    })
})

module.exports = router
