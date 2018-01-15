var express = require('express')
var swig = require('swig')
var bodyParser = require('body-parser')

var mongoose = require('mongoose')

var app = express()

app.engine('html', swig.renderFile)

app.set('views', './views')
app.set('view engine', 'html')

swig.setDefaults({ cache: false }) // 模板渲染不要缓存，避免开发不改变问题

app.use('/public', express.static(__dirname + '/public'))

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.all('*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type,Content-Length, Authorization, Accept,X-Requested-With");
  res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
  res.header("X-Powered-By", ' 3.2.1')
  if (req.method == "OPTIONS") res.sendStatus(200); /*让options请求快速返回*/
  else next();
});

app.use('/', require('./routers/main.js'))
app.use('/api', require('./routers/api.js'))
app.use('/admin', require('./routers/admin.js'))

mongoose.connect('mongodb://localhost:27017/laogao', {
  useMongoClient: true
}, function(err) {
  if (err) {
    console.log('数据库连接失败')
  } else {
    console.log('数据库连接成功')
  }
})

app.listen(3000, function(err) {
  if (err) {
    console.log(err)
  } else {
    console.log('listen on port 3000')
  }
})