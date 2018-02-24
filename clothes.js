var express = require('express')
var bodyParser = require('body-parser')
var mongoose = require('mongoose')
var redis = require('redis')

// 连接redis
global.redisClient = redis.createClient(6379, 'localhost')

global.redisClient.on('error', function (err) {
  console.log('redis connect error, message: ' + err)
})

// 使用全局的Promise，需要高版本node支持Promise，也可使用bluebird
mongoose.Promise = global.Promise

var app = express()

// post请求数据的处理，在req.body
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

// 设置路由组
app.use('/mp', require('./routers/clothes/mp.js'))
// app.use('/app', require('./routers/api.js'))
// app.use('/admin', require('./routers/admin.js'))

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
app.listen(3000, function(err) {
  if (err) {
    console.log(err)
  } else {
    console.log('listen on port 3000')
  }
})
