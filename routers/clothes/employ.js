var express = require('express');
var router = express.Router();

var crypto = require('crypto');

var qiniu = require('qiniu');

var session = require('express-session');
var RedisStore = require('connect-redis')(session);

var EmployUser = require('../../models/clothes/EmployUser.js');
var MerchantUser = require('../../models/clothes/MerchantUser.js');
var MerchantShop = require('../../models/clothes/MerchantShop.js');

var CaptchaSDK = require('dx-captcha-sdk')
var captcha = new CaptchaSDK('b971bdbee8e1d2780783782d066d0cf8', 'de85519b7bded1dab9a2ad1f4db195a5')

var QcloudSms = require("qcloudsms_js") // 腾讯云短信服务

var utils = require('../../utils.js');

var config = require('./config.js');

var smsConfig = config.smsConfig

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
      hash.update(config.passwordKey.left + password + config.passwordKey.right);
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
        hash.update(config.passwordKey.left + password + config.passwordKey.right);
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

  var code = Math.random().toString().substr(2, 6)
  // console.log(code)

  // global.redisClient.set(phone, code, function (err, res) {
  //   global.redisClient.expire(phone, 120)
  // })
  // res.json({
  //   success: true,
  //   msg: '短信发送成功'
  // })
  // return;

  var qcloudsms = QcloudSms(smsConfig.appid, smsConfig.appkey)
  var code = Math.random().toString().substr(2, 6)
  ssender = ssender || qcloudsms.SmsSingleSender() // 单发短信
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
        global.redisClient.set(phone, code, function (err, res) {
          global.redisClient.expire(phone, 120)
        })
        res.json({
          success: true,
          msg: '短信发送成功',
          data: resData
        })
      }
    }
  });
})

router.post('/merchant_add', function (req, res, next) { // 添加商家账号
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
      redisClient.del(phone); // 删除
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
            hash.update(config.passwordKey.left + password + config.passwordKey.right);
            var merchantUser = new MerchantUser({
              phone: phone,
              password: hash.digest('hex'),
              manager: manager,
              email: email,
              name: name,
              address: address,
              desc: desc,
              created_ts: Date.now()
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

router.get('/merchant_list', function (req, res, next) {
  var reqQuery = req.query
  var parsePage = parseInt(reqQuery.page)
  var parseLimit = parseInt(reqQuery.limit)
  var page = isNaN(parsePage) || parsePage <= 0 ? 1 : parsePage
  var limit = isNaN(parseLimit) ? config.pageLimit : parseLimit
  var skip = (page - 1) * limit
  MerchantUser.count()
    .then(count => {
      if (!count) {
        res.json({
          success: true,
          msg: '获取商家列表成功',
          count: 0,
          data: []
        })
      } else {
        MerchantUser.find({}, { password: 0 }).limit(limit).skip(skip).sort({ _id: -1 })
          .then(data => {
            res.json({
              success: true,
              msg: '获取商家列表成功',
              count: count,
              data: data
            })
          })
          .catch(err => {
            res.json({
              success: false,
              msg: '获取商家列表失败',
              err: err
            })
          })
      }
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '获取商家列表总条数失败',
        err: err
      })
    })
})

router.post('/shop_add', function (req, res, next) {
  var reqBody = req.body;
  var location, longitude, longitude
  if (reqBody.location && typeof(reqBody.location) === 'string') {
    location = reqBody.location.split(',')
    longitude = parseFloat(location[0])
    latitude = parseFloat(location[1])
  }
  if (!reqBody.merchant_id || Object.keys(reqBody).length < 9 || isNaN(latitude) || isNaN(longitude)) {
    res.json({
      success: false,
      msg: '缺少参数或参数错误'
    })
    return
  }
  reqBody.location = [longitude, latitude]
  reqBody.created_ts = Date.now()
  var merchantShop = new MerchantShop(reqBody)
  merchantShop.save()
    .then(data => {
      res.json({
        success: true,
        msg: '添加店铺成功'
      })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '添加店铺失败',
        err: err
      })
    })
})

router.get('/merchant_shops', function (req, res, next) { // 查询店铺列表，传商家id即该商家下的店铺列表
  var reqQuery = req.query
  var parsePage = parseInt(reqQuery.page)
  var parseLimit = parseInt(reqQuery.limit)
  var page = isNaN(parsePage) || parsePage <= 0 ? 1 : parsePage
  var limit = isNaN(parseLimit) ? config.pageLimit : parseLimit
  var skip = (page - 1) * limit
  var conditions = reqQuery.merchant_id ? { merchant_id: reqQuery.merchant_id } : {}
  MerchantShop.find(conditions).count()
    .then(count => {
      if (!count) {
        res.json({
          success: true,
          msg: '获取店铺列表成功',
          count: 0,
          data: []
        })
      } else {
        var populateOptions = reqQuery.merchant_id ? '' : {
          path: 'merchant_id',
          select: {
            password: 0
          }
        };
        MerchantShop.find(conditions).limit(limit).skip(skip).populate(populateOptions).sort({ _id: -1 })
          .then(data => {
            res.json({
              success: true,
              msg: '获取店铺列表成功',
              count: count,
              data: data
            })
          })
          .catch(err => {
            res.json({
              success: false,
              msg: '获取店铺列表出错',
              err: err
            })
          })
      }
    })
})

router.get('/near_shops', function (req, res, next) { // 查询附近的店铺，当前位置必传
  var reqQuery = req.query;
  var parsePage = parseInt(reqQuery.page)
  var parseLimit = parseInt(reqQuery.limit)
  var page = isNaN(parsePage) || parsePage <= 0 ? 1 : parsePage
  var limit = isNaN(parseLimit) ? config.pageLimit : parseLimit
  var skip = (page - 1) * limit
  if (!reqQuery.location || typeof(reqQuery.location) !== 'string') {
    res.json({
      success: false,
      msg: '缺少参数或参数错误'
    })
    return
  }
  var maxDistance = reqQuery.max_distance
  var locationArr, longitude, longitude
  locationArr = reqQuery.location.split(',')
  longitude = parseFloat(locationArr[0])
  latitude = parseFloat(locationArr[1])
  var locationRes = [ longitude, latitude ]
  // var locationOptions = maxDistance ? {
  //   $nearSphere: locationRes,
  //   $maxDistance: parseFloat(maxDistance) / 6371 // 此处要转换为弧度，6371为地球半径，单位km
  // } : { $nearSphere: locationRes }

  MerchantShop.aggregate([{ // 返回带距离的数据，单位是米
    '$geoNear': {
      'near': {
          'type': 'Point',
          'coordinates': locationRes
        },
      'spherical': true,
      'distanceField': 'distance_m', // 最后生成的距离字段
      'limit': limit
    }
  }, { '$skip': skip }])
    .then(data => {
      res.json({
        success: true,
        msg: '获取附近店铺成功',
        data: data
      })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '获取附近店铺失败',
        err: err.toString()
      })
    })

  // MerchantShop.geoNear(locationRes, { spherical: true, limit: limit}) // 返回带距离的数据，单位是弧度，要乘以地球半径8371，但是没有skip参数
  //   .then(data => {
  //     res.json({
  //       success: true,
  //       msg: '获取附近店铺成功',
  //       data: data
  //     })
  //   })
  //   .catch(err => {
  //     res.json({
  //       success: false,
  //       mag: '获取附近店铺失败',
  //       err: err.toString()
  //     })
  //   })

  // MerchantShop.find({ 'location': locationOptions }).limit(limit).skip(skip) // 返回不带距离的数据
  //   .then(data => {
  //     res.json({
  //       success: true,
  //       msg: '获取附近店铺成功',
  //       data: data
  //     })
  //   })
  //   .catch(err => {
  //     res.json({
  //       success: false,
  //       mag: '获取附近店铺失败',
  //       err: err.toString()
  //     })
  //   })
})

router.post('/get_qiniu_upload_token', function (req, res, next) {
  var accessKey = 'QimXTd2UT59EgNfZuEJ2_27gEwHRCSmw5sW_sO9u';
  var secretKey = 'wOQyg5FpX8OFsyRsnQRtHteoqMPSEwWbatY99IaO';
  var mac = new qiniu.auth.digest.Mac(accessKey, secretKey);

  var putPolicy = new qiniu.rs.PutPolicy({ scope: 'wusuowei' });
  var uploadToken = putPolicy.uploadToken(mac);

  res.json({
    success: true,
    data: uploadToken
  })
})

module.exports = router
