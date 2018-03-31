var express = require('express')
var User = require('../../models/forum/User.js')
var Category = require('../../models/forum/Category.js')
var Topic = require('../../models/forum/Topic.js')
var router = express.Router()

var responseData

var userInfo

router.use(function (req, res, next) { // 有权限才能拿到后台数据
  var _id = req.cookies.get('_id')
  responseData = {
    code: 0,
    msg: ''
  }
  if (!_id) {
    responseData.code = 1
    responseData.msg = '_id不存在'
    res.json(responseData)
    return
  }
  try {
    _id = JSON.parse(_id)
  } catch (e) {
    _id = _id
  }
  User.findOne({
    _id
  }).then(res => {
    if (!res) {
      responseData.code = 2
      responseData.msg = '用户不存在'
      res.json(responseData)
      return
    }
    userInfo = res
    if (!res.isAdmin) {
      responseData.code = 3
      responseData.msg = '用户无权限'
      res.json(responseData)
      return
    }
    next()
  }).catch(err => {
    responseData.code = 9
    responseData.msg = '查询数据库出错'
    responseData.message = err
    res.json(responseData)
    return
  })
})

router.get('/user/list', function (req, res, next) { // 注意此处获取用户条数和isNaN方法
  var reqQuery = req.query
  var parsePage = parseInt(reqQuery.page)
  var parseLimit = parseInt(reqQuery.limit)
  var page = isNaN(parsePage) || parsePage <= 0 ? 1 : parsePage
  var limit = isNaN(parseLimit) ? 10 : parseLimit
  var skip = (page - 1) * limit
  User.count().then(count => {
    // User.find({}, null, {
    //   limit,
    //   skip
    // }).then(data => {
    //   responseData.msg = '获取用户列表成功'
    //   responseData.user_list = data
    //   responseData.total_count = count
    //   res.json(responseData)
    //   return
    // }).catch(err => {
    //   responseData.code = 9
    //   responseData.msg = '查询用户列表出错'
    //   responseData.message = err
    //   res.json(responseData)
    // })
    User.find().limit(limit).skip(skip)
      .then(data => {
        responseData.msg = '获取用户列表成功'
        responseData.user_list = data
        responseData.total_count = count
        res.json(responseData)
        return
      })
      .catch(err => {
        responseData.code = 9
        responseData.msg = '查询用户列表出错'
        responseData.message = err
        res.json(responseData)
      })
    })
    .catch(err => {
      responseData.code = 8
      responseData.msg = '查询用户总数出错'
      responseData.message = err
      res.json(responseData)
    })
})

router.post('/user/delete', function (req, res, next) {
  var _id = req.body._id
  User.remove({
    _id: _id
  }).then(data => {
    responseData.msg = '删除用户成功'
    res.json(responseData)
  }).catch(err => {
    responseData.code = 9
    responseData.msg = '删除用户失败'
    responseData.message = err
    res.json(responseData)
  })
})

router.get('/category/list', function (req, res) {
  var reqQuery = req.query
  var parsePage = parseInt(reqQuery.page)
  var parseLimit = parseInt(reqQuery.limit)
  var page = isNaN(parsePage) || parsePage <=0 ? 1 : parsePage
  var limit = isNaN(parseLimit) ? 10 : parseLimit
  var skip = (page - 1) * limit
  Category.count()
    .then(count => {
      Category.find().limit(limit).skip(skip).sort({ _id: -1 })
        .then(data => {
          responseData.msg = '获取分类列表成功'
          responseData.total_count = count
          responseData.category_list = data
          res.json(responseData)
        })
        .catch(err => {
          responseData.code = 2
          responseData.msg = '获取分类列表失败'
          responseData.message = err
          res.json(responseData)
        })
    })
    .catch(err => {
      responseData.code = 8
      responseData.msg = '查询分类总数出错'
      responseData.message = err
      res.json(responseData)
    })
})

router.post('/category/add', function (req, res) {
  var reqBody = req.body
  Category.findOne({
    name: reqBody.name
  })
    .then(data => {
      if (data) {
        responseData.code = 3
        responseData.msg = '拥有相同分类名称'
        res.json(responseData)
      } else {
        var category = new Category({
          name: reqBody.name,
          desc: reqBody.desc,
          created_ts: Date.now()
        })
        category.save()
          .then(data => {
            responseData.msg = '添加分类成功'
            res.json(responseData)
          })
          .catch(err => {
            responseData.code = 2
            responseData.msg = '添加分类失败'
            responseData.message = err
            res.json(responseData)
          })
      }
    })
    .catch(err => {
      console.log(err)
      responseData.code = 9
      responseData.msg = '查询是否有相同分类名称失败'
      responseData.message = err
      res.json(responseData)
    })
})

router.post('/category/delete', function (req, res, next) {
  var _id = req.body._id
  Category.remove({
    _id: _id
  }).then(data => {
    responseData.msg = '删除分类成功'
    res.json(responseData)
  }).catch(err => {
    responseData.code = 9
    responseData.msg = '删除分类失败'
    responseData.message = err
    res.json(responseData)
  })
})

router.get('/category/detail', function (req, res, next) {
  var _id = req.query._id
  Category.findOne({
    _id: _id
  }).then(data => {
    if (data) {
      responseData.msg = '查找该_id的分类信息成功'
      responseData.detail = data
      res.json(responseData)
    } else {
      responseData.code = 1
      responseData.msg = '无该_id的分类信息'
      res.json(responseData)
    }
  }).catch(err => {
    responseData.code = 9
    responseData.msg = '获取该分类信息出错'
    responseData.message = err
    res.json(responseData)
  })
})

router.post('/category/edit', function (req, res, next) {
  var reqBody = req.body
  Category.findOne({
    name: reqBody.name
  })
    .then(data => {
      if (data && data._id != reqBody._id) {
        responseData.code = 3
        responseData.msg = '拥有相同分类名称'
        res.json(responseData)
      } else {
        Category.update({
          _id: reqBody._id
        }, {
          name: reqBody.name,
          desc: reqBody.desc,
          updated_ts: Date.now()
        })
          .then(data => {
            responseData.msg = '修改分类成功'
            res.json(responseData)
          })
          .catch(err => {
            responseData.code = 2
            responseData.msg = '修改分类失败'
            responseData.message = err
            res.json(responseData)
          })
      }
    })
    .catch(err => {
      console.log(err)
      responseData.code = 9
      responseData.msg = '查询是否有相同分类名称失败'
      responseData.message = err
      res.json(responseData)
    })
})

router.post('/topic/add', function (req, res, next) {
  var reqBody = req.body
  var docData = Object.assign({}, reqBody, {
    author: userInfo._id
  })
  var topic = new Topic(Object.assign({}, docData, {
    created_ts: Date.now()
  }))
  topic.save()
    .then(data => {
      responseData.msg = '添加帖子成功'
      res.json(responseData)
    })
    .catch(err => {
      console.log(err)
      responseData.code = 9
      responseData.msg = '添加帖子失败'
      responseData.message = err
      res.json(responseData)
    })
})

router.get('/topic/list', function (req, res, next) {
  var reqQuery = req.query
  var parsePage = parseInt(reqQuery.page)
  var parseLimit = parseInt(reqQuery.limit)
  var page = isNaN(parsePage) || parsePage <=0 ? 1 : parsePage
  var limit = isNaN(parseLimit) ? 10 : parseLimit
  var skip = (page - 1) * limit
  Topic.count()
    .then(count => {
      responseData.total_count = count
      Topic.find({}, { intro: 0, content: 0, __v: 0 }).limit(limit).skip(skip).sort({ _id: -1 }).populate([{
        path: 'category',
        select: {
          name: 1,
          _id: 0
        }
      }, {
        path: 'author',
        select: {
          password: 0
        }
      }])
        .then(data => {
          responseData.msg = '查询文章列表成功'
          responseData.topic_list = data
          res.json(responseData)
        })
        .catch(err => {
          console.log(err)
          responseData.code = 8
          responseData.msg = '查询文章列表失败'
          responseData.message = err
          res.json(responseData)
        })
    })
    .catch(err => {
      console.log(err)
      responseData.code = 9
      responseData.msg = '查询是否有相同分类名称失败'
      responseData.message = err
      res.json(responseData)
    })
})

router.get('/topic/detail', function (req, res, next) {
  var _id = req.query._id
  Topic.findOne({ _id: _id }, { category: 1, content: 1, intro: 1, title: 1 })
    .then(data => {
      if (data) {
        responseData.msg = '查找该_id的文章信息成功'
        responseData.detail = data
        res.json(responseData)
      } else {
        responseData.code = 1
        responseData.msg = '无该_id的文章信息'
        res.json(responseData)
      }
    })
    .catch(err => {
      responseData.code = 9
      responseData.msg = '获取该文章息出错'
      responseData.message = err
      res.json(responseData)
    })
})

router.post('/topic/edit', function (req, res, next) {
  var reqBody = req.body
  Topic.update({
    _id: reqBody._id
  }, {
    title: reqBody.title,
    intro: reqBody.intro,
    content: reqBody.content,
    category: reqBody.category,
    updated_ts: Date.now()
  })
    .then(data => {
      responseData.msg = '修改文章成功'
      res.json(responseData)
    })
    .catch(err => {
      responseData.code = 2
      responseData.msg = '修改文章失败'
      responseData.message = err
      res.json(responseData)
    })
})

router.post('/topic/delete', function (req, res, next) {
  var _id = req.body._id
  Topic.remove({
    _id: _id
  }).then(data => {
    responseData.msg = '删除文章成功'
    res.json(responseData)
  }).catch(err => {
    responseData.code = 9
    responseData.msg = '删除文章失败'
    responseData.message = err
    res.json(responseData)
  })
})

module.exports = router
