var express = require('express');
var router = express.Router();

var Topic = require('../../models/clothes/Topic.js');

router.get('/topic_list', function (req, res, next) {
  Topic.find().sort({ updatedAt: -1 }).populate({ path: 'author_id', select: { name: 1, _id: 0 } })
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
  var _id = req.query._id

  if (!_id) {
    return res.json({
      success: false,
      msg: '缺少参数或参数错误'
    })
  }

  Topic.findOne({ _id: _id })
    .then(data => {
      res.json({
        success: true,
        msg: '获取帖子详情成功',
        data: data
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

module.exports = router
