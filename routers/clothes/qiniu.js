var express = require('express');
var qiniu = require('qiniu');
// var multer = require('multer');
// var bytes = require('bytes');
var multiparty = require('multiparty');

var config = require('./config.js');

var router = express.Router();

var qiniuObj = {}; // 当前页的全局对象

router.post('/generate_token', function (req, res, next) {
  qiniuObj.accessKey = qiniuObj.accessKey || config.qiniuConfig.access_key;
  qiniuObj.secretKey = qiniuObj.secretKey || config.qiniuConfig.secret_key;
  qiniuObj.mac = qiniuObj.mac || new qiniu.auth.digest.Mac(qiniuObj.accessKey, qiniuObj.secretKey);

  var putPolicy = new qiniu.rs.PutPolicy({ scope: 'wusuowei' });
  var uploadToken = putPolicy.uploadToken(qiniuObj.mac);

  res.json({
    success: true,
    data: uploadToken
  })
})

// var storage = multer.memoryStorage();
// var upload = multer({
//   storage: storage,
//   limits: {
//     fileSize: bytes('2MB')
//   },
//   fileFilter: function (req, files, cb) {
//     var type = '|' + files.mimetype.slice(files.mimetype.lastIndexOf('') + 1) + '|'
//     var fileTypeValid = '|jpg|png|jpeg|gif|'.indexOf(type) !== -1
//     cb(null, !!fileTypeValid)
//   }
// })

// router.post('/resource_upload', upload.single('file'), function (req, res, next) {
//   console.log(req.file)
// })

router.post('/resource_upload', function (req, res, next) {
  var form = new multiparty.Form();
  form.parse(req, function (err, fields, files) {
    if (err) {
      return console.log(err)
    }
    console.log(111, fields)
    console.log(222, files)
  })
  res.json({
    success: true
  })
})

router.post('/resource_stat', function (req, res, next) {
  var reqBody = req.body;
  var bucket = reqBody.bucket || config.qiniuConfig.default_bucket;
  var resourceKey = reqBody.key
  if (!resourceKey) {
    return res.json({
      success: false,
      msg: '缺少参数key'
    })
  }

  qiniuObj.bucketManager = qiniuObj.bucketManager || generateBucketManager();

  qiniuObj.bucketManager.stat(bucket, resourceKey, function (err, data) {
    if (err) {
      res.json({
        sucess: false,
        msg: '获取资源信息出错',
        err: err.toString()
      })
    } else {
      if (data.error) {
        res.json({
          sucess: false,
          msg: '获取资源信息出错',
          err: data.error
        })
      } else {
        res.json({
          success: true,
          msg: '获取资源信息成功',
          data: data
        })
      }
    }
  })
})

router.post('/resource_delete', function (req, res, next) {
  var reqBody = req.body;
  var bucket = reqBody.bucket || config.qiniuConfig.default_bucket;
  var resourceKey = reqBody.key
  if (!resourceKey) {
    return res.json({
      success: false,
      msg: '缺少参数key'
    })
  }

  qiniuObj.bucketManager = qiniuObj.bucketManager || generateBucketManager();

  qiniuObj.bucketManager.delete(bucket, resourceKey, function (err, respBody, respInfo) {
    if (err) {
      res.json({
        success: false,
        msg: '资源删除失败',
        err: err.toString()
      })
    } else {
      if (respInfo.data.error) {
        res.json({
          success: true,
          code: 1,
          msg_error: respInfo.data.error,
          msg: '删除资源成功'
        })
      } else {
        res.json({
          success: true,
          code: 0,
          msg: '删除资源成功'
        })
      }
    }
  })
})

function generateBucketManager () {
  qiniuObj.accessKey = qiniuObj.accessKey || config.qiniuConfig.access_key;
  qiniuObj.secretKey = qiniuObj.secretKey || config.qiniuConfig.secret_key;

  qiniuObj.mac = qiniuObj.mac || new qiniu.auth.digest.Mac(qiniuObj.accessKey, qiniuObj.secretKey);
  var resourceConfig = new qiniu.conf.Config();
  return new qiniu.rs.BucketManager(qiniuObj.mac, resourceConfig);
}

module.exports = router
