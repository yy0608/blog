var mongoose = require('mongoose');

module.exports = new mongoose.Schema({
  value: {
    type: String,
    required: true,
    unique: true
  },
  label: {
    type: String,
    required: true,
    unique: true
  },
  children: {
    type: [],
    default: []
  }
  // children: {
  //   type: String,
  //   unique: true
  // }
  // 例如：
  // [
  //   {
  //     id: '',
  //     value: '',
  //     children: [
  //       {
  //         id: '',
  //         value: '',
  //         children: [
  //           {
  //             id: '',
  //             value: '',
  //             logo: ''
  //           },
  //           {
  //             id: '',
  //             value: '',
  //             logo: ''
  //           }
  //         ]
  //       }
  //     ]
  //   }
  // ]
}, {
  versionKey: false // 去掉__v字段
})
