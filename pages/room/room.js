const cloud = require('../../utils/cloud.js')

Page({
  data: {
    roomId: '',
    joinRoomId: '',
    room: null,
    isHost: false,
    myOpenid: '',
    amIReady: false,
    myImageUrl: '',
    allReady: false
  },

  watcher: null,
  hasNavigatedToGame: false,

  onLoad(options) {
    if (options.roomId) {
      this.joinExistingRoom(options.roomId)
    }
  },

  onUnload() {
    if (this.watcher) {
      this.watcher.close()
    }
  },

  onShow() {
    this.hasNavigatedToGame = false
  },

  // ========== 创建房间 ==========

  async createRoom() {
    try {
      const openidRes = await cloud.callFunction({ name: 'getOpenid' })
      const openid = openidRes.result.openid

      const user = wx.getStorageSync('__user_info__') || {}
      const nickName = user.nickName || '房主'

      const res = await cloud.callFunction({
        name: 'createRoom',
        data: { nickName, avatarUrl: user.avatarUrl || '' }
      })

      if (res.result.success) {
        this.setData({
          roomId: res.result.roomId,
          room: res.result.room,
          isHost: true,
          myOpenid: openid,
          amIReady: false,
          myImageUrl: ''
        })
        this.startWatchingRoom()
        wx.showToast({ title: '房间已创建', icon: 'success' })
      }
    } catch (err) {
      console.error('创建房间失败', err)
      wx.showToast({ title: '创建失败', icon: 'none' })
    }
  },

  // ========== 加入房间 ==========

  async joinRoom() {
    const roomId = this.data.joinRoomId.trim()
    if (roomId.length !== 6) {
      wx.showToast({ title: '请输入6位房间号', icon: 'none' })
      return
    }
    await this.joinExistingRoom(roomId.toUpperCase())
  },

  async joinExistingRoom(roomId) {
    try {
      const openidRes = await cloud.callFunction({ name: 'getOpenid' })
      const openid = openidRes.result.openid

      const user = wx.getStorageSync('__user_info__') || {}

      const res = await cloud.callFunction({
        name: 'joinRoom',
        data: {
          roomId,
          nickName: user.nickName || '玩家',
          avatarUrl: user.avatarUrl || ''
        }
      })

      if (res.result.success) {
        const room = res.result.room
        const me = room.players.find(p => p.openid === openid)
        this.setData({
          roomId,
          room,
          joinRoomId: '',
          isHost: room.hostOpenid === openid,
          myOpenid: openid,
          amIReady: me ? me.ready : false,
          myImageUrl: me ? me.imageUrl : ''
        })
        this.startWatchingRoom()
        wx.showToast({ title: '已加入房间', icon: 'success' })
      } else {
        wx.showToast({ title: res.result.error || '加入失败', icon: 'none' })
      }
    } catch (err) {
      console.error('加入房间失败', err)
      wx.showToast({ title: '加入失败', icon: 'none' })
    }
  },

  // ========== 离开房间 ==========

  async leaveRoom() {
    try {
      await cloud.callFunction({
        name: 'leaveRoom',
        data: { roomId: this.data.roomId }
      })
    } catch (err) {
      console.error('离开房间失败', err)
    }

    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }

    this.setData({
      roomId: '',
      room: null,
      isHost: false,
      myOpenid: '',
      amIReady: false,
      myImageUrl: '',
      allReady: false
    })
  },

  // ========== 上传图片 ==========

  uploadMyImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0]
        this.setData({ myImageUrl: tempFilePath })
        this.sendReadyStatus()
        wx.showToast({ title: '图片已选择', icon: 'success' })
      }
    })
  },

  // ========== 准备/取消准备 ==========

  toggleReady() {
    if (!this.data.myImageUrl) {
      wx.showToast({ title: '请先上传图片', icon: 'none' })
      return
    }
    this.setData({ amIReady: !this.data.amIReady })
    this.sendReadyStatus()
  },

  async sendReadyStatus() {
    try {
      const res = await cloud.callFunction({
        name: 'ready',
        data: {
          roomId: this.data.roomId,
          ready: this.data.amIReady,
          imageUrl: this.data.myImageUrl
        }
      })
      if (res.result.success) {
        this.setData({ room: res.result.room })
      }
    } catch (err) {
      console.error('更新准备状态失败', err)
    }
  },

  // ========== 开始游戏 ==========

  async startGame() {
    try {
      const res = await cloud.callFunction({
        name: 'startGame',
        data: { roomId: this.data.roomId }
      })

      if (res.result.success) {
        wx.showToast({ title: '游戏开始!', icon: 'success' })
      } else {
        wx.showToast({ title: res.result.error || '无法开始', icon: 'none' })
      }
    } catch (err) {
      console.error('开始游戏失败', err)
      wx.showToast({ title: '开始失败', icon: 'none' })
    }
  },

  // ========== 进入当前对局 ==========

  joinCurrentRound() {
    if (this.hasNavigatedToGame) return
    const room = this.data.room
    const currentRound = room.currentRound || 0
    wx.navigateTo({
      url: `/pages/puzzle/puzzle?roomId=${room.roomId}&round=${currentRound}&totalRounds=${room.maxRounds}&image=${encodeURIComponent(room.images[currentRound].url)}&difficulty=medium`
    })
  },

  // ========== 查看结果 ==========

  viewResult() {
    wx.navigateTo({
      url: `/pages/puzzle/puzzle?roomId=${this.data.roomId}&mode=result`
    })
  },

  // ========== 新建房间 ==========

  createNewRoom() {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
    this.setData({
      roomId: '',
      room: null,
      isHost: false,
      myOpenid: '',
      amIReady: false,
      myImageUrl: '',
      allReady: false
    })
  },

  // ========== 输入房间号 ==========

  onJoinRoomIdInput(e) {
    this.setData({ joinRoomId: e.detail.value.toUpperCase() })
  },

  // ========== 轮询监听房间变化 ==========

  startWatchingRoom() {
    const db = cloud.database()
    const roomId = this.data.roomId

    if (this.watcher) {
      this.watcher.close()
    }

    this.watcher = db.collection('rooms')
      .where({ roomId })
      .watch({
        onChange: (snapshot) => {
          if (snapshot.docs.length > 0) {
            const room = snapshot.docs[0]
            const myOpenid = this.data.myOpenid
            const me = room.players.find(p => p.openid === myOpenid)

            const allReady = room.players.length >= 2 && room.players.every(p => p.ready)

            this.setData({
              room,
              isHost: room.hostOpenid === myOpenid,
              amIReady: me ? me.ready : false,
              myImageUrl: me ? me.imageUrl : '',
              allReady
            })

            // 游戏状态变化 — 跳转 puzzle 页
            if (room.status === 'playing' && !this.hasNavigatedToGame) {
              const currentRound = room.currentRound || 0
              const roundScore = room.roundScores && room.roundScores[currentRound]
              if (!roundScore || !roundScore.scores) {
                this.hasNavigatedToGame = true
                wx.navigateTo({
                  url: `/pages/puzzle/puzzle?roomId=${room.roomId}&round=${currentRound}&totalRounds=${room.maxRounds}&image=${encodeURIComponent(room.images[currentRound].url)}&difficulty=medium`
                })
                return
              }

              const myScore = roundScore.scores.find(s => s.openid === myOpenid)
              if (!myScore) {
                this.hasNavigatedToGame = true
                wx.navigateTo({
                  url: `/pages/puzzle/puzzle?roomId=${room.roomId}&round=${currentRound}&totalRounds=${room.maxRounds}&image=${encodeURIComponent(room.images[currentRound].url)}&difficulty=medium`
                })
              }
            }
          }
        },
        onError: (err) => {
          console.error('房间监听失败', err)
        }
      })
  },

  goHome() {
    if (this.watcher) {
      this.watcher.close()
    }
    wx.reLaunch({ url: '/pages/index/index' })
  }
})
