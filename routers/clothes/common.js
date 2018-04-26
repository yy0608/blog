var express = require('express');
var QcloudSms = require("qcloudsms_js") // 腾讯云短信服务

var router = express.Router();

var MerchantShop = require('../../models/clothes/MerchantShop.js');
var GoodsCategory = require('../../models/clothes/GoodsCategory.js');
var ShopGoods = require('../../models/clothes/ShopGoods.js');
var Topic = require('../../models/clothes/Topic.js');
var User = require('../../models/clothes/User.js');
var MerchantUser = require('../../models/clothes/MerchantUser.js');

var utils = require('../../utils.js');
var config = require('../../config/clothes.config.js');

var ssender = undefined; // sms短信发送

router.get('/shop_detail', function (req, res, next) { // [employ.js, user.js]
  var _id = req.query.shop_id;
  if (!_id) {
    return utils.fail(res, 1)
  }
  MerchantShop.findOne({ _id: _id })
    .then(data => {
      if (!data) {
        return utils.fail(res, '店铺不存在')
      }

      utils.success(res, '查询店铺详情成功', data)
    })
    .catch(err => {
      utils.error(res, '查询店铺详情出错', err)
    })
})

router.get('/near_shops', function (req, res, next) { // 查询附近的店铺，当前位置必传, [employ.js, user.js]
  var reqQuery = req.query;
  var parsePage = parseInt(reqQuery.page)
  var parseLimit = parseInt(reqQuery.limit)
  var page = isNaN(parsePage) || parsePage <= 0 ? 1 : parsePage
  var limit = isNaN(parseLimit) ? config.pageLimit : parseLimit
  var skip = (page - 1) * limit
  if (!reqQuery.location || typeof(reqQuery.location) !== 'string') {
    return utils.fail(res, 1)
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
      utils.success(res, '获取附近店铺成功', data)
    })
    .catch(err => {
      utils.error(res, '获取附近店铺失败', err)
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

router.get('/goods_categories', function (req, res, next) { // [employ.js, user.js]
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
      utils.success(res, '获取分类列表成功', data)
    })
    .catch(err => {
      utils.error(res, '获取分类列表失败', err)
    })
})

router.get('/goods_list', function (req, res, next) { // [employ.js, user.js]
  var reqQuery = req.query;
  var shopId = reqQuery.shop_id;
  var categoryId = reqQuery.category_id;
  var queryOptions = utils.filterEmptyValue({
    shop_id: shopId,
    category_id: categoryId
  })
  ShopGoods.find(queryOptions).populate([{
    path: 'merchant_id'
  }, {
    path: 'shop_id'
  }, {
    path: 'category_id'
  }])
    .then(data => {
      utils.success(res, '获取商品列表成功', data)
    })
    .catch(err => {
      utils.error(res, '获取商品列表失败', err)
    })
})

router.post('/topic_add', function (req, res, next) { // [employ.js, user.js]
  var reqBody = req.body;
  var title = reqBody.title;
  var content = reqBody.content;
  var authorId = reqBody.author_id;

  if (!title || !content || !authorId || !(content instanceof Array)) {
    return utils.fail(res, 1)
  }

  var moveTopicImgs = [];
  var topicDirname = config.qiniuConfig.topicDirname;

  for (var i = 0; i < content.length; i++) { // type: 1为文字，2为图片, [employ.js, user.js]
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
    .then(() => {
      utils.success(res, '帖子添加成功')

      if (!moveTopicImgs.length) return;

      utils.resourceMoveBatch({
        srcKeys: moveTopicImgs,
        destDirname: topicDirname,
        error: function (err) {
          utils.writeQiniuErrorLog('批量移动帖子图片失败，err: ' + err)
        }
      })
    })
    .catch(err => {
      utils.error(res, '帖子添加失败', err)
    })
})

router.get('/send_sms', function (req, res, next) { // [employ.js, user.js]
  var reqQuery = req.query
  var phone = reqQuery.phone
  var findOption = {}, errMsg = '', redisPrefix = '', Schema = null

  if (!(/^1[34578]\d{9}$/.test(phone))) {
    return utils.fail(res, '手机号格式错误')
  }

  if (/\/employ\//.test(req.originalUrl)) {
    Schema = MerchantUser
    findOption = { phone: phone }
    errMsg = '手机号已注册'
    redisPrefix = config.redisPrefix.merchantAdd
  } else if (/\/user\//.test(req.originalUrl)) {
    Schema = User
    findOption = { username: phone }
    errMsg = '用户名已存在'
    redisPrefix = config.redisPrefix.register
  }

  Schema.findOne(findOption)
    .then(data => {
      // if (data) {
      //   return utils.fail(res, errMsg)
      // }

      var code = Math.random().toString().substr(2, 6)

      var smsConfig = config.smsConfig;
      var qcloudsms = QcloudSms(smsConfig.appid, smsConfig.appkey)
      var code = Math.random().toString().substr(2, 6)
      ssender = ssender || qcloudsms.SmsSingleSender() // 单发短信
      // ssender = ssender || qcloudsms.SmsMultiSender() // 群发短信
      ssender.send(smsConfig.smsType, 86, phone, code + " 为您的登录验证码，请于 2 分钟内填写。如非本人操作，请忽略本短信。", "", "", function (err, response, resData) {
        if (err) {
          return utils.error(res, '验证码发送失败', err)
        }
        if (resData.result) {
          utils.error(res, '验证码发送失败', resData.errmsg)
        } else {
          global.redisClient.set(redisPrefix + phone, code, function (err, res) {
            global.redisClient.expire(redisPrefix + phone, 120)
          })
          // utils.success(res, '验证码发送成功', resData)
          utils.success(res, '验证码发送成功')
        }
      });
    })
    .catch(err => {
      console.log(err)
      utils.error(res, '验证码发送失败', err)
    })
})

module.exports = router
