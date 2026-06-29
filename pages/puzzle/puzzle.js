const app = getApp()
const cloud = require('../../utils/cloud.js')

Page({
  data: {
    selectedImage: '',
    selectedDifficulty: 'medium',
    gameStarted: false,
    showMemory: false,
    memoryCountdown: 5,
    showWin: false,
    showRoundResult: false,
    showFinalResult: false,
    timer: 0,
    finalTime: 0,
    pieces: [],
    gridSize: 4,
    pieceSize: 0,
    selectedPiece: null,
    firstSelected: null,
    showRotateControls: false,
    correctCount: 0,
    totalPieces: 0,
    winResult: null,
    finalRankings: [],
    roomId: '',
    roundIndex: 0,
    totalRounds: 0,
    isMultiplayer: false
  },

  timerInterval: null,
  watcher: null,

  onLoad(options) {
    if (options.mode === 'result') {
      this.loadFinalResult(options.roomId)
      return
    }

    const image = options.image || 'https://picsum.photos/id/1/600/600'
    const difficulty = options.difficulty || 'medium'
    const roomId = options.roomId || ''
    const round = parseInt(options.round) || 0
    const totalRounds = parseInt(options.totalRounds) || 1

    this.setData({
      selectedImage: decodeURIComponent(image),
      selectedDifficulty: difficulty,
      roomId,
      roundIndex: round,
      totalRounds,
      isMultiplayer: !!roomId
    })

    this.startGame()
  },

  onUnload() {
    this.stopTimer()
    if (this.watcher) {
      this.watcher.close()
    }
  },

  startGame() {
    const gridSize = this.data.selectedDifficulty === 'easy' ? 3 : this.data.selectedDifficulty === 'medium' ? 4 : 5
    const pieceSize = 600 / gridSize

    this.setData({
      gameStarted: true,
      showMemory: true,
      memoryCountdown: 5,
      gridSize: gridSize,
      pieceSize: pieceSize,
      timer: 0,
      showWin: false,
      showRoundResult: false,
      selectedPiece: null,
      firstSelected: null,
      correctCount: 0,
      totalPieces: gridSize * gridSize
    })

    this.startMemoryCountdown()
    this.initPieces()
  },

  startMemoryCountdown() {
    let count = 5
    const countdown = setInterval(() => {
      count--
      this.setData({ memoryCountdown: count })
      if (count <= 0) {
        clearInterval(countdown)
        this.setData({
          showMemory: false,
          showRotateControls: true
        })
        this.startTimer()
        this.shufflePieces()
      }
    }, 1000)
  },

  initPieces() {
    const { gridSize } = this.data
    const pieces = []
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        pieces.push({
          id: `${x}-${y}`,
          x: x,
          y: y,
          correctX: x,
          correctY: y,
          rotation: 0,
          isCorrect: false
        })
      }
    }
    this.setData({ pieces })
  },

  shufflePieces() {
    const { pieces, gridSize } = this.data
    const shuffled = [...pieces]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const rotations = [0, 90, 180, 270]
    const newPieces = shuffled.map((piece, index) => ({
      ...piece,
      x: Math.floor(index / gridSize),
      y: index % gridSize,
      rotation: rotations[Math.floor(Math.random() * rotations.length)],
      isCorrect: false
    }))
    this.setData({ pieces: newPieces })
    this.checkCorrectPieces()
  },

  selectPiece(e) {
    const id = e.currentTarget.dataset.id
    const piece = this.data.pieces.find(p => p.id === id)
    if (!piece || piece.isCorrect) return

    if (this.data.firstSelected === null) {
      this.setData({ firstSelected: piece, selectedPiece: piece })
    } else if (this.data.firstSelected.id === id) {
      this.setData({ firstSelected: null, selectedPiece: null })
    } else {
      this.swapPieces(this.data.firstSelected, piece)
    }
  },

  swapPieces(piece1, piece2) {
    const pieces = [...this.data.pieces]
    const idx1 = pieces.findIndex(p => p.id === piece1.id)
    const idx2 = pieces.findIndex(p => p.id === piece2.id)
    const tempX = pieces[idx1].x
    const tempY = pieces[idx1].y
    pieces[idx1].x = pieces[idx2].x
    pieces[idx1].y = pieces[idx2].y
    pieces[idx2].x = tempX
    pieces[idx2].y = tempY
    this.setData({ pieces, firstSelected: null, selectedPiece: null })
    setTimeout(() => this.checkCorrectPieces(), 100)
  },

  rotatePieceLeft() {
    if (!this.data.selectedPiece || this.data.selectedPiece.isCorrect) return
    this.rotatePiece(this.data.selectedPiece, -90)
  },

  rotatePieceRight() {
    if (!this.data.selectedPiece || this.data.selectedPiece.isCorrect) return
    this.rotatePiece(this.data.selectedPiece, 90)
  },

  rotatePiece(piece, angle) {
    const pieces = [...this.data.pieces]
    const idx = pieces.findIndex(p => p.id === piece.id)
    let newRotation = (pieces[idx].rotation + angle) % 360
    if (newRotation < 0) newRotation += 360
    pieces[idx].rotation = newRotation
    this.setData({ pieces, selectedPiece: { ...pieces[idx] } })
    setTimeout(() => this.checkCorrectPieces(), 100)
  },

  checkCorrectPieces() {
    const { pieces, gridSize } = this.data
    let correctCount = 0
    const updatedPieces = pieces.map(piece => {
      const isPositionCorrect = piece.x === piece.correctX && piece.y === piece.correctY
      const isRotationCorrect = piece.rotation === 0
      const isCorrect = isPositionCorrect && isRotationCorrect
      if (isCorrect) correctCount++
      return { ...piece, isCorrect }
    })
    this.setData({ pieces: updatedPieces, correctCount })
    if (correctCount === gridSize * gridSize) {
      this.winGame()
    }
  },

  startTimer() {
    this.timerInterval = setInterval(() => {
      this.setData({ timer: this.data.timer + 1 })
    }, 1000)
  },

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
  },

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  },

  winGame() {
    this.stopTimer()
    if (this.data.isMultiplayer) {
      this.submitRoundScore()
    } else {
      this.updateUserRecord()
      const result = this.getWinResult(this.data.timer, this.data.selectedDifficulty)
      this.setData({ showWin: true, finalTime: this.data.timer, winResult: result })
    }
  },

  async updateUserRecord() {
    try {
      const app = getApp()
      if (!app.globalData.isLoggedIn) return

      const openidRes = await cloud.callFunction({ name: 'getOpenid' })
      const openid = openidRes.result.openid
      const db = cloud.database()

      const userRes = await db.collection('users').where({ openid }).get()
      if (userRes.data.length === 0) return

      const user = userRes.data[0]
      const imageUrl = this.data.selectedImage
      const difficulty = this.data.selectedDifficulty
      const time = this.data.timer
      const fileID = imageUrl

      let bestRecords = user.bestRecords || []
      const existingIndex = bestRecords.findIndex(r =>
        r.imageUrl === imageUrl || (fileID && r.fileID === fileID)
      )

      if (existingIndex !== -1) {
        if (time < bestRecords[existingIndex].bestTime) {
          bestRecords[existingIndex].bestTime = time
          bestRecords[existingIndex].updateTime = cloud.serverDate()
          if (fileID) bestRecords[existingIndex].fileID = fileID
          bestRecords[existingIndex].imageUrl = imageUrl
        }
      } else {
        bestRecords.push({
          imageUrl,
          fileID,
          difficulty,
          bestTime: time,
          updateTime: cloud.serverDate()
        })
      }

      await db.collection('users').doc(user._id).update({
        data: { bestRecords, updateTime: cloud.serverDate() }
      })
    } catch (err) {
      console.error('更新记录失败', err)
    }
  },

  submitRoundScore() {
    cloud.callFunction({
      name: 'submitScore',
      data: {
        roomId: this.data.roomId,
        time: this.data.timer
      }
    }).then(res => {
      if (res.result.success) {
        this.setData({ showRoundResult: true })
        if (res.result.allFinished) {
          this.advanceRound()
        } else {
          this.startWatchingRoom()
        }
      }
    })
  },

  startWatchingRoom() {
    const db = cloud.database()
    this.watcher = db.collection('rooms')
      .where({ roomId: this.data.roomId })
      .watch({
        onChange: (snapshot) => {
          if (snapshot.docs.length > 0) {
            const room = snapshot.docs[0]
            const currentRound = room.currentRound || 0
            const roundScore = room.roundScores && room.roundScores[currentRound]
            if (roundScore && roundScore.scores) {
              const allFinished = room.players.every(p => {
                return roundScore.scores.find(s => s.openid === p.openid)
              })
              if (allFinished) {
                this.watcher.close()
                this.advanceRound()
              }
            }
            if (room.status === 'finished') {
              this.watcher.close()
              this.showFinalResults(room)
            }
          }
        },
        onError: (err) => console.error('监听失败', err)
      })
  },

  advanceRound() {
    cloud.callFunction({
      name: 'nextRound',
      data: { roomId: this.data.roomId }
    }).then(res => {
      if (res.result.finished) {
        this.setData({ showRoundResult: false })
        this.showFinalResults(res.result.room)
      } else {
        wx.redirectTo({
          url: `/pages/puzzle/puzzle?roomId=${this.data.roomId}&round=${res.result.room.currentRound}&totalRounds=${res.result.room.maxRounds}&image=${encodeURIComponent(res.result.room.images[res.result.room.currentRound].url)}&difficulty=medium`
        })
      }
    })
  },

  showFinalResults(room) {
    const rankings = this.calculateRankings(room)
    this.setData({
      showRoundResult: false,
      showFinalResult: true,
      finalRankings: rankings
    })
  },

  calculateRankings(room) {
    const playerMap = {}
    room.players.forEach(p => {
      playerMap[p.openid] = {
        openid: p.openid,
        nickName: p.nickName,
        avatarUrl: p.avatarUrl,
        totalTime: 0,
        roundWins: 0
      }
    })

    room.roundScores.forEach(round => {
      const sorted = [...round.scores].sort((a, b) => a.time - b.time)
      if (sorted.length > 0) {
        playerMap[sorted[0].openid].roundWins++
      }
      round.scores.forEach(score => {
        if (playerMap[score.openid]) {
          playerMap[score.openid].totalTime += score.time
        }
      })
    })

    return Object.values(playerMap).sort((a, b) => {
      if (b.roundWins !== a.roundWins) return b.roundWins - a.roundWins
      return a.totalTime - b.totalTime
    })
  },

  loadFinalResult(roomId) {
    cloud.callFunction({
      name: 'getRoom',
      data: { roomId }
    }).then(res => {
      if (res.result.success) {
        const rankings = this.calculateRankings(res.result.room)
        this.setData({ showFinalResult: true, finalRankings: rankings })
      }
    })
  },

  getWinResult(time, difficulty) {
    const timeLimits = {
      easy: { excellent: 30, good: 60, normal: 90 },
      medium: { excellent: 60, good: 120, normal: 180 },
      hard: { excellent: 120, good: 240, normal: 360 }
    }
    const limits = timeLimits[difficulty] || timeLimits.easy
    if (time <= limits.excellent) {
      return { emoji: '\u{1F3C6}', title: '太厉害了！', stars: 5, comment: `用时仅 ${this.formatTime(time)}！你是拼图大师！` }
    } else if (time <= limits.good) {
      return { emoji: '\u{1F31F}', title: '非常棒！', stars: 4, comment: `用时 ${this.formatTime(time)}，表现出色！继续加油！` }
    } else if (time <= limits.normal) {
      return { emoji: '\u{1F44D}', title: '完成了！', stars: 3, comment: `用时 ${this.formatTime(time)}，不错的成绩！再接再厉！` }
    } else {
      return { emoji: '\u{1F4AA}', title: '坚持就是胜利！', stars: 2, comment: `用时 ${this.formatTime(time)}，虽然时间长了点，但你没有放弃！继续努力！` }
    }
  },

  restartGame() {
    this.setData({ showWin: false, showRoundResult: false, showFinalResult: false })
    this.startGame()
  },

  goHome() {
    this.stopTimer()
    if (this.watcher) {
      this.watcher.close()
    }
    wx.reLaunch({ url: '/pages/index/index' })
  },

  backToRoom() {
    wx.navigateBack()
  }
})
