var express = require('express');
var router = express.Router();

var crypto = require('crypto');

var session = require('express-session');
var RedisStore = require('connect-redis')(session);

var EmployUser = require('../../models/clothes/EmployUser.js');

var CaptchaSDK = require('dx-captcha-sdk')
var captcha = new CaptchaSDK('b971bdbee8e1d2780783782d066d0cf8', 'de85519b7bded1dab9a2ad1f4db195a5')

router.use(session({
  secret: 'clothes_session',
  name: 'leave-me-alone', // 留在首页的cookie名称
  store: new RedisStore({
    client: global.redisClient,
    // host: 'localhost',
    // port: 6379
  }),
  cookie: {
    maxAge: 300 * 1000
  },
  resave: true, // :(是否允许)当客户端并行发送多个请求时，其中一个请求在另一个请求结束时对session进行修改覆盖并保存。如果设置false，可以使用.touch方法，避免在活动中的session失效。
  saveUninitialized: false // 初始化session时是否保存到存储
}))

router.post('/login', function (req, res, next) {
  var reqBody = req.body;
  if (JSON.stringify(reqBody) === '{}' && req.session.userInfo) {
    var userInfo = {}
    try {
      userInfo = JSON.parse(req.session.userInfo)
      res.json({
        success: true,
        msg: '登录状态有效',
        user_info: userInfo
      })
    } catch (e) {
      res.json({
        success: false,
        msg: '解析错误'
      })
    }
    return
  }
  var username = reqBody.username && reqBody.username.trim();
  var password = reqBody.password;
  var dxToken = reqBody.dxToken;
  if (!username || !password || !dxToken) {
    res.json({
      success: false,
      msg: '缺少参数'
    })
    return
  }
  captcha.verifyToken(dxToken)
    .then((response) => {
      var hash = crypto.createHash('md5');
      hash.update('开门大吉--' + password + '--万事如意');
      EmployUser.findOne({
        username: username,
        password: hash.digest('hex')
      })
        .then(data => {
          if (data) {
            req.session.userInfo = JSON.stringify(data)
            res.json({
              success: true,
              msg: '登录成功',
              user_info: data
            })
          } else {
            res.json({
              success: false,
              msg: '用户不存在'
            })
          }
        })
        .catch(err => {
          res.json({
            success: false,
            msg: '登录失败',
            err: err
          })
        })
    }).catch(err => {
      console.log(err)
      res.json({
        success: false,
        code: 10001,
        msg: '验证码错误或失效，请重新验证',
        err_msg: err
      })
    })
})

router.post('/logout', function (req, res, next) {
  req.session.userInfo = '';
  res.json({
    success: true,
    msg: '退出成功'
  })
})

router.post('/add', function (req, res, next) {
  var reqBody = req.body;
  var username = reqBody.username && reqBody.username.trim();
  var password = reqBody.password;
  var name = reqBody.name;
  if (!username || !password || !name) {
    res.json({
      success: false,
      msg: '缺少参数'
    })
    return
  }
  EmployUser.findOne({
    username: username
  })
    .then(data => {
      if (data) {
        res.json({
          success: false,
          msg: '用户已存在'
        })
      } else {
        var hash = crypto.createHash('md5');
        hash.update('开门大吉--' + password + '--万事如意');
        var user = new EmployUser({
          username: username,
          name: name,
          password: hash.digest('hex')
        })
        user.save()
          .then(data => {
            res.json({
              success: true,
              msg: '添加用户成功'
            })
          })
          .catch(err => {
            res.json({
              success: false,
              msg: '添加用户失败',
              err: err
            })
          })
      }
    })
})

router.post('/delete', function (req, res, next) {
  var reqBody = req.body;
  var _id = reqBody._id && reqBody._id.trim();
  if (!_id) {
    res.json({
      success: false,
      msg: '缺少参数'
    })
  } else {
    EmployUser.remove({
      _id: _id
    })
      .then(data => {
        res.json({
          success: true,
          msg: '删除用户成功'
        })
      })
      .catch(err => {
        res.json({
          success: false,
          msg: '删除用户失败',
          err: err
        })
      })
  }
})

router.get('/list', function (req, res, next) {
  EmployUser.find()
    .then(data => {
      res.json({
        success: true,
        msg: '查询用户列表成功',
        list: data
      })
    })
    .catch(err => {
      res.json({
        success: true,
        msg: '查询用户列表失败',
        err: err
      })
    })
})

module.exports = router
