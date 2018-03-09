var express = require('express')
var app = express()
var redis = require('redis')
var session = require('express-session')

// 连接redis
global.redisClient = redis.createClient(6379, 'localhost')

var RedisStore = require('connect-redis')(session);

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

app.use(session({
  secret: 'session_test',
  store: new RedisStore({
    client: redisClient,
    // host: 'localhost',
    // port: 6379
  }),
  cookie: {
    maxAge: 30 * 1000
  },
  resave: true, // :(是否允许)当客户端并行发送多个请求时，其中一个请求在另一个请求结束时对session进行修改覆盖并保存。如果设置false，可以使用.touch方法，避免在活动中的session失效。
  saveUninitialized: false // 初始化session时是否保存到存储
}))

app.post('/login', function (req, res, next) { // 登录接口存session
  req.session.signed = '1' // 只有使用了req.session.signed时才会在redis保存数据，有效期和cookie里的maxAge一样
  req.session.signed2 = '1' // 只有使用了req.session.signed时才会在redis保存数据，有效期和cookie里的maxAge一样
  res.json({
    success: true
  })
})

app.get('/all', function (req, res, next) { // 其他接口取session
  res.json({
    success: true,
    logined: req.session.signed
  })
})

app.listen(3000, function () {
  console.log('listen on port ...')
})
