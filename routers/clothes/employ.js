var express = require('express');
var router = express.Router();
var session = require('express-session');
var crypto = require('crypto');
var CaptchaSDK = require('dx-captcha-sdk') // 顶象滑动验证码
// var QcloudSms = require("qcloudsms_js") // 腾讯云短信服务

var RedisStore = require('connect-redis')(session);

var EmployUser = require('../../models/clothes/EmployUser.js');
var MerchantUser = require('../../models/clothes/MerchantUser.js');
var MerchantShop = require('../../models/clothes/MerchantShop.js');
var GoodsCategory = require('../../models/clothes/GoodsCategory.js');
var ShopGoods = require('../../models/clothes/ShopGoods.js');
var Topic = require('../../models/clothes/Topic.js');
var User = require('../../models/clothes/User.js');

var utils = require('../../utils.js');
var config = require('../../config/clothes.config.js');

// var ssender = undefined;
// var accessKey = undefined, secretKey = undefined, mac = undefined, resourceConfig = undefined, bucketManager = undefined

router.use(session({
  secret: 'clothes_session',
  name: 'leave-me-alone', // 留在首页的cookie名称
  store: new RedisStore({
    client: global.redisClient,
    // host: 'localhost',
    // port: 6379
  }),
  cookie: {
    maxAge: 60 * 60 * 1000 // 一小时
  },
  resave: true, // :(是否允许)当客户端并行发送多个请求时，其中一个请求在另一个请求结束时对session进行修改覆盖并保存。如果设置false，可以使用.touch方法，避免在活动中的session失效。
  saveUninitialized: false // 初始化session时是否保存到存储
}))

router.use(require('./common.js'));

router.post('/login', function (req, res, next) {
  var reqBody = req.body;
  if (JSON.stringify(reqBody) === '{}' && req.session.userInfo) {
    var userInfo = {}
    try {
      userInfo = JSON.parse(req.session.userInfo)
      utils.success(res, '登录状态有效', userInfo)
    } catch (e) {
      utils.fail(res, '解析错误')
    }
    return
  }
  var username = reqBody.username && reqBody.username.trim();
  var password = reqBody.password;
  var dxToken = reqBody.dxToken;
  req.session.userInfo = '';
  if (!username || !password || !dxToken) {
    return utils.fail(res, '缺少参数或session已过期')
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
            utils.success(res, '登录成功', data)
          } else { // 用户不存在
            utils.fail(res, '用户名或密码错误')
          }
        })
        .catch(err => {
          utils.error(res, '登录失败', err)
        })
    }).catch(err => {
      utils.error(res, '验证码错误或失效，请重新验证', err)
    })
})

router.post('/logout', function (req, res, next) {
  req.session.userInfo = '';
  utils.success(res, '退出成功')
})

router.post('/merchant_user_add', function (req, res, next) {
  var reqBody = req.body;
  var username = reqBody.username && reqBody.username.trim();
  var password = reqBody.password;
  var name = reqBody.name;
  if (!username || !password || !name) {
    return utils.fail(res, 1)
  }
  EmployUser.findOne({
    username: username
  })
    .then(data => {
      if (data) {
        return utils.fail(res, '用户已存在')
      }

      var hash = crypto.createHash('md5');
      hash.update(config.passwordKey.left + password + config.passwordKey.right);
      var user = new EmployUser({
        username: username,
        name: name,
        password: hash.digest('hex')
      })
      user.save()
        .then(() => {
          utils.success(res, '添加用户成功')
        })
        .catch(err => {
          utils.error(res, '添加用户失败', err)
        })
    })
})

router.post('/user_delete', function (req, res, next) {
  var reqBody = req.body;
  var _id = reqBody._id && reqBody._id.trim();
  if (!_id) {
    return utils.fail(res, 1)
  }
  EmployUser.remove({
    _id: _id
  })
    .then(() => {
      utils.success(res, '删除用户成功')
    })
    .catch(err => {
      utils.error(res, '删除用户失败', err)
    })
})

router.get('/user_list', function (req, res, next) {
  EmployUser.find({}, { password: 0 })
    .then(data => {
      utils.success(res, '查询用户列表成功', data)
    })
    .catch(err => {
      utils.error(res, '查询用户列表失败', err)
    })
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
  var redisPrefix = config.redisPrefix.merchantAdd

  if (!(/^1[34578]\d{9}$/.test(phone)) || !manager || !email || !name || !address || !code) {
    return utils.fail(res, 1)
  }

  global.redisClient.get(redisPrefix + phone, function (err, v) {
    if (err) {
      return utils.fail(res, 'redis处理异常')
    }
    if (v !== code) {
      return utils.fail(res, '短信验证码错误或失效')
    }
    redisClient.del(redisPrefix + phone); // 删除
    MerchantUser.findOne({
      phone: phone
    })
      .then(data => {
        if (data) {
          return utils.fail(res, '手机号已注册')
        }

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
            utils.success(res, '添加成功', {
              phone: phone,
              password: password
            })
          })
          .catch(err => {
            utils.error(res, '添加失败', err)
          })
      })
    .catch(err => {
      utils.error(res, '数据库查询出错', err)
    })
  })
})

router.get('/merchant_detail', function (req, res, next) {
  var _id = req.query._id;
  if (!_id) {
    return utils.fail(res, 1)
  }
  MerchantUser.findOne({ _id: _id })
    .then(data => {
      if (!data) {
        return utils.fail(res, '商家不存在')
      }
      utils.success(res, '获取商家详情成功', data)
    })
    .catch(err => {
      utils.error(res, '获取商家详情失败', err)
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
        return res.json({
          success: true,
          msg: '获取商家列表成功',
          count: 0,
          data: []
        })
      }
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
          utils.error(res, '获取商家列表总条数成功, 但获取商家列表失败', err)
        })
    })
    .catch(err => {
      utils.error(res, '获取商家列表总条数失败', err)
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
    return utils.fail(res, 1)
  }

  global.redisClient.get(phone, function (err, v) {
    if (err) {
      return utils.fail(res, 'redis处理异常')
    }
    if (v !== code) {
      return utils.fail(res, '短信验证码错误或失效')
    }

    redisClient.del(phone); // 删除
    // MerchantUser.update({ _id: _id }, {
    MerchantUser.findOneAndUpdate({ _id: _id }, {
      manager, email, name, address, desc
    })
      .then(() => {
        utils.success(res, '修改商家信息成功')
      })
      .catch(err => {
        utils.error(res, '修改商家信息失败', err)
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
    return utils.fail(res, 1)
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
      utils.success(res, '添加店铺成功')

      if (!isWebUrl) { // 如果是上传到七牛的，移动图片
        utils.resourceMove({
          srcKey: originKey,
          destKey: destKey,
          error: function (err) {
            utils.writeQiniuErrorLog('单个移动商品logo出错，err: ' + err)
          }
        })
      }
    })
    .catch(err => {
      utils.error(res, '添加店铺失败', err)
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
          select: { password: 0 },
          options: { limit: 1 }
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
            utils.error(res, '获取店铺列表出错', err)
          })
      }
    })
})

router.post('/shop_edit', function (req, res, next) {
  var reqBody = req.body;
  var _id = reqBody._id;
  if (!_id || Object.keys(reqBody).length < 8) {
    return utils.fail(res, 1)
  }
  delete reqBody._id
  if (reqBody.logo && reqBody.logo !== reqBody.origin_logo) {
    var isWebUrl = /(http:\/\/)|(https:\/\/)/.test(reqBody.logo);
    var originKey = reqBody.logo;
    var filename = undefined;
    var destKey = undefined;
    if (!isWebUrl) {
      utils.resourceDelete({ // 删除logo
        key: reqBody.origin_logo,
        success: function (res) {
          filename = reqBody.logo.split('/')[reqBody.logo.split('/').length - 1];
          destKey = config.qiniuConfig.shopLogoDirname + filename;
          reqBody.logo = destKey

          utils.resourceMove({ // 移动logo
            srcKey: originKey,
            destKey: destKey,
            success: function (res) {
            },
            error: function (err) {
              utils.writeQiniuErrorLog('修改店铺logo图，单个移动过程失败，err: ' + err)
            }
          })
        },
        error: function (err) {
          utils.writeQiniuErrorLog('修改店铺logo图，单个删除过程失败，err: ' + err)
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
      utils.success(res, '店铺修改成功')
    })
    .catch(err => {
      utils.error(res, '店铺修改失败', err)
    })
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
      return utils.fail(res, '该级分类下已存在相同名称')
    }
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
      .then(() => {
        utils.success(res, '添加分类成功')

        if (icon && !isWebUrl) { // 如果是上传到七牛的，移动图片
          utils.resourceMove({
            srcKey: originKey,
            destKey: destKey,
            error: function (err) {
              utils.writeQiniuErrorLog('单个移动分类icon出错，err: ' + err)
            }
          })
        }

      })
      .catch(err => {
        utils.error(res, '添加分类失败', err)
      })
  }).catch(err => {
    utils.error(res, '添加分类失败', err)
  })
})

router.get('/category_detail', function (req, res, next) {
  var _id = req.query._id;
  if (!_id) {
    return utils.fail(res, 1)
  }
  GoodsCategory.findOne({ _id })
    .then(data => {
      if (!data) {
        return utils.fail(res, '分类不存在')
      }

      utils.success(res, '获取分类详情成功', data)
    })
    .catch(err => {
      utils.error(res, '获取分类详情出错', err)
    })
})

router.post('/category_edit', function (req, res, next) {
  var reqBody = req.body;
  var _id = reqBody._id;
  if (!_id || Object.keys(reqBody).length < 3) {
    return utils.fail(res, 1)
  }
  delete reqBody._id
  if (reqBody.icon && reqBody.icon !== reqBody.origin_icon) {
    var isWebUrl = /(http:\/\/)|(https:\/\/)/.test(reqBody.icon);
    var originKey = reqBody.icon;
    var filename = undefined;
    var destKey = undefined;

    filename = reqBody.icon.split('/')[reqBody.icon.split('/').length - 1];
    destKey = config.qiniuConfig.categoryIconDirname + filename;
    reqBody.icon = destKey

    if (!isWebUrl) {
      utils.resourceDelete({ // 删除icon
        key: reqBody.origin_icon,
        success: function (res) {
          utils.resourceMove({ // 移动logo
            srcKey: originKey,
            destKey: destKey,
            error: function (err) {
              utils.writeQiniuErrorLog('修改店铺logo图，单个移动过程失败，err: ' + err)
            }
          })
        },
        error: function (err) {
          utils.writeQiniuErrorLog('修改店铺logo图，单个删除过程失败，err: ' + err)
        }
      })
    }
  }
  delete reqBody.origin_icon
  GoodsCategory.findOneAndUpdate({ _id: _id }, reqBody)
    .then(() => {
      utils.success(res, '分类修改成功')
    })
    .catch(err => {
      utils.error(res, '分类修改失败', err)
    })
})

router.post('/goods_add', function (req, res, next) {
  var reqBody = req.body;
  var shopId = reqBody.shop_id;
  var categoryId = reqBody.category_id;
  var title = reqBody.title;
  var valuation = reqBody.valuation;
  var cover = reqBody.cover;
  var figureImgs = reqBody.figure_imgs;
  var detailImgs = reqBody.detail_imgs;

  if (!shopId || !title || !valuation || !cover || !categoryId || !(figureImgs instanceof Array) || !figureImgs.length || !(detailImgs instanceof Array) || !detailImgs.length) {
    return utils.fail(res, 1)
  }

  MerchantShop.findOne({ _id: shopId })
    .then(data => {
      if (!data) {
        return utils.fail(res, '店铺不存在')
      }

      var isWebUrl = /(http:\/\/)|(https:\/\/)/.test(reqBody.cover);
      var originKey = reqBody.cover;
      var filename = undefined;
      var destKey = undefined;
      if (!isWebUrl) {
        filename = reqBody.cover.split('/')[reqBody.cover.split('/').length - 1];
        destKey = config.qiniuConfig.goodsCoverDirname + filename;
        reqBody.cover = destKey
      }

      // 商品轮播图部分
      var goodsFigureDirname = config.qiniuConfig.goodsFigureDirname;
      var movedFigureImgs = [];
      figureImgs.forEach(function (item, index, arr) {
        var filename = item.split('/')[item.split('/').length - 1]
        movedFigureImgs.push(goodsFigureDirname + filename);
      })

      // 商品详情图部分
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
        cover: reqBody.cover,
        figure_imgs: movedFigureImgs,
        detail_imgs: movedDetailImgs,
        created_ts: Date.now()
      })
      shopGoods.save()
        .then(() => {
          utils.success(res, '商品添加成功')

          if (!isWebUrl) {
            utils.resourceMove({
              srcKey: originKey,
              destKey: destKey,
              error: function (err) {
                utils.writeQiniuErrorLog('单个移动商品logo出错，err: ' + err)
              }
            })
          }

          utils.resourceMoveBatch({
            srcKeys: figureImgs,
            destDirname: goodsFigureDirname,
            error: function (err) {
              utils.writeQiniuErrorLog('批量移动商品轮播图片失败，err: ' + err)
            }
          })
          utils.resourceMoveBatch({
            srcKeys: detailImgs,
            destDirname: goodsDetailDirname,
            error: function (err) {
              utils.writeQiniuErrorLog('批量移动商品详情图片失败，err: ' + err)
            }
          })
        })
        .catch(err => {
          utils.error(res, '商品添加失败', err)
        })
    })
    .catch(err => {
      utils.error(res, '查询店铺失败', err)
    })
})

router.get('/goods_detail', function (req, res, next) { // user.js也有，但那里信息更多
  var _id = req.query._id
  if (!_id) {
    return utils.fail(res, 1)
  }
  ShopGoods.findOne({ _id: _id }).populate([{ path: 'category_id' }, { path: 'shop_id' }])
    .then(data => {
      if (!data) {
        return utils.fail(res, '商品不存在')
      }
      utils.success(res, '获取商品详情成功', data)
    })
    .catch(err => {
      utils.error(res, '获取商品详情失败', err)
    })
})

router.post('/goods_edit', function (req, res, next) {
  var reqBody = req.body;
  var _id = reqBody.goods_id;
  var title = reqBody.title;
  var valuation = reqBody.valuation;
  var cover = reqBody.cover;
  var figureImgs = reqBody.figure_imgs;
  var detailImgs = reqBody.detail_imgs;
  var originFigureImgs = reqBody.origin_figure_imgs;
  var originDetailImgs = reqBody.origin_detail_imgs;

  if (!_id || !title || !valuation || !cover || !figureImgs || !detailImgs || !originFigureImgs || !originDetailImgs) {
    return utils.fail(res, 1)
  }

  if (cover && cover !== reqBody.origin_cover) {
    var isWebUrl = /(http:\/\/)|(https:\/\/)/.test(cover);
    var originKey = cover;
    var filename = undefined;
    var destKey = undefined;
    if (!isWebUrl) {
      utils.resourceDelete({ // 删除cover
        key: reqBody.origin_cover,
        success: function (res) {
          filename = cover.split('/')[cover.split('/').length - 1];
          destKey = config.qiniuConfig.goodsCoverDirname + filename;
          reqBody.cover = destKey

          utils.resourceMove({ // 移动cover
            srcKey: originKey,
            destKey: destKey,
            error: function (err) {
              utils.writeQiniuErrorLog('修改商品cover图，单个移动过程失败，err: ' + err)
            }
          })
        },
        error: function (err) {
          utils.writeQiniuErrorLog('修改商品cover图，单个删除过程失败，err: ' + err)
        }
      })
    }
  }
  delete reqBody.origin_cover

  var figureImgsInter = utils.getIntersection(figureImgs, originFigureImgs)
  var detailImgsInter = utils.getIntersection(detailImgs, originDetailImgs)

  var figureImgsDelete = utils.getDifference(originFigureImgs, figureImgsInter)
  var figureImgsMove = utils.getDifference(figureImgs, figureImgsInter)

  var detailImgsDelete = utils.getDifference(originDetailImgs, detailImgsInter)
  var detailImgsMove = utils.getDifference(detailImgs, detailImgsInter)

  var deleteImgs = figureImgsDelete.concat(detailImgsDelete)

  // 商品轮播图部分
  var goodsFigureDirname = config.qiniuConfig.goodsFigureDirname;
  var movedFigureImgs = [];
  figureImgsMove.forEach(function (item, index, arr) {
    var filename = item.split('/')[item.split('/').length - 1]
    movedFigureImgs.push(goodsFigureDirname + filename);
  })

  // 商品详情图部分
  var goodsDetailDirname = config.qiniuConfig.goodsDetailDirname;
  var movedDetailImgs = [];
  detailImgsMove.forEach(function (item, index, arr) {
    var filename = item.split('/')[item.split('/').length - 1]
    movedDetailImgs.push(goodsDetailDirname + filename);
  })

  ShopGoods.findOneAndUpdate({ _id: _id }, {
    title: title,
    valuation: valuation,
    cover: reqBody.cover,
    figure_imgs: utils.changeQiniuFilename(figureImgs, goodsFigureDirname),
    detail_imgs: utils.changeQiniuFilename(detailImgs, goodsDetailDirname)
  })
    .then(() => {
      utils.success(res, '修改商品成功')
      if (deleteImgs.length) { // 删除图片
        utils.resourceDeleteBatch({
          keys: deleteImgs,
          error: function (err) {
            utils.writeQiniuErrorLog('修改商品时批量删除图片失败，err: ' + err)
          }
        })
      }
      if (figureImgsMove.length) { // 移动图片
        utils.resourceMoveBatch({
          srcKeys: figureImgsMove,
          destDirname: goodsFigureDirname,
          error: function (err) {
            utils.writeQiniuErrorLog('修改商品时批量移动图片时失败，err: ' + err)
          }
        })
      }
      if (detailImgsMove.length) { // 移动图片
        utils.resourceMoveBatch({
          srcKeys: detailImgsMove,
          destDirname: goodsDetailDirname,
          error: function (err) {
            utils.writeQiniuErrorLog('修改商品时批量移动图片时失败，err: ' + err)
          }
        })
      }
    })
    .catch(err => {
      utils.error(res, '修改商品失败', err)
    })
})

router.get('/topic_list', function (req, res, next) {
  Topic.find().sort({ updatedAt: -1 }).populate({ path: 'author_id' })
    .then(data => {
      utils.success(res, '获取帖子列表成功', data)
    })
    .catch(err => {
      utils.error(res, '获取帖子列表失败', err)
    })
})

router.get('/topic_detail', function (req, res, next) {
  var _id = req.query._id

  if (!_id) {
    return utils.fail(res, 1)
  }

  Topic.findOne({ _id: _id })
    .then(data => {
      var viewCount = data.view_count + 1;
      utils.success(res, '获取帖子详情成功', data)
    })
    .catch(err => {
      utils.error(res, '获取帖子详情失败', err)
    })
})

router.post('/user_add', function (req, res, next) {
  var reqBody = req.body;
  var username = reqBody.username;
  var password = reqBody.password;

  if (!username || !password) {
    return utils.fail(res, 1)
  }

  User.findOne({ username: username })
    .then(data => {
      if (data) {
        return utils.fail(res, '用户名已存在')
      }

      var hash = crypto.createHash('md5');
      hash.update(config.passwordKey.left + password + config.passwordKey.right);

      var user = new User({
        ...reqBody,
        password: hash.digest('hex'),
        is_admin: true
      })

      user.save()
        .then(() => {
          utils.success(res, '用户添加成功')
        })
        .catch(err => {
          utils.error(res, '用户添加失败', err)
        })
    })
    .catch(err => {
      utils.error(res, '用户添加失败', err)
    })
})

router.get('/topic_check_list', function (req, res, next) {
  Topic.count({ status: -1 })
    .then(count => {
      Topic.findOne({ status: -1 }).sort({ createdAt: 1 })
        .then(data => {
          res.json({
            success: true,
            msg: '获取审核帖子成功',
            count: count,
            data: data
          })
        })
        .catch(err => {
          res.json({
            success: false,
            msg: '获取未审核总数成功，但获取审核帖子失败',
            count: count,
            err: err.toString()
          })
        })
    })
    .catch(err => {
      utils.error(res, '获取未审核帖子总数失败', err)
    })
})

router.post('/topic_check', function (req, res, next) {
  var reqBody = req.body;
  var _id = reqBody._id;
  var status = reqBody.status;

  Topic.findOneAndUpdate({ _id: _id }, { status: status })
    .then(() => { // 先审核
      Topic.count({ status: -1 })
        .then(count => { // 查总数
          Topic.findOne({ status: -1 }).sort({ createdAt: 1 })
            .then(data => { // 返回最早的未审核的一条帖子
              res.json({
                success: true,
                msg: '审核成功',
                count: count,
                data: data
              })
            })
            .catch(err => {
              res.json({
                success: false,
                msg: '获取未审核总数成功，但获取审核帖子失败',
                count: count,
                err: err.toString()
              })
            })
        })
        .catch(err => {
          utils.error(res, '审核成功，但获取未审核帖子总数失败', err)
        })
    })
    .catch(err => {
      utils.error(res, '审核失败', err)
    })
})

module.exports = router
