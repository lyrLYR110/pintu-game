const cloud = require('./utils/cloud.js')

App({
  onLaunch() {
    console.log('小程序启动')
    // 初始化本地云模拟层
    cloud.init()
  },
  onShow() {
    console.log('小程序显示')
  },
  onHide() {
    console.log('小程序隐藏')
  },
  globalData: {
    userInfo: null,
    isLoggedIn: false
  }
})
