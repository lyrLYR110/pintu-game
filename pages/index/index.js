Page({
  data: {
    selectedImage: 'https://picsum.photos/id/1/600/600',
    selectedDifficulty: 'easy',
    gameStarted: false,
    showMemory: false,
    memoryCountdown: 5,
    showWin: false,
    timer: 0,
    finalTime: 0,
    pieces: [],
    gridSize: 3,
    pieceSize: 0,
    selectedPiece: null,
    firstSelected: null,
    showRotateControls: false,
    isMusicPlaying: false,
    currentMusicIndex: 0,
    correctCount: 0,
    totalPieces: 0,
    presetImages: [
      { id: 1, name: '山间小路', url: 'https://picsum.photos/id/1/600/600' },
      { id: 2, name: '湖光山色', url: 'https://picsum.photos/id/28/600/600' },
      { id: 3, name: '海边日落', url: 'https://picsum.photos/id/10/600/600' },
      { id: 4, name: '城市夜景', url: 'https://picsum.photos/id/26/600/600' },
      { id: 5, name: '森林小溪', url: 'https://picsum.photos/id/13/600/600' },
      { id: 6, name: '山川云海', url: 'https://picsum.photos/id/15/600/600' },
      { id: 7, name: '热带海滩', url: 'https://picsum.photos/id/19/600/600' },
      { id: 8, name: '雪山风光', url: 'https://picsum.photos/id/23/600/600' },
      { id: 9, name: '秋叶缤纷', url: 'https://picsum.photos/id/29/600/600' },
      { id: 10, name: '星空银河', url: 'https://picsum.photos/id/30/600/600' },
      { id: 11, name: '春日花海', url: 'https://picsum.photos/id/31/600/600' },
      { id: 12, name: '壮丽瀑布', url: 'https://picsum.photos/id/32/600/600' }
    ],
    musicList: [
      {
        id: 1,
        name: '宁静时光',
        artist: 'Free Music',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
      },
      {
        id: 2,
        name: '阳光海滩',
        artist: 'Free Music',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
      },
      {
        id: 3,
        name: '星空畅想',
        artist: 'Free Music',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
      },
      {
        id: 4,
        name: '森林小溪',
        artist: 'Free Music',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'
      }
    ]
  },

  difficultyConfig: {
    easy: 3,
    medium: 4,
    hard: 5
  },

  timerInterval: null,
  audioContext: null,

  onLoad() {
    console.log('页面加载')
    this.initAudio()
  },

  initAudio() {
    this.audioContext = wx.createInnerAudioContext()
    this.audioContext.loop = true
    this.audioContext.onEnded(() => {
      this.playNextMusic()
    })
    this.audioContext.onError((err) => {
      console.log('音频错误:', err)
    })
  },

  selectPresetImage(e) {
    const img = e.currentTarget.dataset.img
    this.setData({
      selectedImage: img
    })
  },

  uploadImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0]
        this.setData({
          selectedImage: tempFilePath
        })
      }
    })
  },

  selectDifficulty(e) {
    const difficulty = e.currentTarget.dataset.difficulty
    this.setData({
      selectedDifficulty: difficulty
    })
  },

  selectMusic(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    this.setData({
      currentMusicIndex: index
    })
    if (this.data.isMusicPlaying) {
      this.playMusic()
    }
  },

  toggleMusic() {
    if (this.data.isMusicPlaying) {
      this.stopMusic()
    } else {
      this.playMusic()
    }
  },

  playMusic() {
    const music = this.data.musicList[this.data.currentMusicIndex]
    if (music) {
      this.audioContext.src = music.url
      this.audioContext.play()
      this.setData({ isMusicPlaying: true })
    }
  },

  stopMusic() {
    this.audioContext.stop()
    this.setData({ isMusicPlaying: false })
  },

  playNextMusic() {
    let nextIndex = (this.data.currentMusicIndex + 1) % this.data.musicList.length
    this.setData({ currentMusicIndex: nextIndex })
    this.playMusic()
  },

  startGame() {
    const gridSize = this.difficultyConfig[this.data.selectedDifficulty]
    const pieceSize = 600 / gridSize

    this.setData({
      gameStarted: true,
      showMemory: true,
      memoryCountdown: 5,
      gridSize: gridSize,
      pieceSize: pieceSize,
      timer: 0,
      showWin: false,
      selectedPiece: null,
      firstSelected: null,
      correctCount: 0,
      totalPieces: gridSize * gridSize
    })

    if (this.data.isMusicPlaying) {
      this.playMusic()
    }

    this.startMemoryCountdown()
    this.initPieces()
  },

  startMemoryCountdown() {
    let count = 5
    const countdown = setInterval(() => {
      count--
      this.setData({
        memoryCountdown: count
      })
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

    this.setData({
      pieces: pieces
    })
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

    this.setData({
      pieces: newPieces
    })

    this.checkCorrectPieces()
  },

  selectPiece(e) {
    const id = e.currentTarget.dataset.id
    const piece = this.data.pieces.find(p => p.id === id)
    
    if (!piece || piece.isCorrect) return

    if (this.data.firstSelected === null) {
      this.setData({
        firstSelected: piece,
        selectedPiece: piece
      })
    } else if (this.data.firstSelected.id === id) {
      this.setData({
        firstSelected: null,
        selectedPiece: null
      })
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

    this.setData({
      pieces: pieces,
      firstSelected: null,
      selectedPiece: null
    })

    setTimeout(() => {
      this.checkCorrectPieces()
    }, 100)
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

    this.setData({
      pieces: pieces,
      selectedPiece: { ...pieces[idx] }
    })

    setTimeout(() => {
      this.checkCorrectPieces()
    }, 100)
  },

  checkCorrectPieces() {
    const { pieces, gridSize, pieceSize } = this.data
    let correctCount = 0

    const updatedPieces = pieces.map(piece => {
      const isPositionCorrect = piece.x === piece.correctX && piece.y === piece.correctY
      const isRotationCorrect = piece.rotation === 0
      const isCorrect = isPositionCorrect && isRotationCorrect
      
      if (isCorrect) correctCount++
      
      return {
        ...piece,
        isCorrect: isCorrect
      }
    })

    this.setData({
      pieces: updatedPieces,
      correctCount: correctCount
    })

    if (correctCount === gridSize * gridSize) {
      this.winGame()
    }
  },

  startTimer() {
    this.timerInterval = setInterval(() => {
      this.setData({
        timer: this.data.timer + 1
      })
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
    const result = this.getWinResult(this.data.timer, this.data.selectedDifficulty)
    this.setData({
      showWin: true,
      finalTime: this.data.timer,
      winResult: result
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
      return {
        emoji: '🏆',
        title: '太厉害了！',
        stars: 5,
        comment: `用时仅 ${this.formatTime(time)}！你是拼图大师！🎉`
      }
    } else if (time <= limits.good) {
      return {
        emoji: '🌟',
        title: '非常棒！',
        stars: 4,
        comment: `用时 ${this.formatTime(time)}，表现出色！继续加油！💪`
      }
    } else if (time <= limits.normal) {
      return {
        emoji: '👍',
        title: '完成了！',
        stars: 3,
        comment: `用时 ${this.formatTime(time)}，不错的成绩！再接再厉！✨`
      }
    } else {
      return {
        emoji: '💪',
        title: '坚持就是胜利！',
        stars: 2,
        comment: `用时 ${this.formatTime(time)}，虽然时间长了点，但你没有放弃！继续努力！🌈`
      }
    }
  },

  restartGame() {
    this.setData({
      showWin: false,
      showRotateControls: false
    })
    this.startGame()
  },

  goHome() {
    this.stopTimer()
    this.stopMusic()
    this.setData({
      gameStarted: false,
      showWin: false,
      timer: 0,
      showRotateControls: false
    })
  },

  onUnload() {
    this.stopTimer()
    this.stopMusic()
    if (this.audioContext) {
      this.audioContext.destroy()
    }
  }
})