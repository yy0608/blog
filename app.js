var express = require('express')
var swig = require('swig')

var mongoose = require('mongoose')

var app = express()

app.engine('html', swig.renderFile)

app.set('views', './views')
app.set('view engine', 'html')

swig.setDefaults({cache: false}) // 模板渲染不要缓存，避免开发不改变问题

app.use('/public', express.static(__dirname + '/public'))

// app.get('/', function (req, res, next) {
//   res.render('index')
// })

app.use('/', require('./routers/main.js'))
app.use('/api', require('./routers/api.js'))
app.use('/admin', require('./routers/admin.js'))

mongoose.connect('mongodb://localhost:27017/laogao', {
  useMongoClient: true
})

app.listen(3000, function (err) {
  if (err) {
    console.log(err)
  } else {
    console.log('listen on port 3000')
  }
})
