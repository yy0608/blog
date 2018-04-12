var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var redis = require('redis');

var app = express()

// 连接redis
global.redisClient = redis.createClient(6379, 'localhost')

global.redisClient.on('error', function (err) {
  console.log('redis connect error, message: ' + err)
})

// var log = '[' + new Date() + '] ' + 'http://www.baidu.com/' + '\n';
// global.errorLogfile.write(log + '\n');

// 使用全局的Promise，需要高版本node支持Promise，也可使用bluebird
mongoose.Promise = global.Promise

// 解决跨域
app.all('*', function(req, res, next) {
  var originArray = ['http://127.0.0.1:8080', 'http://localhost:8080', 'http://clothes.jingia.com', 'https://clothes.jingia.com']
  if (originArray.indexOf(req.headers.origin) !== -1) {
    res.header("Access-Control-Allow-Origin", req.headers.origin);
    res.header("Access-Control-Allow-Headers", "Content-Type,Content-Length, Authorization, Accept,X-Requested-With");
    res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Credentials", true)
    res.header("X-Powered-By", ' 3.2.1')
  }
  if (req.method == "OPTIONS") res.sendStatus(200); /*让options请求快速返回*/
  else next();
});

// post请求数据的处理，在req.body
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

// 设置路由组
app.use('/v1/mp', require('./routers/clothes/mp.js'))
app.use('/v1/all', require('./routers/clothes/all.js'))
app.use('/v1/employ', require('./routers/clothes/employ.js'))
app.use('/v1/merchant', require('./routers/clothes/merchant.js'))
app.use('/v1/user', require('./routers/clothes/user.js'))
app.use('/v1/qiniu', require('./routers/clothes/qiniu.js'))

// 连接数据库
mongoose.connect('mongodb://youyi:yy0608@localhost:27017/clothes', {
  useMongoClient: true
}, function(err) {
  if (err) {
    console.log('数据库连接失败')
  } else {
    console.log('数据库连接成功')
  }
}).catch(err => {
  console.log(err.message)
})

// 监听端口，开启服务
app.listen(3004, function(err) {
  if (err) {
    console.log(err)
  } else {
    console.log('listen on port 3004')
  }
})
