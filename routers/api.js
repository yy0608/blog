var express = require('express')
var router = express.Router()
var User = require('../models/User.js')
var mongoose = require('mongoose')
mongoose.Promise = global.Promise

var responseData

router.use(function (req, res, next) {
  responseData = {
    code: 0,
    msg: ''
  }
  next()
})

router.post('/user/register', function (req, res, next) {
  var resBody = req.body
  var username = resBody.username
  var password = resBody.password
  if (!resBody) {
    responseData.code = 9
    responseData.msg = '请求数据处理出错'
    res.json(responseData)
    return
  }
  if (username && !username.trim()) {
    responseData.code = 1
    responseData.msg = '用户名不能为空'
    res.json(responseData)
    return
  }
  if (password && !password.trim()) {
    responseData.code = 2
    responseData.msg = '密码不能为空'
    res.json(responseData)
  }
  User.findOne({
    username: username
  }).then(data => {
    if (data) {
      responseData.code = 3
      responseData.msg = '已有相同用户名'
      return Promise.resolve(responseData)
    } // 没有存在用户名
    var user = new User({
      username: username,
      password: password
    })
    return user.save()
  }).then(data => {
    if (data.code === 3) {
      res.json(data)
    } else {
      responseData.msg = '注册成功'
      res.json(responseData)
    }
    return
  }).catch(err => {
    responseData.code = 9
    responseData.msg = '数据库查找出错'
    res.json(responseData)
    return
  })
})

router.post('/user/login', function (req, res, next) {
  var resBody = req.body
  var username = resBody.username
  var password = resBody.password
  if (!resBody || !username || !password) {
    responseData.code = 9
    responseData.msg = '请求数据出错'
    res.json(responseData)
    return
  }
  if (username && !username.trim()) {
    responseData.code = 1
    responseData.msg = '用户名不能为空'
    res.json(responseData)
    return
  }
  if (password && !password.trim()) {
    responseData.code = 2
    responseData.msg = '密码不能为空'
    res.json(responseData)
  }
  User.findOne({
    username: username
  }).then(data => {
    if (!data || data.password !== password) {
      responseData.code = 4
      responseData.msg = '用户名或密码错误'
      res.json(responseData)
      return
    } else {
      responseData.msg = '登录成功'
      responseData.user_info = {
        _id: data._id,
        username: data.username
      }
      req.cookies.set('userInfo', JSON.stringify(responseData.user_info))
      res.json(responseData)
      return
    }
  }).catch(err => {
    responseData.code = 9
    responseData.msg = '数据库查找出错'
    responseData.error = err
    res.json(responseData)
    return
  })
})

module.exports = router
