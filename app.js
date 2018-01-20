var express = require('express')
var bodyParser = require('body-parser')
var mongoose = require('mongoose')
// var cookies = require('cookies')
var cookieParser = require('cookie-parser')

// 使用全局的Promise，需要高版本node支持Promise，也可使用bluebird
mongoose.Promise = global.Promise

var app = express()

// post请求数据的处理，在req.body
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

// cookie的解析
app.use(cookieParser())

// 设置和获取cookies
app.use(function (req, res, next) {
  // req.cookies = new cookies(req, res)
  // console.log(req.cookies.get('OUTFOX_SEARCH_USER_ID_NCOO'))
  next()
})

// 解决跨域
app.all('*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "http://localhost:8080");
  res.header("Access-Control-Allow-Headers", "Content-Type,Content-Length, Authorization, Accept,X-Requested-With");
  res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Credentials", true)
  res.header("X-Powered-By", ' 3.2.1')
  if (req.method == "OPTIONS") res.sendStatus(200); /*让options请求快速返回*/
  else next();
});

// 设置路由组
app.use('/', require('./routers/main.js'))
app.use('/api', require('./routers/api.js'))
app.use('/admin', require('./routers/admin.js'))

// 连接数据库
mongoose.connect('mongodb://localhost:27017/laogao', {
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
