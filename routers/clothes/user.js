var express = require('express');
var router = express.Router();

var User = require('../../models/clothes/User.js');

router.post('/register', function (req, res, next) {
  var reqBody = req.body;
  var username = reqBody.username;
  var password = reqBody.password;

  if (!username || !password) {
    return res.json({
      success: false,
      msg: '缺少参数或参数错误'
    })
  }

  User.findOne({ username: username })
    .then(data => {
      if (data) {
        return res.json({
          success: true,
          msg: '用户名已存在'
        })
      }

      var user = new User({
        username: username,
        password: password
      })
      user.save()
        .then(() => {
          res.json({
            success: true,
            msg: '注册成功'
          })
        })
        .catch(err => {
          res.json({
            success: false,
            msg: '注册失败',
            err: err.toString()
          })
        })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '注册失败',
        err: err.toString()
      })
    })
})

router.get('/list', function (req, res, next) {
  User.find()
    .then(data => {
      res.json({
        success: true,
        msg: '获取用户列表成功',
        data: data
      })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '获取用户列表失败',
        err: err.toString()
      })
    })
})

module.exports = router
