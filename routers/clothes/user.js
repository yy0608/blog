var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var config = require('./config.js');
var client = global.redisClient;
var utils = require('../../utils.js');

var User = require('../../models/clothes/User.js');
var Topic = require('../../models/clothes/Topic.js');
var Comment = require('../../models/clothes/Comment.js');

const loginTtl = 1800;

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

router.post('/register', function (req, res, next) {
  var reqBody = req.body;
  var username = reqBody.username;
  var password = reqBody.password;

  if (!(/^1[34578]\d{9}$/.test(username)) || !password) {
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

      var hash = crypto.createHash('md5');
      hash.update(config.passwordKey.left + password + config.passwordKey.right);

      var user = new User({
        ...reqBody,
        password: hash.digest('hex')
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
    return res.json({
      success: false,
      msg: '缺少参数或参数错误'
    })
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
        return res.json({
          success: false,
          msg: '用户名或密码错误'
        })
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

  console.log(sessionId);

  if (!sessionId) {
    return res.json({
      success: false,
      msg: '退出成功'
    })
  }

  client.del(sessionId);

  res.json({
    success: true,
    msg: '退出成功'
  })
})

router.post('/check_login', function (req, res, next) {
  var sessionId = req.body.session_id;

  if (!sessionId) {
    return res.json({
      success: false,
      msg: '缺少参数或参数错误'
    })
  }

  client.get(sessionId, function (err, v) {
    if (err) {
      return res.json({
        success: false,
        msg: 'redis查询出错',
        err: err.toString()
      })
    }

    if (!v) {
      return res.json({
        success: false,
        msg: 'session_id不存在'
      })
    }

    client.expire(sessionId, loginTtl);

    res.json({
      success: true,
      msg: '登录态有效',
      data: JSON.parse(v)
    })
  })
})

router.get('/user_list', function (req, res, next) {
  var findAdmin = req.query.find_admin;
  var findOptions = findAdmin ? { is_admin: true } : {}
  User.find(findOptions)
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

router.get('/topic_list', function (req, res, next) {
  Topic.find({ status: 0 }).sort({ createdAt: -1 }).populate({ path: 'author_id', select: { username: 1, _id: 0 } })
    .then(data => {
      res.json({
        success: true,
        msg: '获取帖子列表成功',
        data: data
      })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '获取帖子列表失败',
        err: err.toString()
      })
    })
})

router.get('/topic_detail', function (req, res, next) {
  var topicId = req.query.topic_id;
  var userId = req.query.user_id;

  if (!topicId) {
    return res.json({
      success: false,
      msg: '缺少参数或参数错误'
    })
  }

  User.count({ 'collected_topics': topicId }) // 查询文章收藏总数
    .then(collectedCount => {
      Comment.count({ status: -1 })
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
                      data: data
                    })
                  }
                })
                .catch(err => {
                  res.json({
                    success: false,
                    msg: '获取帖子详情成功，但更新浏览量失败',
                    err: err.toString()
                  })
                })
            })
            .catch(err => {
              res.json({
                success: false,
                msg: '获取帖子详情失败',
                err: err.toString()
              })
            })
        })
        .catch(err => {
          res.json({
            success: false,
            msg: '获取帖子详情失败',
            err: err.toString()
          })
        })
    })
    .catch(err => {
      console.log(err)
    })
})

router.post('/topic_collect', function (req, res, next) { // 收藏和取消收藏
  var reqBody = req.body;
  var userId = reqBody.user_id;
  var topicId = reqBody.topic_id;
  var collected = reqBody.collected;

  if (!userId || !topicId) {
    return res.json({
      success: false,
      msg: '缺少参数或参数错误'
    })
  }

  var handleOptions = collected ? { $pull: { 'collected_topics': topicId } } : { $addToSet: { 'collected_topics': topicId } }

  User.findOneAndUpdate({ _id: userId }, handleOptions)
    .then(() => {
      res.json({
        success: true,
        msg: collected ? '取消收藏成功' : '收藏成功'
      })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: collected ? '取消收藏失败' : '收藏失败',
        err: err.toString()
      })
    })
})

router.post('/topic_like', function (req, res, next) {
  var reqBody = req.body;
  var userId = reqBody.user_id;
  var topicId = reqBody.topic_id;
  var liked = reqBody.liked;

  if (!userId || !topicId) {
    return res.json({
      success: false,
      msg: '缺少参数或参数错误'
    })
  }

  var handleOptions = liked ? { $pull: { 'liked_users': userId } } : { $addToSet: { 'liked_users': userId } }

  Topic.findOneAndUpdate({ _id: topicId }, handleOptions)
    .then(() => {
      res.json({
        success: true,
        msg: liked ? '取消点赞成功' : '点赞成功'
      })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: liked ? '取消点赞失败' : '点赞失败',
        err: err.toString()
      })
    })
})

router.post('/comment', function (req, res, next) {
  var reqBody = req.body;
  var topicId = reqBody.topic_id;
  var authorId = reqBody.author_id;
  var comment = reqBody.comment;

  if (!topicId || !authorId || !comment) {
    return res.json({
      success: false,
      msg: '缺少参数或参数错误'
    })
  }

  var comment = new Comment(reqBody)
  comment.save()
    .then(() => {
      res.json({
        success: true,
        msg: '评论成功'
      })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '评论失败',
        err: err.toString()
      })
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
      res.json({
        success: true,
        msg: '查询评论列表成功',
        data: data
      })
    })
    .catch(err => {
      res.json({
        success: false,
        msg: '查询评论列表失败',
        err: err.toString()
      })
    })
})

module.exports = router
