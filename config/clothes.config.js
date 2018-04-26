module.exports = {
  pageLimit: 10,
  passwordKey: {
    left: '开门大吉--',
    right: '--万事如意'
  },
  redisPrefix: {
    merchantAdd: 'merchant-add-',
    register: 'register-'
  },
  smsConfig: {
    smsSign: '饭千金', // 签名
    appid: 1400070556,
    appkey: '32cf6a39ef9c100f8d1b68d835b1e995',
    templateId: 90192, // 模板ID
    smsType: 0 // Enum{0: 普通短信, 1: 营销短信}
  },
  qiniuConfig: {
    default_bucket: 'wusuowei',
    imgOrigin: 'http://img.wsweat.cn/',
    shopLogoDirname: 'clothes/shop/logo/',
    categoryIconDirname: 'clothes/category/icon/',
    goodsCoverDirname: 'clothes/goods/cover/',
    goodsFigureDirname: 'clothes/goods/figure/',
    goodsDetailDirname: 'clothes/goods/detail/',
    topicDirname: 'clothes/topic/',
    uploadUrl: 'https://upload-z2.qiniup.com', // 华南地址
    access_key: 'QimXTd2UT59EgNfZuEJ2_27gEwHRCSmw5sW_sO9u',
    secret_key: 'wOQyg5FpX8OFsyRsnQRtHteoqMPSEwWbatY99IaO'
  }
};
