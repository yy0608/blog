var express = require('express')
var router = express.Router()
var User = require('../../models/forum/User.js')
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
  var reqBody = req.body
  var username = reqBody.username
  var password = reqBody.password
  if (!reqBody) {
    responseData.code = 9
    responseData.msg = '请求数据处理出错'
    res.json(responseData)
    return
  }
  if (!username || !username.trim()) {
    responseData.code = 1
    responseData.msg = '用户名不能为空'
    res.json(responseData)
    return
  }
  if (!password && !password.trim()) {
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
      password: password,
      created_ts: Date.now()
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
    responseData.msg = '异常错误，具体请查看error信息'
    res.json(responseData)
    return
  })
})

router.post('/user/login', function (req, res, next) {
  var reqBody = req.body
  var username = reqBody.username
  var password = reqBody.password
  if (!reqBody) {
    responseData.code = 9
    responseData.msg = '请求数据出错'
    res.json(responseData)
    return
  }
  if (!username || !username.trim()) {
    responseData.code = 1
    responseData.msg = '用户名不能为空'
    res.json(responseData)
    return
  }
  if (!password || !password.trim()) {
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
      responseData.user_info = data
      try {
        req.cookies.set('_id', JSON.stringify(responseData.user_info._id), {
          httpOnly: false,
          signed: true
        })
      } catch (e) {
        console.log(e)
      }
      res.json(responseData)
      return
    }
  }).catch(err => {
    responseData.code = 9
    responseData.msg = '异常错误，具体请查看error信息'
    responseData.error = err
    res.json(responseData)
    return
  })
})

router.post('/user/logout', function (req, res, next) {
  req.cookies.set('_id', null, {
    httpOnly: false,
    signed: true
  })
  responseData.msg = '退出成功'
  res.json(responseData)
})

router.post('/user/getUserInfoById', function (req, res, next) {
  var _id = req.cookies.get('_id', { signed: true })
  try {
    _id = JSON.parse(_id)
  } catch (e) {
    _id = _id
  }
  if (!_id) {
    responseData.code = 1
    responseData.msg = '_id不存在'
    req.cookies.set('_id', null)
    res.json(responseData)
    return
  }
  User.findOne({
    _id: _id
  }, {
    created_ts: 0,
    password: 0,
    __v: 0
  }).then(data => {
    if (!data) {
      responseData.code = 2
      responseData.msg = '用户不存在'
      res.json(responseData)
      return
    } else {
      responseData.msg = '获取用户信息成功'
      responseData.user_info = data
      req.cookies.set('_id', data._id, {
        httpOnly: false,
        signed: true
      })
      res.json(responseData)
      return
    }
  }).catch(err => {
    responseData.code = 9
    responseData.msg = '异常错误，具体请查看error信息'
    responseData.error = err
    res.json(responseData)
    return
  })
})

module.exports = router
