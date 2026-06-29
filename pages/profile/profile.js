const cloud = require('../../utils/cloud.js')

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    favoriteImages: [],
    records: []
  },

  onLoad() {
    this.checkLoginStatus()
  },

  onShow() {
    this.loadUserData()
  },

  // ========== 登录 ==========

  checkLoginStatus() {
    const userInfo = wx.getStorageSync('__user_info__')
    const app = getApp()
    if (userInfo) {
      this.setData({ isLoggedIn: true, userInfo })
      app.globalData.isLoggedIn = true
      app.globalData.userInfo = userInfo
    }
  },

  async handleLogin() {
    try {
      const settingRes = await wx.getSetting()
      if (!settingRes.authSetting['scope.userInfo']) {
        const userInfoRes = await wx.getUserProfile({
          desc: '用于完善个人资料'
        })
        const userInfo = userInfoRes.userInfo

        const res = await cloud.callFunction({
          name: 'login',
          data: {
            nickName: userInfo.nickName,
            avatarUrl: userInfo.avatarUrl
          }
        })

        if (res.result.success) {
          wx.setStorageSync('__user_info__', userInfo)
          const app = getApp()
          app.globalData.isLoggedIn = true
          app.globalData.userInfo = userInfo
          this.setData({ isLoggedIn: true, userInfo })
          wx.showToast({ title: '登录成功', icon: 'success' })
        }
      }
    } catch (err) {
      console.error('登录失败', err)
      wx.showToast({ title: '登录失败', icon: 'none' })
    }
  },

  // ========== 加载用户数据 ==========

  async loadUserData() {
    if (!this.data.isLoggedIn) return

    try {
      const openidRes = await cloud.callFunction({ name: 'getOpenid' })
      const openid = openidRes.result.openid
      const db = cloud.database()

      const userRes = await db.collection('users').where({ openid }).get()
      if (userRes.data.length === 0) return

      const user = userRes.data[0]

      this.setData({
        favoriteImages: user.favoriteImages || [],
        records: this.processRecords(user.bestRecords || [])
      })
    } catch (err) {
      console.error('加载用户数据失败', err)
    }
  },

  processRecords(bestRecords) {
    // 按图片+难度去重，保留最快时间
    const seen = new Map()
    const processed = []

    bestRecords.forEach(record => {
      const key = `${record.imageUrl}_${record.difficulty}`
      const existing = seen.get(key)
      if (!existing || record.bestTime < existing.bestTime) {
        seen.set(key, {
          imageUrl: record.imageUrl,
          difficulty: record.difficulty,
          bestTime: record.bestTime
        })
      }
    })

    seen.forEach((value) => processed.push(value))
    return processed.sort((a, b) => a.bestTime - b.bestTime)
  },

  // ========== 上传收藏图片 ==========

  async uploadFavorite() {
    try {
      const res = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album']
      })

      const tempFilePath = res.tempFilePaths[0]

      const uploadRes = await cloud.callFunction({
        name: 'uploadFavoriteImage',
        data: {
          imageUrl: tempFilePath,
          name: '收藏图片'
        }
      })

      if (uploadRes.result.success) {
        this.setData({ favoriteImages: uploadRes.result.favoriteImages })
        wx.showToast({ title: '上传成功', icon: 'success' })
      }
    } catch (err) {
      console.error('上传收藏图片失败', err)
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
  },

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  }
})
