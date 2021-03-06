var config = require('./config/clothes.config.js');
var qiniu = require('qiniu');
var fs = require('fs');

var utils = {
  qiniuObj: {},
  tenParse: function (number) {
    return number < 10 ? '0' + number : number
  },
  parseDate: function (date, integer) {
    let dateObj = new Date(date)
    let year = dateObj.getFullYear()
    let month = dateObj.getMonth() + 1
    let day = dateObj.getDate()
    let hour = dateObj.getHours()
    let minute = dateObj.getMinutes()
    let second = dateObj.getSeconds()
    if (integer) { // 返回20180315123050
      return year + this.tenParse(month) + this.tenParse(day) + this.tenParse(hour) + this.tenParse(minute) + this.tenParse(second)
    } else { // 返回2018-03-16 16:34:35
      return year + '-' + this.tenParse(month) + '-' + this.tenParse(day) + ' ' + this.tenParse(hour) + ':' + this.tenParse(minute) + ':' + this.tenParse(second)
    }
  },
  generateGuid: function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0
      var v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  },
  randomWord: function(randomFlag, min, max) {
    // 生成3-32位随机串：randomWord(true, 3, 32)
    // 生成43位随机串：randomWord(false, 43)
    var str = "",
      range = min,
      arr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

    // 随机产生
    if (randomFlag) {
      range = Math.round(Math.random() * (max - min)) + min;
    }
    for (var i = 0; i < range; i++) {
      pos = Math.round(Math.random() * (arr.length - 1));
      str += arr[pos];
    }
    return str;
  },
  filterEmptyValue: function (obj) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key) && (obj[key] == null || obj[key] == undefined || obj[key] == '')) {
        delete obj[key];
      }
    }
    return obj
  },
  getIntersection: function (a, b) { // 数组交集
    return a.filter(function (v) {
      return b.includes(v)
    })
  },
  getDifference: function (a, b) { // 数组差集
    return a.concat(b).filter(function (v) {
      return !a.includes(v) || !b.includes(v)
    })
  },
  success: function (res, msg, data) {
    res.json({
      success: true,
      msg: msg,
      data: data
    })
  },
  fail: function (res, msg) {
    res.json({
      success: false,
      msg: msg === 1 ? '缺少参数或参数错误' : msg
    })
  },
  error: function (res, msg, err) {
    res.json({
      success: false,
      msg: msg,
      err: err.toString()
    })
  },
  writeQiniuErrorLog: function (msg) {

    var filepath = __dirname + '/logs/qiniu_error.log';

    var log = fs.readFileSync(filepath);

    fs.writeFileSync(filepath, log + '[' + utils.parseDate(Date.now()) + '] ' + msg + '\n\n');
  },
  changeQiniuFilename (fileArr, dirname) {
    for (var i =0; i < fileArr.length; i++) {
      if (fileArr[i].indexOf(dirname) === -1) {
        fileArr[i] = dirname + fileArr[i].split('/')[fileArr[i].split('/').length - 1]
      }
    }
    return fileArr
  },
  generateBucketManager: function () { // 七牛生成管理
    this.qiniuObj.accessKey = this.qiniuObj.accessKey || config.qiniuConfig.access_key;
    this.qiniuObj.secretKey = this.qiniuObj.secretKey || config.qiniuConfig.secret_key;

    this.qiniuObj.mac = this.qiniuObj.mac || new qiniu.auth.digest.Mac(this.qiniuObj.accessKey, this.qiniuObj.secretKey);
    var resourceConfig = new qiniu.conf.Config();
    return new qiniu.rs.BucketManager(this.qiniuObj.mac, resourceConfig);
  },
  resourceMove: function (params) { // 资源移动
    var srcKey = params.srcKey;
    var destKey = params.destKey;

    if (!srcKey || !destKey) {
      return params.error && params.error('缺少参数或参数错误')
    }

    var srcBucket = params.srcBucket || config.qiniuConfig.default_bucket;
    var destBucket = params.destBucket || config.qiniuConfig.default_bucket;

    this.qiniuObj.bucketManager = this.qiniuObj.bucketManager || this.generateBucketManager();

    this.qiniuObj.bucketManager.move(srcBucket, srcKey, destBucket, destKey, { force: !!params.force }, function (err, respBody, respInfo) {
      if (err) {
        return params.error && params.error('资源移动失败')
      }
      if (respInfo.statusCode === 200) {
        params.success && params.success('资源移动成功')
      } else {
        params.error && params.error(respInfo.data.error)
      }
    })
  },
  resourceMoveBatch: function (params) { // 资源批量移动
    var srcKeys = params.srcKeys;
    var destDirname = params.destDirname;

    if (!srcKeys || !srcKeys.length || !(srcKeys instanceof Array)) {
      return params.error && params.error('缺少参数或参数错误')
    }

    if (!destDirname || !destDirname.length || destDirname.lastIndexOf('/') !== destDirname.length - 1) {
      return params.error && params.error('目标文件夹需要且以/结尾')
    }

    var srcBucket = params.srcBucket || config.qiniuConfig.default_bucket;
    var destBucket = params.destBucket || config.qiniuConfig.default_bucket;

    var moveOperations = [];
    srcKeys.forEach(function (item, index, arr) {
      var filename = item.split('/')[item.split('/').length - 1]
      moveOperations.push(qiniu.rs.moveOp(srcBucket, item, destBucket, destDirname + filename));
    });

    this.qiniuObj.bucketManager = this.qiniuObj.bucketManager || this.generateBucketManager();
    this.qiniuObj.bucketManager.batch(moveOperations, function(err, respBody, respInfo) {
      if (err) {
        return params.error && params.error(err)
      }

      if (parseInt(respInfo.statusCode / 100) === 2) {
        var successNum = 0;
        respBody.forEach(function (item) {
          if (item.code === 200) {
            successNum++
          }
        })
        if (successNum === srcKeys.length) {
          params.success && params.success(srcKeys.length + '张全部批量移动成功')
        } else {
          params.success && params.success('总数' + srcKeys.length + '，成功' + successNum)
        }
      } else {
        params.error && params.error(respInfo.data.error)
      }
    })
  },
  resourceDelete: function (params) { // 资源删除
    var bucket = params.bucket || config.qiniuConfig.default_bucket;
    var resourceKey = params.key
    if (!resourceKey) {
      return params.error && params.error('缺少要删除资源的key')
    }

    this.qiniuObj.bucketManager = this.qiniuObj.bucketManager || this.generateBucketManager();

    this.qiniuObj.bucketManager.delete(bucket, resourceKey, function (err, respBody, respInfo) {
      if (err) {
        params.error && params.error(err)
      } else {
        params.success && params.success('资源删除成功')
      }
    })
  },
  resourceDeleteBatch: function (params) {
    var keys = params.keys;
    if (!keys || !keys.length || !(keys instanceof Array)) {
      return params.error && params.error('缺少参数或参数错误')
    }

    var deleteOperations = [];
    keys.forEach(function (item, index, arr) {
      deleteOperations.push(qiniu.rs.deleteOp(config.qiniuConfig.default_bucket, item));
    });

    this.qiniuObj.bucketManager = this.qiniuObj.bucketManager || this.generateBucketManager();
    this.qiniuObj.bucketManager.batch(deleteOperations, function(err, respBody, respInfo) {
      if (err) {
        return params.error && params.error(err)
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
          params.success && params.success(keys.length + '张全部批量删除成功')
        } else {
          params.success && params.success('总数' + keys.length + '，成功' + successNum)
        }
      } else {
        params.error && params.error(respInfo.data.error)
      }
    })
  }
}

module.exports = utils;
