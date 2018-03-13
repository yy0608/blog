var express = require('express');
var router = express.Router();

var crypto = require('crypto');

var session = require('express-session');
var RedisStore = require('connect-redis')(session);

var EmployUser = require('../../models/clothes/EmployUser.js');
var MerchantUser = require('../../models/clothes/MerchantUser.js');

var CaptchaSDK = require('dx-captcha-sdk')
var captcha = new CaptchaSDK('b971bdbee8e1d2780783782d066d0cf8', 'de85519b7bded1dab9a2ad1f4db195a5')

var QcloudSms = require("qcloudsms_js") // 腾讯云短信服务

var utils = require('../../utils.js');

var smsConfig = {
  smsSign: '饭千金', // 签名
  appid: 1400070556,
  appkey: '32cf6a39ef9c100f8d1b68d835b1e995',
  templateId: 90192, // 模板ID
  smsType: 0 // Enum{0: 普通短信, 1: 营销短信}
}

var ssender = undefined

router.use(session({
  secret: 'clothes_session',
  name: 'leave-me-alone', // 留在首页的cookie名称
  store: new RedisStore({
    client: global.redisClient,
    // host: 'localhost',
    // port: 6379
  }),
  cookie: {
    maxAge: 30 * 60 * 1000
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
  req.session.userInfo = '';
  if (!username || !password || !dxToken) {
    res.json({
      success: false,
      msg: '缺少参数或session已过期'
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
      }, { password: 0 })
        .then(data => {
          if (data) {
            req.session.userInfo = JSON.stringify(data)
            res.json({
              success: true,
              msg: '登录成功',
              user_info: data
            })
          } else { // 用户不存在
            res.json({
              success: false,
              msg: '用户名或密码错误'
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
          .then(() => {
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

router.post('/add_merchant_sms', function (req, res, next) { // 添加商家时发送短信验证码
  var reqBody = req.body
  var phone = reqBody.phone
  if (!phone || phone.length !== 11) {
    res.json({
      success: false,
      msg: '手机号错误'
    })
    return
  }

  var qcloudsms = QcloudSms(smsConfig.appid, smsConfig.appkey)
  var code = Math.random().toString().substr(2, 6)
  ssender = ssender || qcloudsms.SmsSingleSender() // 单发短信
  global.redisClient.set(phone, code)
  global.redisClient.expire(phone, 120)
  // ssender = ssender || qcloudsms.SmsMultiSender() // 群发短信
  ssender.send(smsConfig.smsType, 86, phone, code + " 为您的登录验证码，请于 2 分钟内填写。如非本人操作，请忽略本短信。", "", "", function (err, response, resData) {
    if (err) {
      res.json({
        success: false,
        msg: '短信发送失败',
        err: err
      })
    } else {
      if (resData.result) {
        res.json({
          success: false,
          msg: '短信发送失败',
          err: resData
        })
      } else {
        global.redisClient.set(phone, code)
        global.redisClient.expire(phone, 300)
        res.json({
          success: true,
          msg: '短信发送成功',
          data: resData
        })
      }
    }
  });
})

router.post('/merchant_add', function (req, res, next) {
  var reqBody = req.body;
  var phone = reqBody.phone && reqBody.phone.trim();
  var manager = reqBody.manager;
  var email = reqBody.email;
  var name = reqBody.name;
  var address = reqBody.address;
  var desc = reqBody.desc;
  var code = reqBody.code;

  if (!phone || phone.length !== 11 || !manager || !email || !name || !address) {
    res.json({
      success: false,
      msg: '缺少参数或参数错误'
    })
    return;
  }

  global.redisClient.get(phone, function (err, v) {
    if (err) {
      res.json({
        success: false,
        msg: 'redis处理异常'
      })
      return
    }
    if (v !== code) {
      res.json({
        success: false,
        msg: '短信验证码错误或失效'
      })
    } else {
      MerchantUser.findOne({
        phone: phone
      })
        .then(data => {
          if (data) {
            res.json({
              success: false,
              msg: '手机号已注册'
            })
          } else {
            var password = utils.randomWord(true, 40, 43);
            var hash = crypto.createHash('md5');
            hash.update('开门大吉--' + password + '--万事如意');
            var merchantUser = new MerchantUser({
              phone: phone,
              password: hash.digest('hex'),
              manager: manager,
              email: email,
              name: name,
              address: address,
              desc: desc,
              create_ts: Date.now()
            })
            merchantUser.save()
              .then(() => {
                res.json({
                  success: true,
                  msg: '添加成功',
                  data: {
                    phone: phone,
                    password: password
                  }
                })
              })
              .catch(err => {
                res.json({
                  success: false,
                  msg: '添加失败',
                  err: err
                })
              })
          }
        })
      .catch(err => {
        res.json({
          success: false,
          msg: '数据库查询出错',
          err: err
        })
      })
    }
  })
})

module.exports = router
