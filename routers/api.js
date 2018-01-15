var express = require('express')

var router = express.Router()

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
  if (!resBody) {
    responseData.code = 9
    responseData.msg = '请求数据处理出错'
    res.json(responseData)
    return
  }
  if (!resBody.username.trim()) {
    responseData.code = 1
    responseData.msg = '用户名不能为空'
    res.json(responseData)
    return
  }
  if (!resBody.password.trim()) {
    responseData.code = 2
    responseData.msg = '密码不能为空'
    res.json(responseData)
    return
  }
})

module.exports = router
