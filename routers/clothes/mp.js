var express = require('express');
var router = express.Router()

var axios = require('axios')
var client = global.redisClient

// 通过系统获取唯一随机字符串
const exec = require('child_process').exec;

const appId = 'wxe738c78a114d18e9'
const appSecret = 'f3ffcb44c2adc124aa269699b8338596'

router.post('/login', function (req, res, next) {
	var reqBody = req.body
	var code = reqBody.code

	if (reqBody.session) {
		client.get(reqBody.session, function (err, v) {
			if (err) {
				res.json({
					success: false,
					msg: '从redis获取session出错',
					errmsg: err
				})
			} else {
				if (v) {
					try {
						var sessionInfo = JSON.parse(v)
						if (sessionInfo.openid) {
							res.json({
								success: true,
								msg: '登录态有效'
							})
							// 可以执行其他操作
						} else {
							res.json({
								success: false,
								msg: '登录态失效'
							})
							// 小程序上重新登录
						}
					} catch (err) {
						res.json({
							success: false,
							msg: '解析session出错',
							errmsg: err
						})
					}
				} else {
					getSessionThrMp(res, code)
				}
			}
		})
	} else {
		getSessionThrMp(res, code)
	}
});

function getSessionThrMp (res, code) {
	axios({
		url: 'https://api.weixin.qq.com/sns/jscode2session',
		method: 'get',
		params: {
			appid: appId,
			secret: appSecret,
			js_code: code,
			grant_type: 'authorization_code'
		}
	})
		.then(response => {
			console.log(response.data)
			if (response.data.openid) {
				exec('head -n 80 /dev/urandom | LC_ALL=C tr -dc A-Za-z0-9 | head -c 168', function(err,stdout,stderr){
					if (err) {
						console.log('get union string err, message: ' + err)
						return
					}
					// 放入redis并设置过期时间
					client.set(stdout, JSON.stringify({
						openid: response.data.openid,
						session_key: response.data.session_key
					}))
					client.expire(stdout, 7200)
					res.json({
						success: true,
						session: stdout,
						msg: '登录成功'
					})
				})
			} else {
				res.json({
					success: false,
					errmsg: response.data.errmsg,
					errcode: response.data.errcode
				})
				return
			}
		})
		.catch(err => {
			console.log(err)
			res.json({
				success: false,
				err: err
			})
		})
}

module.exports = router;
