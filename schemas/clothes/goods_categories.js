var mongoose = require('mongoose');

module.exports = new mongoose.Schema({
  value: {
    type: String,
    required: true,
    unique: true
  },
  children: {
    type: [],
    required: true,
    unique: true
  }
  // 例如：
  // [
  //   {
  //     _id: '',
  //     value: '',
  //     children: [
  //       {
  //         sec_id: '',
  //         value: '',
  //         children: [
  //           {
  //             thrd_id: '',
  //             value: '',
  //             logo: ''
  //           },
  //           {
  //             thrd_id: '',
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
