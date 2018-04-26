var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var config = require('../../config/clothes.config.js');
var client = global.redisClient;
var utils = require('../../utils.js');
// var QcloudSms = require("qcloudsms_js") // 腾讯云短信服务

var User = require('../../models/clothes/User.js');
var Topic = require('../../models/clothes/Topic.js');
var Comment = require('../../models/clothes/Comment.js');
var ShopGoods = require('../../models/clothes/ShopGoods.js');

const loginTtl = 1800;
// let ssender = undefined;

router.use(function (req, res, next) {

  if (req.url === '/check_login' || req.url === '/login' || req.url === '/register' || req.url === '/logout') {
    return next()
  }

  var reqBody = req.body;
  var reqQuery = req.query;
  var sessionId = req.method === 'POST' ? reqBody.session_id : reqQuery.session_id;

  if (!sessionId) {
    return next()
  } else {
    client.get(sessionId, function (err, v) {
      if (!err && v) { // 延长登录态
        client.expire(sessionId, loginTtl);
      }
      next()
    })
  }
})

router.use(require('./common.js'))

router.post('/register', function (req, res, next) {
  var reqBody = req.body;
  var username = reqBody.username;
  var password = reqBody.password;
  var code = reqBody.code;
  var redisPrefix = config.redisPrefix.register

  if (!(/^1[34578]\d{9}$/.test(username)) || !password || !code) {
    return utils.fail(res, 1)
  }

  global.redisClient.get(redisPrefix + username, function (err, v) {
    if (err) {
      return utils.fail(res, 'redis处理异常')
    }
    if (v !== code) {
      utils.fail(res, '短信验证码错误或失效')
    } else {
      redisClient.del(redisPrefix + username); // 删除
      User.findOne({ username: username })
        .then(data => {
          if (data) {
            return utils.fail(res, '用户名已存在')
          }

          var hash = crypto.createHash('md5');
          hash.update(config.passwordKey.left + password + config.passwordKey.right);

          var user = new User({
            ...reqBody,
            password: hash.digest('hex')
          })
          user.save()
            .then(() => {
              utils.success(res, '注册成功')
            })
            .catch(err => {
              utils.error(res, '注册失败', err)
            })
        })
        .catch(err => {
          utils.error(res, '注册失败', err)
        })
    }
  })
})

router.get('/user_detail', function (req, res, next) {
  var reqQuery = req.query;
  var username = reqQuery.username;
  var _id = reqQuery._id;

  if (!username && !_id) {
    return utils.fail(res, 1)
  }

  User.findOne(utils.filterEmptyValue({
    username: username,
    _id: _id
  }), {
    createdAt: 0,
    updatedAt: 0,
    password: 0
  }).populate(['collected_topics', 'collected_goods', 'concerned_shops'])
    .then(data => {
      utils.success(res, '获取用户信息成功', data)
    })
    .catch(err => {
      utils.error(res, '获取用户信息失败', err)
    })
})

router.get('/user', function (req, res, next) { // 测试数组populate的接口，可删除
  var username = req.query.username;
  User.findOne({
    username: username
  }, {
    createdAt: 0,
    updatedAt: 0,
    password: 0
  }).populate([{
    path: 'collected_topics',
    options: {
      limit: 2,
      sort: { createdAt: -1 },
      skip: 0
    }
  }, {
    path: 'collected_goods'
  }])
    .then(data => {
      utils.success(res, '获取用户信息成功', data)
    })
    .catch(err => {
      utils.error(res, '添加分类失败', err)
    })
    // .exec(function (err, res) {
    //   console.log(err, res)
    // })
})

router.post('/login', function (req, res, next) {
  var reqBody = req.body;
  var username = reqBody.username;
  var password = reqBody.password;

  // if (!(/^1[34578]\d{9}$/.test(username)) || !password) {
  //   return res.json({
  //     success: false,
  //     msg: '缺少参数或参数错误'
  //   })
  // }

  if (!(username) || !password) {
    return utils.fail(res, 1)
  }

  var hash = crypto.createHash('md5');
  hash.update(config.passwordKey.left + password + config.passwordKey.right);

  User.findOne({
    username: username,
    password: hash.digest('hex')
  }, {
    createdAt: 0,
    updatedAt: 0,
    password: 0
  })
    .then(data => {
      if (!data) {
        return utils.fail(res, '用户名或密码错误')
      }

      var sessionId = utils.generateGuid()

      client.set(sessionId, JSON.stringify(data))
      client.expire(sessionId, loginTtl)

      res.json({
        success: true,
        msg: '登录成功',
        session_id: sessionId,
        data: data
      })
    })
})

router.post('/logout', function (req, res, next) {
  var sessionId = req.body.session_id;

  if (!sessionId) {
    return utils.success(res, '退出成功')
  }

  client.del(sessionId);

  utils.success(res, '退出成功')
})

router.post('/check_login', function (req, res, next) {
  var sessionId = req.body.session_id;

  if (!sessionId) {
    return utils.fail(res, 1)
  }

  client.get(sessionId, function (err, v) {
    if (err) {
      return utils.error(res, 'redis查询出错', err)
    }

    if (!v) {
      return utils.fail(res, 'session_id不存在')
    }

    client.expire(sessionId, loginTtl);

    utils.success(res, '登录态有效', JSON.parse(v))
  })
})

router.get('/goods_detail', function (req, res, next) { // user.js也有
  var reqQuery = req.query;
  var goodsId = reqQuery.goods_id;
  var shopId = reqQuery.shop_id;
  var userId = reqQuery.user_id;

  if (!goodsId || !shopId) {
    return utils.fail(res, 1)
  }
  ShopGoods.findOne({ _id: goodsId }).populate([{ path: 'category_id' }, { path: 'shop_id', select: { name: 1, address: 1 } }])
    .then(data => {
      if (!data) {
        return utils.fail(res, '获取商品详情失败，商品不存在')
      }
      if (!userId) { // 用户未登录
        return res.json({
          success: true,
          msg: '获取商品详情成功',
          goods_collected: false,
          shop_concerned: false,
          data: data
        })
      }
      User.findOne({ 'collected_goods': goodsId, '_id': userId }) // 查询商品收藏
        .then(goodsData => {
          User.findOne({ 'concerned_shops': shopId, '_id': userId }) // 查询店铺关注
            .then(shopData => {
              res.json({
                success: true,
                msg: '获取商品详情成功',
                goods_collected: !!goodsData,
                shop_concerned: !!shopData,
                data: data
              })
            })
            .catch(err => {
              res.json({
                success: true,
                msg: '获取商品详情成功，查询商品收藏成功，但查询店铺关注失败',
                goods_collected: !!goodsData,
                shop_concerned: false,
                data: data
              })
            })
        })
        .catch(err => {
          res.json({
            success: true,
            msg: '获取商品详情成功，但查询是否收藏失败',
            err: err.toString(),
            goods_collected: false,
            shop_concerned: false,
            data: data
          })
        })
    })
    .catch(err => {
      utils.error(res, '获取商品详情失败', err)
    })
})

router.get('/user_list', function (req, res, next) {
  var findAdmin = req.query.find_admin;
  var findOptions = findAdmin ? { is_admin: true } : {}
  User.find(findOptions)
    .then(data => {
      utils.success(res, '获取用户列表成功', data)
    })
    .catch(err => {
      utils.error(res, '获取用户列表失败', err)
    })
})

router.get('/topic_list', function (req, res, next) {
  Topic.find({ status: 0 }).sort({ createdAt: -1 }).populate({ path: 'author_id', select: { username: 1, _id: 0 } })
    .then(data => {
      utils.success(res, '获取帖子列表成功', data)
    })
    .catch(err => {
      utils.error(res, '获取帖子列表失败', err)
    })
})

router.get('/topic_detail', function (req, res, next) {
  var topicId = req.query.topic_id;
  var userId = req.query.user_id;

  if (!topicId) {
    return utils.fail(res, 1)
  }

  User.count({ 'collected_topics': topicId }) // 查询文章收藏总数
    .then(collectedCount => {
      Comment.count({ status: -1, topic_id: topicId })
        .then(count => {
          Topic.findOne({ _id: topicId }).populate({ path: 'author_id', select: {
            password: 0
          } })
            .then(data => {
              var viewCount = data.view_count + 1;
              Topic.findOneAndUpdate({ _id: topicId }, { view_count: viewCount })
                .then(() => {
                  if (userId) {
                    User.findOne({ 'collected_topics': topicId, '_id': userId }) // 查询当前用户是否收藏
                      .then(userData => {
                        res.json({ // 获取帖子详情成功，更新浏览量成功
                          success: true,
                          msg: '获取帖子详情成功',
                          comment_count: count,
                          collected: !!userData,
                          collected_count: collectedCount,
                          liked: data.liked_users.indexOf(userId) > -1,
                          liked_count: data.liked_users.length,
                          data: data
                        })
                      })
                      .catch(err => {
                        console.log(err)
                      })
                  } else {
                    res.json({ // 获取帖子详情成功，更新浏览量成功
                      success: true,
                      msg: '获取帖子详情成功',
                      collected: false,
                      comment_count: count,
                      collected_count: collectedCount,
                      liked: false,
                      liked_count: data.liked_users.length,
                      data: data
                    })
                  }
                })
                .catch(err => {
                  utils.error(res, '获取帖子详情成功，但更新浏览量失败', err)
                })
            })
            .catch(err => {
              utils.error(res, '获取帖子详情失败', err)
            })
        })
        .catch(err => {
          utils.error(res, '获取帖子详情失败', err)
        })
    })
    .catch(err => {
      console.log(err)
    })
})

router.get('/topic_edit_detail', function (req, res, next) {
  var reqQuery = req.query;
  var topicId = reqQuery.topic_id;

  if (!topicId) {
    return utils.fail(res, 1)
  }

  Topic.findOne({ _id: topicId }, {
    title: 1,
    content: 1
  })
    .then(data => {
      utils.success(res, '获取帖子详情成功', data)
    })
    .catch(err => {
      utils.error(res, '获取帖子详情失败', err)
    })
})

router.post('/topic_like', function (req, res, next) {
  var reqBody = req.body;
  var userId = reqBody.user_id;
  var topicId = reqBody.topic_id;
  var liked = reqBody.liked;

  if (!userId || !topicId) {
    return utils.fail(res, 1)
  }

  var handleOptions = liked ? { $pull: { 'liked_users': userId } } : { $addToSet: { 'liked_users': userId } }

  Topic.findOneAndUpdate({ _id: topicId }, handleOptions)
    .then(() => {
      // res.json({
      //   success: true,
      //   msg: liked ? '取消点赞成功' : '点赞成功'
      // })
      utils.success(res, liked ? '取消点赞成功' : '点赞成功')
    })
    .catch(err => {
      // res.json({
      //   success: false,
      //   msg: liked ? '取消点赞失败' : '点赞失败',
      //   err: err.toString()
      // })
      utils.error(res, liked ? '取消点赞失败' : '点赞失败', err)
    })
})

router.post('/topic_collect', function (req, res, next) { // 帖子收藏和取消收藏
  var reqBody = req.body;
  var userId = reqBody.user_id;
  var topicId = reqBody.topic_id;
  var collected = reqBody.collected;

  if (!userId || !topicId) {
    return utils.fail(res, 1)
  }

  var handleOptions = collected ? { $pull: { 'collected_topics': topicId } } : { $addToSet: { 'collected_topics': topicId } }

  User.findOneAndUpdate({ _id: userId }, handleOptions)
    .then(() => {
      // res.json({
      //   success: true,
      //   msg: collected ? '取消收藏成功' : '收藏成功'
      // })
      utils.success(res, collected ? '取消收藏成功' : '收藏成功')
    })
    .catch(err => {
      // res.json({
      //   success: false,
      //   msg: collected ? '取消收藏失败' : '收藏失败',
      //   err: err.toString()
      // })
      utils.error(res, collected ? '取消收藏失败' : '收藏失败', err)
    })
})

router.post('/goods_collect', function (req, res, next) { // 店铺收藏和取消收藏
  var reqBody = req.body;
  var userId = reqBody.user_id;
  var goodsId = reqBody.goods_id;
  var collected = reqBody.collected;

  if (!userId || !goodsId) {
    return utils.fail(res, 1)
  }

  var handleOptions = collected ? { $pull: { 'collected_goods': goodsId } } : { $addToSet: { 'collected_goods': goodsId } }

  User.findOneAndUpdate({ _id: userId }, handleOptions)
    .then(() => {
      // res.json({
      //   success: true,
      //   msg: collected ? '取消收藏成功' : '收藏成功'
      // })
      utils.success(res, collected ? '取消收藏成功' : '收藏成功')
    })
    .catch(err => {
      // res.json({
      //   success: false,
      //   msg: collected ? '取消收藏失败' : '收藏失败',
      //   err: err.toString()
      // })
      utils.error(res, collected ? '取消收藏失败' : '收藏失败', err)
    })
})

router.post('/shop_concern', function (req, res, next) { // 店铺收藏和取消收藏
  var reqBody = req.body;
  var userId = reqBody.user_id;
  var shopId = reqBody.shop_id;
  var concerned = reqBody.concerned;

  if (!userId || !shopId) {
    return utils.fail(res, 1)
  }

  var handleOptions = concerned ? { $pull: { 'concerned_shops': shopId } } : { $addToSet: { 'concerned_shops': shopId } }

  User.findOneAndUpdate({ _id: userId }, handleOptions)
    .then(() => {
      // res.json({
      //   success: true,
      //   msg: concerned ? '取消关注成功' : '关注成功'
      // })
      utils.success(res, concerned ? '取消关注成功' : '关注成功', data)
    })
    .catch(err => {
      // res.json({
      //   success: false,
      //   msg: concerned ? '取消关注失败' : '关注失败',
      //   err: err.toString()
      // })
      utils.error(res, concerned ? '取消关注失败' : '关注失败', err)
    })
})

router.post('/comment', function (req, res, next) {
  var reqBody = req.body;
  var topicId = reqBody.topic_id;
  var authorId = reqBody.author_id;
  var comment = reqBody.comment;

  if (!topicId || !authorId || !comment) {
    return utils.fail(res, 1)
  }

  var comment = new Comment(reqBody)
  comment.save()
    .then(() => {
      utils.success(res, '评论成功')
    })
    .catch(err => {
      utils.error(res, '评论失败', err)
    })
})

router.get('/comment_list', function (req, res, next) {
  Comment.find({ status: -1 }, {
    topic_id: 0,
    updatedAt: 0,
    status: 0
  }).populate({ path: 'author_id', select: {
    updatedAt: 0,
    _id: 0,
    password: 0,
    user_info: 0
  } }).sort({ createdAt: -1 })
    .then(data => {
      utils.success(res, '查询评论列表成功', data)
    })
    .catch(err => {
      utils.error(res, '查询评论列表失败', err)
    })
})

router.post('/comment_like', function (req, res, next) {
  var reqBody = req.body;
  var userId = reqBody.user_id;
  var commentId = reqBody.comment_id;
  var liked = reqBody.liked;

  if (!userId || !commentId) {
    return utils.fail(res, 1)
  }

  var handleOptions = liked ? { $pull: { 'liked_users': userId } } : { $addToSet: { 'liked_users': userId } }

  Comment.findOneAndUpdate({ _id: commentId }, handleOptions)
    .then(() => {
      // res.json({
      //   success: true,
      //   msg: liked ? '取消点赞成功' : '点赞成功'
      // })
      utils.success(res, liked ? '取消点赞成功' : '点赞成功')
    })
    .catch(err => {
      utils.error(res, liked ? '取消点赞失败' : '点赞失败', err)
    })
})

module.exports = router
