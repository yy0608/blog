var express = require('express');
var qiniu = require('qiniu');

var config = require('./config.js');

var router = express.Router();

var qiniuObj = {}; // 当前页的全局对象

router.all('/generate_token', function (req, res, next) {
  var reqBody = req.body;
  var reqQuery = req.query;
  var scope = reqBody.scope || reqQuery.scope || config.qiniuConfig.default_bucket;
  var expires = reqBody.expires || reqQuery.expires;
  expires = parseInt(expires);
  expires = isNaN(expires) ? 3600 : expires; // 单位秒
  var token = generateToken(scope, expires);

  res.json({
    success: true,
    data: token,
    uptoken: token,
    expires: expires
  })
})

router.post('/resource_upload', function (req, res, next) { // 资源上传
  res.json({
    success: true
  })
})

router.post('/resource_stat', function (req, res, next) { // 资源信息
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

  qiniuObj.bucketManager.stat(bucket, resourceKey, function (err, respBody, respInfo) {
    if (err) {
      return res.json({
        sucess: false,
        msg: '获取资源信息出错',
        err: err.toString()
      })
    }
    if (respInfo.statusCode === 200) {
      res.json({
        success: true,
        msg: '获取资源信息成功',
        data: respInfo.data
      })
    } else {
      res.json({
        sucess: false,
        msg: '获取资源信息出错',
        err: respInfo.data.error
      })
    }
  })
})

router.post('/resource_list', function (req, res, next) { // 获取资源列表
  var reqBody = req.body;
  var bucket = reqBody.bucket || config.qiniuConfig.default_bucket;
  var prefix = reqBody.prefix || '' // 前缀
  var limit = reqBody.limit || config.pageLimit // 每次几条
  var marker = reqBody.marker || '' // 上一次的标记
  var options = {
    prefix: prefix,
    limit: limit,
    marker: marker
  }

  qiniuObj.bucketManager = qiniuObj.bucketManager || generateBucketManager();

  qiniuObj.bucketManager.listPrefix(bucket, options, function (err, respBody, respInfo) {
    if (err) {
      res.json({
        success: false,
        msg: '获取七牛资源列表失败',
        err: err
      })
    }
    if (respInfo.statusCode == 200) {
      //如果这个nextMarker不为空，那么还有未列举完毕的文件列表，下次调用listPrefix的时候，
      //指定options里面的marker为这个值
      var nextMarker = respBody.marker;
      var commonPrefixes = respBody.commonPrefixes;
      var resList = []
      // console.log(nextMarker);
      // console.log(commonPrefixes);
      var items = respBody.items;
      items.forEach(function(item) {
        resList.push({
          key: item.key,
          type: item.mimeType,
          fsize: item.fsize,
          putTime: item.putTime
        })
      });
      res.json({
        success: true,
        msg: '获取七牛资源列表成功',
        nextMarker: nextMarker,
        data: resList
      })
    } else {
      res.json({
        success: false,
        msg: '获取七牛资源列表失败',
        err: respInfo.data.error
      })
      // console.log(respInfo.statusCode);
      // console.log(respBody);
    }
  });
})

router.post('/resource_move', function (req, res, next) { // 资源移动或重命名
  var reqBody = req.body;
  var srcKey = reqBody.srcKey;
  var destKey = reqBody.destKey;

  if (!srcKey || !destKey) {
    return res.json({
      success: false,
      msg: '缺少参数'
    })
  }

  var srcBucket = reqBody.srcBucket || config.qiniuConfig.default_bucket;
  var destBucket = reqBody.destBucket || config.qiniuConfig.default_bucket;

  qiniuObj.bucketManager = qiniuObj.bucketManager || generateBucketManager();

  qiniuObj.bucketManager.move(srcBucket, srcKey, destBucket, destKey, { force: !!reqBody.force }, function (err, respBody, respInfo) {
    if (err) {
      return res.json({
        success: false,
        msg: '资源移动失败'
      })
    }
    if (respInfo.statusCode === 200) {
      res.json({
        success: true,
        msg: '资源移动成功'
      })
    } else {
      res.json({
        success: false,
        msg: '资源移动失败',
        err: respInfo.data.error
      })
    }
  })
})

router.post('/resource_move_batch', function (req, res, next) { // 资源批量移动
  var reqBody = req.body;
  var srcKeys = reqBody.srcKeys;
  // var destKeys = reqBody.destKeys;
  var destDirname = reqBody.destDirname;

  if (!srcKeys || !srcKeys.length || !(srcKeys instanceof Array)) {
    return res.json({
      success: false,
      msg: '缺少参数或参数错误'
    })
  }

  if (!destDirname || !destDirname.length || destDirname.indexOf('/') !== destDirname.length - 1) {
    return res.json({
      success: false,
      msg: '目标文件夹需要且以/结尾'
    })
  }

  var srcBucket = reqBody.srcBucket || config.qiniuConfig.default_bucket;
  var destBucket = reqBody.destBucket || config.qiniuConfig.default_bucket;

  var moveOperations = [];
  srcKeys.forEach(function (item, index, arr) {
    var filename = item.split('/')[item.split('/').length - 1]
    moveOperations.push(qiniu.rs.moveOp(srcBucket, item, destBucket, destDirname + filename));
  });

  qiniuObj.bucketManager = qiniuObj.bucketManager || generateBucketManager();
  qiniuObj.bucketManager.batch(moveOperations, function(err, respBody, respInfo) {
    if (err) {
      return res.json({
        success: false,
        msg: '批量移动失败',
        err: err
      })
    }

    if (parseInt(respInfo.statusCode / 100) === 2) {
      var successNum = 0;
      respBody.forEach(function (item) {
        if (item.code === 200) {
          successNum++
        }
      })
      if (successNum === srcKeys.length) {
        res.json({
          success: true,
          msg: '全部批量移动成功'
        })
      } else {
        res.json({
          success: true,
          code: 2,
          msg: '总数' + srcKeys.length + '，成功' + successNum
        })
      }
    } else {
      res.json({
        success: false,
        msg: '批量移动失败',
        err: respInfo.data.error
      })
    }
  })
})

router.post('/resource_delete', function (req, res, next) { // 资源删除
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
          err: respInfo.data.error,
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

router.post('/resource_delete_batch', function (req, res, next) { // 资源批量删除
  var reqBody = req.body;
  var keys = reqBody.keys;
  if (!keys || !keys.length || !(keys instanceof Array)) {
    return res.json({
      success: false,
      msg: '缺少参数或参数错误'
    })
  }

  var deleteOperations = [];
  keys.forEach(function (item, index, arr) {
    deleteOperations.push(qiniu.rs.deleteOp(config.qiniuConfig.default_bucket, item));
  });

  qiniuObj.bucketManager = qiniuObj.bucketManager || generateBucketManager();
  qiniuObj.bucketManager.batch(deleteOperations, function(err, respBody, respInfo) {
    if (err) {
      return res.json({
        success: false,
        msg: '批量删除失败',
        err: err
      })
    }

    if (parseInt(respInfo.statusCode / 100) === 2) {
      var successNum = 0;
      // var successKyes = [];
      respBody.forEach(function (item) {
        if (item.code === 200) {
          successNum++
        }
      })
      if (successNum === keys.length) {
        res.json({
          success: true,
          msg: '全部批量删除成功'
        })
      } else {
        res.json({
          success: true,
          code: 2,
          msg: '总数' + keys.length + '，成功' + successNum
        })
      }
    } else {
      res.json({
        success: false,
        msg: '批量删除失败',
        err: respInfo.data.error
      })
    }
  })
})

function generateToken (scope, expires) { // 生成token
  qiniuObj.accessKey = qiniuObj.accessKey || config.qiniuConfig.access_key;
  qiniuObj.secretKey = qiniuObj.secretKey || config.qiniuConfig.secret_key;
  qiniuObj.mac = qiniuObj.mac || new qiniu.auth.digest.Mac(qiniuObj.accessKey, qiniuObj.secretKey);

  var putPolicy = new qiniu.rs.PutPolicy({ scope: scope, expires: expires });
  var token = putPolicy.uploadToken(qiniuObj.mac);

  return token
}

function generateBucketManager () { // 生成管理
  qiniuObj.accessKey = qiniuObj.accessKey || config.qiniuConfig.access_key;
  qiniuObj.secretKey = qiniuObj.secretKey || config.qiniuConfig.secret_key;

  qiniuObj.mac = qiniuObj.mac || new qiniu.auth.digest.Mac(qiniuObj.accessKey, qiniuObj.secretKey);
  var resourceConfig = new qiniu.conf.Config();
  return new qiniu.rs.BucketManager(qiniuObj.mac, resourceConfig);
}

module.exports = router
