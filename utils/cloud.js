/**
 * utils/cloud.js — 本地化云能力模拟层
 * 
 * 将微信云开发 API (callFunction, database 等) 透明代理到 wx.setStorageSync，
 * 房间监听用 setInterval 轮询模拟。
 * 
 * 日后切换真实云开发只需替换本文件实现。
 */

const CLOUD_STORAGE_PREFIX = '__cloud__'
const WATCH_INTERVAL = 500 // 轮询间隔 ms

// ========== 工具函数 ==========

function storageKey(key) {
  return CLOUD_STORAGE_PREFIX + key
}

function readCollection(name) {
  try {
    const raw = wx.getStorageSync(storageKey('collection_' + name))
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

function writeCollection(name, data) {
  wx.setStorageSync(storageKey('collection_' + name), JSON.stringify(data))
}

function generateId() {
  return 'local_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9)
}

function serverDate() {
  return { $date: new Date().toISOString() }
}

function parseServerDate(val) {
  if (val && val.$date) return new Date(val.$date)
  return new Date(val)
}

// ========== Database 模拟 ==========

class Collection {
  constructor(name) {
    this._name = name
    this._filters = []
    this._orderField = null
    this._orderDir = 'asc'
    this._limitVal = 20
    this._skipVal = 0
  }

  where(conditions) {
    this._filters.push(conditions)
    return this
  }

  orderBy(field, dir) {
    this._orderField = field
    this._orderDir = dir || 'asc'
    return this
  }

  limit(val) {
    this._limitVal = val
    return this
  }

  skip(val) {
    this._skipVal = val
    return this
  }

  _match(doc, conditions) {
    for (const key in conditions) {
      const cond = conditions[key]
      if (cond && typeof cond === 'object' && '_in' in cond) {
        if (!cond._in.includes(doc[key])) return false
      } else if (cond && typeof cond === 'object' && '_neq' in cond) {
        if (doc[key] === cond._neq) return false
      } else if (cond && typeof cond === 'object' && '_exists' in cond) {
        const exists = key in doc
        if (cond._exists !== exists) return false
      } else if (cond && typeof cond === 'object' && '_gt' in cond) {
        if (!(doc[key] > cond._gt)) return false
      } else if (cond && typeof cond === 'object' && '_gte' in cond) {
        if (!(doc[key] >= cond._gte)) return false
      } else if (cond && typeof cond === 'object' && '_lt' in cond) {
        if (!(doc[key] < cond._lt)) return false
      } else if (cond && typeof cond === 'object' && '_lte' in cond) {
        if (!(doc[key] <= cond._lte)) return false
      } else {
        if (doc[key] !== cond) return false
      }
    }
    return true
  }

  async get() {
    let data = readCollection(this._name)
    for (const filter of this._filters) {
      data = data.filter(doc => this._match(doc, filter))
    }
    if (this._orderField) {
      data.sort((a, b) => {
        const va = a[this._orderField], vb = b[this._orderField]
        if (va < vb) return this._orderDir === 'desc' ? 1 : -1
        if (va > vb) return this._orderDir === 'desc' ? -1 : 1
        return 0
      })
    }
    const total = data.length
    data = data.slice(this._skipVal, this._skipVal + this._limitVal)
    return { data, errMsg: 'collection.get:ok' }
  }

  async count() {
    let data = readCollection(this._name)
    for (const filter of this._filters) {
      data = data.filter(doc => this._match(doc, filter))
    }
    return { total: data.length, errMsg: 'collection.count:ok' }
  }

  async add(options) {
    const data = options.data || options
    const doc = {
      _id: generateId(),
      ...data,
      _createTime: serverDate(),
      _updateTime: serverDate()
    }
    const coll = readCollection(this._name)
    coll.push(doc)
    writeCollection(this._name, coll)
    this._triggerWatch('add', doc)
    return { _id: doc._id, errMsg: 'collection.add:ok' }
  }

  async doc(id) {
    const coll = readCollection(this._name)
    const doc = coll.find(d => d._id === id)
    return {
      _id: id,
      get: async () => {
        const coll2 = readCollection(this._name)
        const found = coll2.find(d => d._id === id)
        return { data: found ? [found] : [], errMsg: 'document.get:ok' }
      },
      update: async (options) => {
        const coll2 = readCollection(this._name)
        const idx = coll2.findIndex(d => d._id === id)
        if (idx !== -1) {
          const updateData = options.data || {}
          coll2[idx] = { ...coll2[idx], ...updateData, _updateTime: serverDate() }
          writeCollection(this._name, coll2)
          this._triggerWatch('update', coll2[idx])
          return { stats: { updated: 1 }, errMsg: 'document.update:ok' }
        }
        return { stats: { updated: 0 }, errMsg: 'document.update:ok' }
      },
      remove: async () => {
        const coll2 = readCollection(this._name)
        const idx = coll2.findIndex(d => d._id === id)
        if (idx !== -1) {
          const removed = coll2.splice(idx, 1)[0]
          writeCollection(this._name, coll2)
          this._triggerWatch('remove', removed)
          return { stats: { removed: 1 }, errMsg: 'document.remove:ok' }
        }
        return { stats: { removed: 0 }, errMsg: 'document.remove:ok' }
      }
    }
  }

  watch(options) {
    const { onChange, onError } = options || {}
    let lastSnapshot = [...readCollection(this._name)]
    const watcherId = generateId()

    if (!Collection._watchers) Collection._watchers = {}
    if (!Collection._watchers[this._name]) Collection._watchers[this._name] = []
    Collection._watchers[this._name].push({ id: watcherId, onChange, onError, lastSnapshot })

    if (!Collection._watchTimer) {
      Collection._watchTimer = setInterval(() => {
        for (const collName in Collection._watchers) {
          const watchers = Collection._watchers[collName]
          const currentData = readCollection(collName)
          watchers.forEach(w => {
            const prevJson = JSON.stringify(w.lastSnapshot)
            const currJson = JSON.stringify(currentData)
            if (prevJson !== currJson) {
              w.lastSnapshot = [...currentData]
              try {
                w.onChange && w.onChange({ docs: currentData, type: 'change' })
              } catch (e) {
                w.onError && w.onError(e)
              }
            }
          })
        }
      }, WATCH_INTERVAL)
    }

    return {
      close: () => {
        if (Collection._watchers && Collection._watchers[this._name]) {
          Collection._watchers[this._name] = Collection._watchers[this._name].filter(w => w.id !== watcherId)
          if (Collection._watchers[this._name].length === 0) {
            delete Collection._watchers[this._name]
          }
        }
      }
    }
  }

  _triggerWatch(type, doc) {
    if (!Collection._watchers || !Collection._watchers[this._name]) return
  }
}

class Database {
  collection(name) {
    return new Collection(name)
  }

  command() {
    return {
      in: (arr) => ({ _in: arr }),
      neq: (val) => ({ _neq: val }),
      exists: (val) => ({ _exists: val }),
      gt: (val) => ({ _gt: val }),
      gte: (val) => ({ _gte: val }),
      lt: (val) => ({ _lt: val }),
      lte: (val) => ({ _lte: val })
    }
  }

  Geo() {
    return {
      Point: (lon, lat) => ({ longitude: lon, latitude: lat })
    }
  }

  RegExp(opts) {
    return { regexp: opts.regexp || opts, options: opts.options || '' }
  }
}

// ========== 云函数模拟 ==========

const CLOUD_FUNCTIONS = {
  // 房间管理
  createRoom: async (data, context) => {
    const db = new Database()
    const rooms = db.collection('rooms')
    const roomId = generateRoomId()

    const room = {
      roomId,
      hostOpenid: context.OPENID || 'local_user',
      status: 'waiting', // waiting | playing | finished
      currentRound: 0,
      maxRounds: 0,
      players: [{
        openid: context.OPENID || 'local_user',
        nickName: data.nickName || '房主',
        avatarUrl: data.avatarUrl || '',
        ready: false,
        imageUrl: ''
      }],
      images: [],
      roundScores: [],
      createTime: serverDate(),
      updateTime: serverDate()
    }

    await rooms.add({ data: room })
    return { success: true, roomId, room }
  },

  joinRoom: async (data, context) => {
    const db = new Database()
    const rooms = db.collection('rooms')
    const res = await rooms.where({ roomId: data.roomId }).get()

    if (res.data.length === 0) {
      return { success: false, error: '房间不存在' }
    }

    const room = res.data[0]
    if (room.status !== 'waiting') {
      return { success: false, error: '房间已开始游戏' }
    }

    const openid = context.OPENID || 'local_user_' + Date.now()
    const exists = room.players.find(p => p.openid === openid)
    if (!exists) {
      room.players.push({
        openid,
        nickName: data.nickName || '玩家',
        avatarUrl: data.avatarUrl || '',
        ready: false,
        imageUrl: ''
      })
    }

    await rooms.doc(room._id).update({ data: { players: room.players, updateTime: serverDate() } })
    return { success: true, room: { ...room } }
  },

  leaveRoom: async (data, context) => {
    const db = new Database()
    const rooms = db.collection('rooms')
    const res = await rooms.where({ roomId: data.roomId }).get()

    if (res.data.length === 0) {
      return { success: false, error: '房间不存在' }
    }

    const room = res.data[0]
    const openid = context.OPENID || 'local_user'
    room.players = room.players.filter(p => p.openid !== openid)

    if (room.players.length === 0) {
      await rooms.doc(room._id).remove()
      return { success: true, roomDeleted: true }
    }

    // 如果房主离开，转移房主
    if (room.hostOpenid === openid && room.players.length > 0) {
      room.hostOpenid = room.players[0].openid
    }

    await rooms.doc(room._id).update({ data: { players: room.players, hostOpenid: room.hostOpenid, updateTime: serverDate() } })
    return { success: true, room: { ...room } }
  },

  getRoom: async (data, context) => {
    const db = new Database()
    const rooms = db.collection('rooms')
    const res = await rooms.where({ roomId: data.roomId }).get()

    if (res.data.length === 0) {
      return { success: false, error: '房间不存在' }
    }

    return { success: true, room: res.data[0] }
  },

  // 准备
  ready: async (data, context) => {
    const db = new Database()
    const rooms = db.collection('rooms')
    const res = await rooms.where({ roomId: data.roomId }).get()

    if (res.data.length === 0) {
      return { success: false, error: '房间不存在' }
    }

    const room = res.data[0]
    const openid = context.OPENID || 'local_user'
    const player = room.players.find(p => p.openid === openid)

    if (!player) {
      return { success: false, error: '你不在该房间内' }
    }

    player.ready = data.ready !== false
    player.imageUrl = data.imageUrl || player.imageUrl

    await rooms.doc(room._id).update({ data: { players: room.players, updateTime: serverDate() } })
    return { success: true, room: { ...room } }
  },

  // 开始游戏
  startGame: async (data, context) => {
    const db = new Database()
    const rooms = db.collection('rooms')
    const res = await rooms.where({ roomId: data.roomId }).get()

    if (res.data.length === 0) {
      return { success: false, error: '房间不存在' }
    }

    const room = res.data[0]
    if (room.players.length < 2) {
      return { success: false, error: '至少需要2名玩家' }
    }

    const allReady = room.players.every(p => p.ready)
    if (!allReady) {
      return { success: false, error: '还有玩家未准备' }
    }

    // 收集所有玩家的图片作为对局图片池
    const images = room.players.map(p => ({
      openid: p.openid,
      url: p.imageUrl || 'https://picsum.photos/id/1/600/600'
    }))

    room.status = 'playing'
    room.currentRound = 0
    room.maxRounds = images.length
    room.images = images
    room.roundScores = []
    room.startTime = serverDate()

    await rooms.doc(room._id).update({
      data: {
        status: room.status,
        currentRound: room.currentRound,
        maxRounds: room.maxRounds,
        images: room.images,
        roundScores: room.roundScores,
        startTime: room.startTime,
        updateTime: serverDate()
      }
    })

    return { success: true, room: { ...room } }
  },

  // 提交分数
  submitScore: async (data, context) => {
    const db = new Database()
    const rooms = db.collection('rooms')
    const res = await rooms.where({ roomId: data.roomId }).get()

    if (res.data.length === 0) {
      return { success: false, error: '房间不存在' }
    }

    const room = res.data[0]
    const openid = context.OPENID || 'local_user'
    const currentRound = room.currentRound || 0

    if (!room.roundScores[currentRound]) {
      room.roundScores[currentRound] = { scores: [] }
    }

    // 检查是否已提交
    const existing = room.roundScores[currentRound].scores.find(s => s.openid === openid)
    if (!existing) {
      room.roundScores[currentRound].scores.push({
        openid,
        time: data.time || 0,
        nickName: data.nickName || '',
        submitTime: serverDate()
      })
    }

    const allFinished = room.players.every(p => {
      return room.roundScores[currentRound].scores.find(s => s.openid === p.openid)
    })

    await rooms.doc(room._id).update({
      data: { roundScores: room.roundScores, updateTime: serverDate() }
    })

    return { success: true, allFinished, room: { ...room } }
  },

  // 下一轮
  nextRound: async (data, context) => {
    const db = new Database()
    const rooms = db.collection('rooms')
    const res = await rooms.where({ roomId: data.roomId }).get()

    if (res.data.length === 0) {
      return { success: false, error: '房间不存在' }
    }

    const room = res.data[0]
    room.currentRound = (room.currentRound || 0) + 1

    let finished = false
    if (room.currentRound >= room.maxRounds) {
      room.status = 'finished'
      room.finishTime = serverDate()
      finished = true
    }

    await rooms.doc(room._id).update({
      data: {
        currentRound: room.currentRound,
        status: room.status,
        finishTime: room.finishTime,
        updateTime: serverDate()
      }
    })

    return { success: true, finished, room: { ...room } }
  },

  // 登录/获取 openid
  login: async (data, context) => {
    // 本地模式下模拟 openid
    let openid = wx.getStorageSync('__local_openid__')
    if (!openid) {
      openid = 'local_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6)
      wx.setStorageSync('__local_openid__', openid)
    }

    const db = new Database()
    const users = db.collection('users')
    const userRes = await users.where({ openid }).get()

    let user
    if (userRes.data.length === 0) {
      const newUser = {
        openid,
        nickName: data.nickName || '用户',
        avatarUrl: data.avatarUrl || '',
        bestRecords: [],
        favoriteImages: [],
        createTime: serverDate(),
        updateTime: serverDate()
      }
      const addRes = await users.add({ data: newUser })
      newUser._id = addRes._id
      user = newUser
    } else {
      user = userRes.data[0]
    }

    return { success: true, openid, user }
  },

  getOpenid: async (data, context) => {
    let openid = wx.getStorageSync('__local_openid__')
    if (!openid) {
      openid = 'local_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6)
      wx.setStorageSync('__local_openid__', openid)
    }
    return { openid }
  },

  uploadFavoriteImage: async (data, context) => {
    const db = new Database()
    const users = db.collection('users')
    const openid = context.OPENID || wx.getStorageSync('__local_openid__')
    const userRes = await users.where({ openid }).get()

    if (userRes.data.length === 0) {
      return { success: false, error: '用户不存在，请先登录' }
    }

    const user = userRes.data[0]
    const favoriteImages = user.favoriteImages || []

    favoriteImages.push({
      imageUrl: data.imageUrl,
      fileID: data.imageUrl, // 本地模式下一致
      name: data.name || '收藏图片',
      createTime: serverDate()
    })

    await users.doc(user._id).update({ data: { favoriteImages, updateTime: serverDate() } })
    return { success: true, favoriteImages }
  }
}

// 生成6位字母房间号
function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'
  let id = ''
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  // 检查是否已存在
  const rooms = readCollection('rooms')
  const existing = rooms.some(r => r.roomId === id)
  if (existing) return generateRoomId()
  return id
}

// ========== 导出 API ==========

module.exports = {
  /**
   * 调用云函数
   * @param {Object} options - { name, data }
   * @returns {Promise<{result}>}
   */
  callFunction(options) {
    return new Promise((resolve, reject) => {
      const { name, data } = options
      const context = {
        OPENID: wx.getStorageSync('__local_openid__') || 'local_user',
        ENV: 'local-env',
        APPID: 'local-appid'
      }

      const fn = CLOUD_FUNCTIONS[name]
      if (!fn) {
        reject(new Error(`云函数 ${name} 未定义`))
        return
      }

      fn(data || {}, context)
        .then(result => resolve({ result, requestID: 'local_' + Date.now() }))
        .catch(err => reject(err))
    })
  },

  /**
   * 获取数据库实例
   * @returns {Database}
   */
  database() {
    return new Database()
  },

  /**
   * 服务器时间
   * @returns {{$date: string}}
   */
  serverDate,

  /**
   * 上传文件
   * 本地模式下将文件复制到临时存储并返回路径
   */
  uploadFile(options) {
    return new Promise((resolve, reject) => {
      const { cloudPath, filePath } = options
      // 本地模式：直接记录文件路径映射
      const fileMap = wx.getStorageSync(storageKey('files')) || {}
      const fileID = 'cloud://local/' + (cloudPath || filePath.replace(/[\\/]/g, '_'))
      fileMap[fileID] = filePath
      wx.setStorageSync(storageKey('files'), JSON.stringify(fileMap))

      resolve({
        fileID,
        statusCode: 200,
        errMsg: 'cloud.uploadFile:ok'
      })
    })
  },

  /**
   * 下载文件
   */
  downloadFile(options) {
    return new Promise((resolve, reject) => {
      const { fileID } = options
      const fileMap = wx.getStorageSync(storageKey('files')) || {}
      const tempFilePath = fileMap[fileID] || fileID

      resolve({
        tempFilePath,
        statusCode: 200,
        errMsg: 'cloud.downloadFile:ok'
      })
    })
  },

  /**
   * 获取临时文件链接
   */
  getTempFileURL(options) {
    return new Promise((resolve, reject) => {
      const { fileList } = options
      const result = fileList.map(id => ({
        fileID: id,
        tempFileURL: id,
        status: 0,
        errMsg: 'ok'
      }))
      resolve({ fileList: result, errMsg: 'cloud.getTempFileURL:ok' })
    })
  },

  /**
   * 删除文件
   */
  deleteFile(options) {
    return new Promise((resolve) => {
      const fileMap = wx.getStorageSync(storageKey('files')) || {}
      ;(options.fileList || []).forEach(id => {
        delete fileMap[id]
      })
      wx.setStorageSync(storageKey('files'), JSON.stringify(fileMap))
      resolve({ fileList: (options.fileList || []).map(id => ({ fileID: id, status: 0 })) })
    })
  },

  /**
   * 初始化 (本地模式下为空操作)
   */
  init(options) {
    console.log('[cloud.js] 本地化云能力已就绪')
    return Promise.resolve()
  },

  // 暴露内部工具供云函数使用
  _internal: {
    readCollection,
    writeCollection,
    generateId,
    storageKey,
    CLOUD_FUNCTIONS
  }
}
