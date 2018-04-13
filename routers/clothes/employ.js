var express = require('express');
var router = express.Router();
var session = require('express-session');
var axios = require('axios');
var crypto = require('crypto');
var CaptchaSDK = require('dx-captcha-sdk')
var QcloudSms = require("qcloudsms_js") // ��Ѷ�ƶ��ŷ���

var RedisStore = require('connect-redis')(session);

var EmployUser = require('../../models/clothes/EmployUser.js');
var MerchantUser = require('../../models/clothes/MerchantUser.js');
var MerchantShop = require('../../models/clothes/MerchantShop.js');
var GoodsCategory = require('../../models/clothes/GoodsCategory.js');
var ShopGoods = require('../../models/clothes/ShopGoods.js');
var Topic = require('../../models/clothes/Topic.js');
var User = require('../../models/clothes/User.js');

var utils = require('../../utils.js');
var config = require('./config.js');

var ssender = undefined;
var accessKey = undefined, secretKey = undefined, mac = undefined, resourceConfig = undefined, bucketManager = undefined

router.use(session({
  secret: 'clothes_session',
  name: 'leave-me-alone', // ������ҳ��cookie����
  store: new RedisStore({
    client: global.redisClient,
    // host: 'localhost',
    // port: 6379
  }),
  cookie: {
    maxAge: 60 * 60 * 1000 // һСʱ
  },
  resave: true, // :(�Ƿ�����)���ͻ��˲��з��Ͷ������ʱ������һ����������һ���������ʱ��session�����޸ĸ��ǲ����档�������false������ʹ��.touch�����������ڻ�е�sessionʧЧ��
  saveUninitialized: false // ��ʼ��sessionʱ�Ƿ񱣴浽�洢
}))

router.post('/login', function (req, res, next) {
  var reqBody = req.body;
  if (JSON.stringify(reqBody) === '{}' && req.session.userInfo) {
    var userInfo = {}
    try {
      userInfo = JSON.parse(req.session.userInfo)
      res.json({
        success: true,
        msg: '��¼״̬��Ч',
        user_info: userInfo
      })
    } catch (e) {
      res.json({
        success: false,
        msg: '��������'
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
      msg: 'ȱ�ٲ�����session�ѹ���'
    })
    return
  }

  var captcha = new CaptchaSDK('b971bdbee8e1d2780783782d066d0cf8', 'de85519b7bded1dab9a2ad1f4db195a5')
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
              msg: '��¼�ɹ�',
              user_info: data
            })
          } else { // �û�������
            res.json({
              success: false,
              msg: '�û������������'
            })
          }
        })
        .catch(err => {
          res.json({
            success: false,
            msg: '��¼ʧ��',
            err: err
          })
        })
    }).catch(err => {
      res.json({
        success: false,
        code: 10001,
        msg: '��֤������ʧЧ����������֤',
        err_msg: err
      })
    })
})

router.post('/logout', function (req, res, next) {
  req.session.userInfo = '';
  res.json({
    success: true,
    msg: '�˳��ɹ�'
  })
})

router.post('/merchant_user_add', function (req, res, next) {
  var reqBody = req.body;
  var username = reqBody.username && reqBody.username.trim();
  var password = reqBody.password;
  var name = reqBody.name;
  if (!username || !password || !name) {
    res.json({
      success: false,
      msg: 'ȱ�ٲ���'
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
          msg: '�û��Ѵ���'
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
              msg: '����û��ɹ�'
            })
          })
          .catch(err => {
            res.json({
              success: false,
              msg: '����û�ʧ��',
              err: err
            })
          })
      }
    })
})

router.post('/user_delete', function (req, res, next) {
  var reqBody = req.body;
  var _id = reqBody._id && reqBody._id.trim();
  if (!_id) {
    res.json({
      success: false,
      msg: 'ȱ�ٲ���'
    })
  } else {
    EmployUser.remove({
      _id: _id
    })
      .then(data => {
        res.json({
          success: true,
          msg: 'ɾ���û��ɹ�'
        })
      })
      .catch(err => {
        res.json({
          success: false,
          msg: 'ɾ���û�ʧ��',
          err: err
        })
      })
  }
})

router.get('/user_list', function (req, res, next) {
  EmployUser.find({}, { password: 0 })
    .then(data => {
      res.json({
        success: true,
        msg: '��ѯ�û��б�ɹ�',
        data: data
      })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '��ѯ�û��б�ʧ��',
        err: err
      })
    })
})

router.post('/add_merchant_sms', function (req, res, next) { // ����̼�ʱ���Ͷ�����֤��
  var reqBody = req.body
  var phone = reqBody.phone
  if (!(/^1[34578]\d{9}$/.test(phone))) {
    res.json({
      success: false,
      msg: '�ֻ��Ŵ���'
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
  //   msg: '���ŷ��ͳɹ�'
  // })
  // return;

  var smsConfig = config.smsConfig;
  var qcloudsms = QcloudSms(smsConfig.appid, smsConfig.appkey)
  var code = Math.random().toString().substr(2, 6)
  ssender = ssender || qcloudsms.SmsSingleSender() // ��������
  // ssender = ssender || qcloudsms.SmsMultiSender() // Ⱥ������
  ssender.send(smsConfig.smsType, 86, phone, code + " Ϊ���ĵ�¼��֤�룬���� 2 ��������д����Ǳ��˲���������Ա����š�", "", "", function (err, response, resData) {
    if (err) {
      res.json({
        success: false,
        msg: '���ŷ���ʧ��',
        err: err
      })
    } else {
      if (resData.result) {
        res.json({
          success: false,
          msg: '���ŷ���ʧ��',
          err: resData
        })
      } else {
        global.redisClient.set(phone, code, function (err, res) {
          global.redisClient.expire(phone, 120)
        })
        res.json({
          success: true,
          msg: '���ŷ��ͳɹ�',
          data: resData
        })
      }
    }
  });
})

router.post('/merchant_add', function (req, res, next) { // ����̼��˺�
  var reqBody = req.body;
  var phone = reqBody.phone && reqBody.phone.trim();
  var manager = reqBody.manager;
  var email = reqBody.email;
  var name = reqBody.name;
  var address = reqBody.address;
  var desc = reqBody.desc;
  var code = reqBody.code;

  if (!(/^1[34578]\d{9}$/.test(phone)) || !manager || !email || !name || !address || !code) {
    return res.json({
      success: false,
      msg: 'ȱ�ٲ������������'
    })
  }

  global.redisClient.get(phone, function (err, v) {
    if (err) {
      res.json({
        success: false,
        msg: 'redis�����쳣'
      })
      return
    }
    if (v !== code) {
      res.json({
        success: false,
        msg: '������֤������ʧЧ'
      })
    } else {
      redisClient.del(phone); // ɾ��
      MerchantUser.findOne({
        phone: phone
      })
        .then(data => {
          if (data) {
            res.json({
              success: false,
              msg: '�ֻ�����ע��'
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
                  msg: '��ӳɹ�',
                  data: {
                    phone: phone,
                    password: password
                  }
                })
              })
              .catch(err => {
                res.json({
                  success: false,
                  msg: '���ʧ��',
                  err: err
                })
              })
          }
        })
      .catch(err => {
        res.json({
          success: false,
          msg: '���ݿ��ѯ����',
          err: err
        })
      })
    }
  })
})

router.get('/merchant_detail', function (req, res, next) {
  var _id = req.query._id;
  if (!_id) {
    return res.json({
      success: false,
      msg: 'ȱ�ٲ������������'
    })
  }
  MerchantUser.findOne({ _id: _id })
    .then(data => {
      if (!data) {
        return res.json({
          success: false,
          msg: '�̼Ҳ�����'
        })
      }
      res.json({
        success: true,
        msg: '��ȡ�̼�����ɹ�',
        data: data
      })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '��ȡ�̼�����ʧ��',
        err: err.toString()
      })
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
          msg: '��ȡ�̼��б�ɹ�',
          count: 0,
          data: []
        })
      } else {
        MerchantUser.find({}, { password: 0 }).limit(limit).skip(skip).sort({ _id: -1 })
          .then(data => {
            res.json({
              success: true,
              msg: '��ȡ�̼��б�ɹ�',
              count: count,
              data: data
            })
          })
          .catch(err => {
            res.json({
              success: false,
              msg: '��ȡ�̼��б�ʧ��',
              err: err
            })
          })
      }
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '��ȡ�̼��б�������ʧ��',
        err: err
      })
    })
})

router.post('/merchant_edit', function (req, res, next) {
  var reqBody = req.body;
  var _id = reqBody._id;
  var phone = reqBody.phone && reqBody.phone.trim();
  var manager = reqBody.manager;
  var email = reqBody.email;
  var name = reqBody.name;
  var address = reqBody.address;
  var desc = reqBody.desc;
  var code = reqBody.code;

  if (!_id || !(/^1[34578]\d{9}$/.test(phone)) || !manager || !email || !name || !address || !code) {
    return res.json({
      success: false,
      msg: 'ȱ�ٲ������������'
    })
  }

  global.redisClient.get(phone, function (err, v) {
    if (err) {
      res.json({
        success: false,
        msg: 'redis�����쳣'
      })
      return
    }
    if (v !== code) {
      res.json({
        success: false,
        msg: '������֤������ʧЧ'
      })
    } else {
      redisClient.del(phone); // ɾ��
      // MerchantUser.update({ _id: _id }, {
      MerchantUser.findOneAndUpdate({ _id: _id }, {
        manager, email, name, address, desc
      })
        .then(() => {
          res.json({
            success: true,
            msg: '�޸��̼���Ϣ�ɹ�'
          })
        })
        .catch(err => {
          res.json({
            success: false,
            msg: '�޸��̼���Ϣʧ��'
          })
        })
    }
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
      msg: 'ȱ�ٲ������������'
    })
    return
  }
  reqBody.location = [longitude, latitude]

  var isWebUrl = /(http:\/\/)|(https:\/\/)/.test(reqBody.logo);
  var originKey = reqBody.logo;
  var filename = undefined;
  var destKey = undefined;
  if (!isWebUrl) {
    filename = reqBody.logo.split('/')[reqBody.logo.split('/').length - 1];
    destKey = config.qiniuConfig.shopLogoDirname + filename;
    reqBody.logo = destKey
  }

  var merchantShop = new MerchantShop(reqBody)
  merchantShop.save()
    .then(() => {
      res.json({
        success: true,
        msg: '��ӵ��̳ɹ�'
      })
      if (!isWebUrl) { // ������ϴ�����ţ�ģ��ƶ�ͼƬ
        utils.resourceMove({
          srcKey: originKey,
          destKey: destKey,
          error: function (err) {
            utils.writeQiniuErrorLog('�����ƶ���Ʒlogo����err: ' + err)
          }
        })
      }
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '��ӵ���ʧ��',
        err: err
      })
    })
})

router.get('/merchant_shops', function (req, res, next) { // ��ѯ�����б����̼�id�����̼��µĵ����б�
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
          msg: '��ȡ�����б�ɹ�',
          count: 0,
          data: []
        })
      } else {
        var populateOptions = reqQuery.merchant_id ? '' : {
          path: 'merchant_id',
          select: {
            password: 0
          },
          options: {
            limit: 1
          }
        };
        // MerchantShop.find(conditions).populate(populateOptions).limit(limit).skip(skip).sort({ _id: -1 })
        //   .exec(function (err, shops) {
        //     if (err) return console.log(err)
        //     shops = shops.filter(function (shop) {
        //       return shop.merchant_id
        //     })
        //     res.json({
        //       data: shops,
        //       msg: '123123sdf'
        //     })
        //   })
        MerchantShop.find(conditions).limit(limit).skip(skip).populate(populateOptions).sort({ _id: -1 })
          .then(data => {
            res.json({
              success: true,
              msg: '��ȡ�����б�ɹ�',
              count: count,
              data: data
            })
          })
          .catch(err => {
            res.json({
              success: false,
              msg: '��ȡ�����б����',
              err: err
            })
          })
      }
    })
})

router.get('/shop_detail', function (req, res, next) {
  var _id = req.query.shop_id;
  if (!_id) {
    return res.json({
      success: false,
      msg: 'ȱ�ٲ���'
    })
  }
  MerchantShop.findOne({ _id: _id })
    .then(data => {
      if (!data) {
        return res.json({
          success: false,
          msg: '���̲�����'
        })
      }
      res.json({
        success: true,
        msg: '��ѯ��������ɹ�',
        data: data
      })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '��ѯ�����������',
        err: err.toString()
      })
    })
})

router.post('/shop_edit', function (req, res, next) {
  var reqBody = req.body;
  var _id = reqBody._id;
  if (!_id || Object.keys(reqBody).length < 8) {
    return res.json({
      success: false,
      msg: 'ȱ�ٲ������������'
    })
  }
  delete reqBody._id
  if (reqBody.logo && reqBody.logo !== reqBody.origin_logo) {
    var isWebUrl = /(http:\/\/)|(https:\/\/)/.test(reqBody.logo);
    var originKey = reqBody.logo;
    var filename = undefined;
    var destKey = undefined;
    if (!isWebUrl) {
      utils.resourceDelete({ // ɾ��logo
        key: reqBody.origin_logo,
        success: function (res) {
          filename = reqBody.logo.split('/')[reqBody.logo.split('/').length - 1];
          destKey = config.qiniuConfig.shopLogoDirname + filename;
          reqBody.logo = destKey

          utils.resourceMove({ // �ƶ�logo
            srcKey: originKey,
            destKey: destKey,
            success: function (res) {
            },
            error: function (err) {
              utils.writeQiniuErrorLog('�޸ĵ���logoͼ�������ƶ�����ʧ�ܣ�err: ' + err)
            }
          })
        },
        error: function (err) {
          utils.writeQiniuErrorLog('�޸ĵ���logoͼ������ɾ������ʧ�ܣ�err: ' + err)
        }
      })
    }
  }
  delete reqBody.origin_logo
  var location, longitude, longitude
  if (reqBody.location && typeof(reqBody.location) === 'string') {
    location = reqBody.location.split(',')
    longitude = parseFloat(location[0])
    latitude = parseFloat(location[1])
  }
  reqBody.location = [longitude, latitude]
  MerchantShop.findOneAndUpdate({ _id: _id }, reqBody)
    .then(() => {
      res.json({
        success: true,
        msg: '�����޸ĳɹ�'
      })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '�����޸�ʧ��',
        err: err.toString()
      })
    })
})

router.get('/near_shops', function (req, res, next) { // ��ѯ�����ĵ��̣���ǰλ�ñش�
  var reqQuery = req.query;
  var parsePage = parseInt(reqQuery.page)
  var parseLimit = parseInt(reqQuery.limit)
  var page = isNaN(parsePage) || parsePage <= 0 ? 1 : parsePage
  var limit = isNaN(parseLimit) ? config.pageLimit : parseLimit
  var skip = (page - 1) * limit
  if (!reqQuery.location || typeof(reqQuery.location) !== 'string') {
    res.json({
      success: false,
      msg: 'ȱ�ٲ������������'
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
  //   $maxDistance: parseFloat(maxDistance) / 6371 // �˴�Ҫת��Ϊ���ȣ�6371Ϊ����뾶����λkm
  // } : { $nearSphere: locationRes }

  MerchantShop.aggregate([{ // ���ش���������ݣ���λ����
    '$geoNear': {
      'near': {
          'type': 'Point',
          'coordinates': locationRes
        },
      'spherical': true,
      'distanceField': 'distance_m', // ������ɵľ����ֶ�
      'limit': limit
    }
  }, { '$skip': skip }])
    .then(data => {
      res.json({
        success: true,
        msg: '��ȡ�������̳ɹ�',
        data: data
      })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '��ȡ��������ʧ��',
        err: err.toString()
      })
    })

  // MerchantShop.geoNear(locationRes, { spherical: true, limit: limit}) // ���ش���������ݣ���λ�ǻ��ȣ�Ҫ���Ե���뾶8371������û��skip����
  //   .then(data => {
  //     res.json({
  //       success: true,
  //       msg: '��ȡ�������̳ɹ�',
  //       data: data
  //     })
  //   })
  //   .catch(err => {
  //     res.json({
  //       success: false,
  //       mag: '��ȡ��������ʧ��',
  //       err: err.toString()
  //     })
  //   })

  // MerchantShop.find({ 'location': locationOptions }).limit(limit).skip(skip) // ���ز������������
  //   .then(data => {
  //     res.json({
  //       success: true,
  //       msg: '��ȡ�������̳ɹ�',
  //       data: data
  //     })
  //   })
  //   .catch(err => {
  //     res.json({
  //       success: false,
  //       mag: '��ȡ��������ʧ��',
  //       err: err.toString()
  //     })
  //   })
})

router.post('/category_add', function (req, res, next) {
  var reqBody = req.body;
  var name = reqBody.name;
  var desc = reqBody.desc;
  var icon = reqBody.icon ? reqBody.icon : '';
  var level = reqBody.parent.length + 1;
  var parentId = reqBody.parent[reqBody.parent.length - 1];

  GoodsCategory.findOne({
    level: level,
    name: name
  }).then(data => {
    if (data) {
      res.json({
        success: false,
        msg: '�ü��������Ѵ�����ͬ����'
      })
    } else {
      var isWebUrl = /(http:\/\/)|(https:\/\/)/.test(reqBody.icon);
      var originKey = reqBody.icon;
      var filename = undefined;
      var destKey = undefined;
      if (icon && !isWebUrl) {
        filename = reqBody.icon.split('/')[reqBody.icon.split('/').length - 1];
        destKey = config.qiniuConfig.categoryIconDirname + filename;
        icon = destKey;
      }

      var goodsCategory = undefined;
      if (parentId) {
        goodsCategory = new GoodsCategory({
          name: name,
          desc: desc,
          level: level,
          icon: icon,
          parent_id: parentId
        })
      } else {
        goodsCategory = new GoodsCategory({
          name: name,
          desc: desc,
          level: level,
          icon: icon
        })
      }

      goodsCategory.save()
        .then(data => {
          console.log(data)
          res.json({
            success: true,
            msg: '��ӷ���ɹ�'
          })

          if (icon && !isWebUrl) { // ������ϴ�����ţ�ģ��ƶ�ͼƬ
            utils.resourceMove({
              srcKey: originKey,
              destKey: destKey,
              error: function (err) {
                utils.writeQiniuErrorLog('�����ƶ�����icon����err: ' + err)
              }
            })
          }

        })
        .catch(err => {
          res.json({
            success: false,
            msg: '��ӷ���ʧ��',
            err: err
          })
        })
    }
  }).catch(err => {
    res.json({
      success: false,
      msg: '��ӷ���ʧ��',
      err: err
    })
  })
})

router.get('/goods_categories', function (req, res, next) {
  var reqQuery = req.query;
  var level = reqQuery.level;
  var sort = null;
  try {
    sort = JSON.parse(reqQuery.sort);
  } catch (e) {
    sort = { createdAt: 1 };
  }
  var conditions = level ? { level: level } : {};
  GoodsCategory.find(conditions).sort(sort)
    .then(data => {
      res.json({
        success: true,
        data: data
      })
    })
    .catch(err => {
      res.json({
        success: false,
        err: err
      })
    })
})

router.get('/category_detail', function (req, res, next) {
  var _id = req.query._id;
  if (!_id) {
    return res.json({
      success: false,
      msg: 'ȱ�ٲ���'
    })
  }
  GoodsCategory.findOne({ _id })
    .then(data => {
      if (!data) {
        return res.json({
          success: false,
          msg: '���಻����'
        })
      }
      res.json({
        success: true,
        msg: '��ȡ��������ɹ�',
        data: data
      })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '��ȡ�����������',
        err: err.toString()
      })
    })
})

router.post('/category_edit', function (req, res, next) {
  var reqBody = req.body;
  var _id = reqBody._id;
  if (!_id || Object.keys(reqBody).length < 3) {
    return res.json({
      success: false,
      msg: 'ȱ�ٲ������������'
    })
  }
  delete reqBody._id
  if (reqBody.icon && reqBody.icon !== reqBody.origin_icon) {
    var isWebUrl = /(http:\/\/)|(https:\/\/)/.test(reqBody.icon);
    var originKey = reqBody.icon;
    var filename = undefined;
    var destKey = undefined;
    if (!isWebUrl) {
      utils.resourceDelete({ // ɾ��icon
        key: reqBody.origin_icon,
        success: function (res) {
          filename = reqBody.icon.split('/')[reqBody.icon.split('/').length - 1];
          destKey = config.qiniuConfig.categoryIconDirname + filename;
          reqBody.icon = destKey

          utils.resourceMove({ // �ƶ�logo
            srcKey: originKey,
            destKey: destKey,
            error: function (err) {
              utils.writeQiniuErrorLog('�޸ĵ���logoͼ�������ƶ�����ʧ�ܣ�err: ' + err)
            }
          })
        },
        error: function (err) {
          utils.writeQiniuErrorLog('�޸ĵ���logoͼ������ɾ������ʧ�ܣ�err: ' + err)
        }
      })
    }
  }
  delete reqBody.origin_icon
  GoodsCategory.findOneAndUpdate({ _id: _id }, reqBody)
    .then(() => {
      res.json({
        success: true,
        msg: '�����޸ĳɹ�'
      })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '�����޸�ʧ��',
        err: err.toString()
      })
    })
})

router.post('/goods_add', function (req, res, next) {
  var reqBody = req.body;
  var shopId = reqBody.shop_id;
  var categoryId = reqBody.category_id;
  var title = reqBody.title;
  var valuation = reqBody.valuation;
  var figureImgs = reqBody.figure_imgs;
  var detailImgs = reqBody.detail_imgs;
  if (!shopId || !title || !valuation || !categoryId || !(figureImgs instanceof Array) || !figureImgs.length || !(detailImgs instanceof Array) || !detailImgs.length) {
    return res.json({
      success: false,
      msg: 'ȱ�ٲ������������'
    })
  }

  MerchantShop.findOne({ _id: shopId })
    .then(data => {
      if (!data) {
        return res.json({
          success: false,
          msg: '���̲�����'
        })
      }

      // ��Ʒ�ֲ�ͼ����
      var goodsFigureDirname = config.qiniuConfig.goodsFigureDirname;
      var movedFigureImgs = [];
      figureImgs.forEach(function (item, index, arr) {
        var filename = item.split('/')[item.split('/').length - 1]
        movedFigureImgs.push(goodsFigureDirname + filename);
      })

      // ��Ʒ����ͼ����
      var goodsDetailDirname = config.qiniuConfig.goodsDetailDirname;
      var movedDetailImgs = [];
      detailImgs.forEach(function (item, index, arr) {
        var filename = item.split('/')[item.split('/').length - 1]
        movedDetailImgs.push(goodsDetailDirname + filename);
      })

      var shopGoods = new ShopGoods({
        merchant_id: data.merchant_id,
        shop_id: shopId,
        category_id: categoryId,
        title: title,
        valuation: valuation,
        figure_imgs: movedFigureImgs,
        detail_imgs: movedDetailImgs,
        created_ts: Date.now()
      })
      shopGoods.save()
        .then(data => {
          res.json({
            success: true,
            _id: data._id,
            msg: '��Ʒ��ӳɹ�'
          })

          utils.resourceMoveBatch({
            srcKeys: figureImgs,
            destDirname: goodsFigureDirname,
            error: function (err) {
              utils.writeQiniuErrorLog('�����ƶ���Ʒ�ֲ�ͼƬʧ�ܣ�err: ' + err)
            }
          })
          utils.resourceMoveBatch({
            srcKeys: detailImgs,
            destDirname: goodsDetailDirname,
            error: function (err) {
              utils.writeQiniuErrorLog('�����ƶ���Ʒ����ͼƬʧ�ܣ�err: ' + err)
            }
          })
        })
        .catch(err => {
          res.json({
            success: false,
            msg: '��Ʒ���ʧ��',
            err: err.toString()
          })
        })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '��ѯ����ʧ��',
        err: err.toString()
      })
    })
})

router.get('/goods_list', function (req, res, next) {
  var queryOptions = req.query.shop_id ? { shop_id: req.query.shop_id } : {}
  ShopGoods.find(queryOptions).populate([{
    path: 'merchant_id'
  }, {
    path: 'shop_id'
  }, {
    path: 'category_id'
  }])
    .then(data => {
      res.json({
        success: true,
        msg: '��ȡ��Ʒ�б�ɹ�',
        data: data
      })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '��ȡ��Ʒ�б�ʧ��',
        err: err.toString()
      })
    })
})

router.get('/goods_detail', function (req, res, next) {
  var _id = req.query._id
  if (!_id) {
    return res.json({
      success: false,
      msg: 'ȱ�ٲ������������'
    })
  }
  ShopGoods.findOne({ _id: _id }).populate({ path: 'category_id' })
    .then(data => {
      if (!data) {
        return res.json({
          success: false,
          msg: '��ȡ��Ʒ����ʧ�ܣ���Ʒ������'
        })
      }
      res.json({
        success: true,
        msg: '��ȡ��Ʒ����ɹ�',
        data: data
      })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '��ȡ��Ʒ����ʧ��',
        err: err.toString()
      })
    })
})

router.post('/goods_edit', function (req, res, next) {
  var reqBody = req.body;
  var _id = reqBody.goods_id;
  var title = reqBody.title;
  var valuation = reqBody.valuation;
  var figureImgs = reqBody.figure_imgs;
  var detailImgs = reqBody.detail_imgs;
  var originFigureImgs = reqBody.origin_figure_imgs;
  var originDetailImgs = reqBody.origin_detail_imgs;

  if (!_id || !title || !valuation || !figureImgs || !detailImgs || !originFigureImgs || !originDetailImgs) {
    return res.json({
      success: false,
      msg: 'ȱ�ٲ������������'
    })
  }

  var figureImgsInter = utils.getIntersection(figureImgs, originFigureImgs)
  var detailImgsInter = utils.getIntersection(detailImgs, originDetailImgs)

  var figureImgsDelete = utils.getDifference(originFigureImgs, figureImgsInter)
  var figureImgsMove = utils.getDifference(figureImgs, figureImgsInter)

  var detailImgsDelete = utils.getDifference(originDetailImgs, detailImgsInter)
  var detailImgsMove = utils.getDifference(detailImgs, detailImgsInter)

  var deleteImgs = figureImgsDelete.concat(detailImgsDelete)

  // ��Ʒ�ֲ�ͼ����
  var goodsFigureDirname = config.qiniuConfig.goodsFigureDirname;
  var movedFigureImgs = [];
  figureImgsMove.forEach(function (item, index, arr) {
    var filename = item.split('/')[item.split('/').length - 1]
    movedFigureImgs.push(goodsFigureDirname + filename);
  })

  // ��Ʒ����ͼ����
  var goodsDetailDirname = config.qiniuConfig.goodsDetailDirname;
  var movedDetailImgs = [];
  detailImgsMove.forEach(function (item, index, arr) {
    var filename = item.split('/')[item.split('/').length - 1]
    movedDetailImgs.push(goodsDetailDirname + filename);
  })

  ShopGoods.update({ _id: _id }, {
    title: title,
    valuation: valuation,
    figure_imgs: utils.changeQiniuFilename(figureImgs, goodsFigureDirname),
    detail_imgs: utils.changeQiniuFilename(detailImgs, goodsDetailDirname)
  })
    .then(() => {
      res.json({
        success: true,
        msg: '�޸���Ʒ�ɹ�'
      })
      if (deleteImgs.length) { // ɾ��ͼƬ
        utils.resourceDeleteBatch({
          keys: deleteImgs,
          error: function (err) {
            utils.writeQiniuErrorLog('�޸���Ʒʱ����ɾ��ͼƬʧ�ܣ�err: ' + err)
          }
        })
      }
      if (figureImgsMove.length) { // �ƶ�ͼƬ
        utils.resourceMoveBatch({
          srcKeys: figureImgsMove,
          destDirname: goodsFigureDirname,
          error: function (err) {
            utils.writeQiniuErrorLog('�޸���Ʒʱ�����ƶ�ͼƬʱʧ�ܣ�err: ' + err)
          }
        })
      }
      if (detailImgsMove.length) { // �ƶ�ͼƬ
        utils.resourceMoveBatch({
          srcKeys: detailImgsMove,
          destDirname: goodsDetailDirname,
          error: function (err) {
            utils.writeQiniuErrorLog('�޸���Ʒʱ�����ƶ�ͼƬʱʧ�ܣ�err: ' + err)
          }
        })
      }
    })
    .catch(err => {
      console.log(err)
      res.json({
        success: false,
        msg: '�޸���Ʒʧ��',
        err: err.toString()
      })
    })
})

router.post('/topic_add', function (req, res, next) {
  var reqBody = req.body;
  var title = reqBody.title;
  var content = reqBody.content;
  var authorId = reqBody.author_id;

  if (!title || !content || !authorId || !(content instanceof Array)) {
    return res.json({
      success: false,
      msg: 'ȱ�ٲ������������'
    })
  }

  var moveTopicImgs = [];
  var topicDirname = config.qiniuConfig.topicDirname;

  for (var i = 0; i < content.length; i++) { // type: 1Ϊ���֣�2ΪͼƬ
    if (content[i].type === 2) {
      var tempMoveImgs = [];
      moveTopicImgs = moveTopicImgs.concat(content[i].value);
      content[i].value.forEach(function (item, index, arr) {
        var filename = item.split('/')[item.split('/').length - 1]
        tempMoveImgs.push(topicDirname + filename);
        content[i].value = tempMoveImgs;
      })
    }
  }

  var topic = new Topic({
    title: title,
    content: content,
    author_id: authorId
  })

  topic.save()
    .then(data => {
      res.json({
        success: true,
        msg: '������ӳɹ�',
        data: {
          _id: data._id
        }
      })

      if (!moveTopicImgs.length) return;

      utils.resourceMoveBatch({
        srcKeys: moveTopicImgs,
        destDirname: topicDirname,
        error: function (err) {
          utils.writeQiniuErrorLog('�����ƶ�����ͼƬʧ�ܣ�err: ' + err)
        }
      })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '�������ʧ��',
        err: err.toString()
      })
    })
})

router.get('/topic_list', function (req, res, next) {
  Topic.find().sort({ updatedAt: -1 }).populate({ path: 'author_id', select: { name: 1, _id: 0 } })
    .then(data => {
      res.json({
        success: true,
        msg: '��ȡ�����б�ɹ�',
        data: data
      })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '��ȡ�����б�ʧ��',
        err: err.toString()
      })
    })
})

router.get('/topic_detail', function (req, res, next) {
  var _id = req.query._id

  if (!_id) {
    return res.json({
      success: false,
      msg: 'ȱ�ٲ������������'
    })
  }

  Topic.findOne({ _id: _id })
    .then(data => {
      res.json({
        success: true,
        msg: '��ȡ��������ɹ�',
        data: data
      })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '��ȡ��������ʧ��',
        err: err.toString()
      })
    })
})

router.post('/user_add', function (req, res, next) {
  var reqBody = req.body;
  var username = reqBody.username;
  var password = reqBody.password;

  if (!username || !password) {
    return res.json({
      success: false,
      msg: 'ȱ�ٲ������������'
    })
  }

  User.findOne({ username: username })
    .then(data => {
      if (data) {
        return res.json({
          success: false,
          msg: '�û����Ѵ���'
        })
      }

      var user = new User(reqBody)

      user.save()
        .then(() => {
          res.json({
            success: true,
            msg: '�û���ӳɹ�'
          })
        })
        .catch(err => {
          res.json({
            success: false,
            msg: '�û����ʧ��',
            err: err.toString()
          })
        })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '�û����ʧ��',
        err: err.toString()
      })
    })
})

router.get('/user_list', function (req, res, next) {
  var reqQuery = req.query;

  User.find().sort({ updatedAt: -1 })
    .then(data => {
      res.json({
        success: true,
        msg: '��ȡ�û��б�ɹ�',
        data: data
      })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '��ȡ�û��б�ʧ��',
        err: err.toString()
      })
    })
})

module.exports = router
