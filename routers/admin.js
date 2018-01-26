var express = require('express')
var User = require('../models/User.js')
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

router.get('/user_list', function (req, res, next) {
  var page = isNaN(parseInt(req.query.page)) ? 1 : parseInt(req.query.page)
  var limit = isNaN(parseInt(req.query.limit)) ? 2 : parseInt(req.query.limit)
  var skip = (page - 1) * limit
  User.find().limit(limit).skip(skip).then(data => {
    responseData.msg = '获取用户列表成功'
    responseData.user_list = data
    res.json(responseData)
    return
  }).catch(err => {
    responseData.code = 9
    responseData.msg = '查询数据库出错'
    responseData.message = err
    res.json(responseData)
  })
})

router.post('/user_delete', function (req, res, next) {
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

module.exports = router
