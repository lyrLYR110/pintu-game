/**
 * ============================================================
 * 照片碎片化拼图 - Photo Fragment Puzzle
 * 完整游戏逻辑（单文件，无外部依赖）
 * TRAE AI Creativity Contest 参赛作品
 * ============================================================
 */

// ===== 配置常量 =====
const CONFIG = {
    IMAGES: [
        { id: 1, name: '山间小路', url: 'assets/images/1.jpg' },
        { id: 2, name: '湖光山色', url: 'assets/images/2.jpg' },
        { id: 3, name: '海边日落', url: 'assets/images/3.jpg' }
    ],
    DIFFICULTY: {
        easy:   { grid: 3, label: '简单 3×3', timeLimits: { excellent: 30, good: 60, normal: 90 } },
        medium: { grid: 4, label: '中等 4×4', timeLimits: { excellent: 60, good: 120, normal: 180 } },
        hard:   { grid: 5, label: '困难 5×5', timeLimits: { excellent: 120, good: 240, normal: 360 } }
    },
    MEMORY_TIME: 5,
    PARTICLES_COUNT: 40
};

// 品牌配色（粒子用）
const BRAND_COLORS = ['#6C5CE7', '#00CEC9', '#FD79A8', '#FDCB6E', '#A29BFE', '#55EFC4'];

// ===== 全局状态 =====
const state = {
    currentScreen: 'loading',
    selectedImage: null,
    selectedDifficulty: 'easy',
    // 游戏状态
    gridSize: 3,
    pieceSize: 0,
    pieces: [],
    selectedPiece: null,
    firstSelected: null,
    correctCount: 0,
    totalPieces: 9,
    timer: 0,
    timerInterval: null,
    // 记忆阶段
    memoryCountdown: 5,
    memoryInterval: null,
    // 音乐（占位）
    isMusicPlaying: false,
    // 粒子
    particles: [],
    particleAnimId: null,
    // 参考图
    refVisible: false,
    // 撤销系统
    history: [],
    // 提示次数
    hintsUsed: 0,
    maxHints: 3,
    // 排行榜
    rankings: JSON.parse(localStorage.getItem('puzzle_rankings') || '[]'),
    // 图片加载 Promise（用于确保图片就绪）
    imageLoadPromise: null
};

// ===== 工具函数 =====

/**
 * 格式化秒数为 MM:SS 字符串
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

/**
 * Fisher-Yates 洗牌算法（返回新数组，不修改原数组）
 */
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * 安全获取 DOM 元素
 */
function $(selector) {
    return document.querySelector(selector);
}

function $$(selector) {
    return document.querySelectorAll(selector);
}

// ===== 1. 加载屏幕 =====

function initLoading() {
    const loadingBar = $('#loading-bar');
    const loadingText = $('#loading-text');
    const loadingScreen = $('#loading-screen');

    // 模拟 2 秒加载过程
    const steps = [
        { progress: 20, text: '正在初始化...' },
        { progress: 50, text: '正在加载资源...' },
        { progress: 80, text: '正在准备界面...' },
        { progress: 100, text: '加载完成！' }
    ];

    let stepIndex = 0;
    const stepInterval = setInterval(() => {
        if (stepIndex < steps.length) {
            loadingBar.style.width = steps[stepIndex].progress + '%';
            loadingText.textContent = steps[stepIndex].text;
            stepIndex++;
        } else {
            clearInterval(stepInterval);
            // 加载完成，淡出
            setTimeout(() => {
                loadingScreen.classList.add('fade-out');
                const app = $('#app');
                app.classList.remove('hidden');
                // 初始化粒子系统和首页
                initParticles();
                showScreen('home');
                // 加载完成后移除加载屏幕
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 600);
            }, 300);
        }
    }, 500);
}

// ===== 2. 粒子系统（背景装饰） =====

function initParticles() {
    const canvas = $('#particles-canvas');
    if (!canvas) return;

    // 检查用户是否偏好减少动画
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        canvas.style.display = 'none';
        return;
    }

    const ctx = canvas.getContext('2d');

    // 设置画布尺寸
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 创建粒子
    state.particles = [];
    for (let i = 0; i < CONFIG.PARTICLES_COUNT; i++) {
        state.particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: -(Math.random() * 0.5 + 0.2),  // 向上缓慢飘动
            radius: Math.random() * 2 + 1,     // 1-3px
            opacity: Math.random() * 0.4 + 0.1, // 0.1-0.5
            color: BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)]
        });
    }

    // 动画循环
    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        state.particles.forEach(p => {
            // 更新位置
            p.x += p.vx;
            p.y += p.vy;

            // 超出屏幕边界时循环
            if (p.y < -10) {
                p.y = canvas.height + 10;
                p.x = Math.random() * canvas.width;
            }
            if (p.x < -10) p.x = canvas.width + 10;
            if (p.x > canvas.width + 10) p.x = -10;

            // 绘制圆形粒子
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.opacity;
            ctx.fill();
        });

        ctx.globalAlpha = 1;
        state.particleAnimId = requestAnimationFrame(animateParticles);
    }

    animateParticles();
}

// ===== 3. 屏幕导航 =====

/**
 * 切换到指定屏幕
 * @param {string} screenId - 'home' | 'memory' | 'game' | 'win'
 */
function showScreen(screenId) {
    state.currentScreen = screenId;

    // 隐藏所有屏幕（移除 active，添加 hidden）
    $$('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.classList.add('hidden');
    });

    // 显示目标屏幕（移除 hidden，添加 active）
    const target = $(`#screen-${screenId}`);
    if (target) {
        target.classList.remove('hidden');
        // 用 rAF 确保 transition 触发
        requestAnimationFrame(() => {
            target.classList.add('active');
        });
    }

    // 更新导航栏标题
    const navTitle = $('#nav-title');
    const titles = {
        home: '照片碎片化拼图',
        memory: '记忆挑战',
        game: '拼图进行中',
        win: '恭喜完成'
    };
    navTitle.textContent = titles[screenId] || '照片碎片化拼图';
}

// ===== 4. 首页 - 预设图片选择 =====

function initPresetImages() {
    const container = $('#preset-images');
    if (!container) return;

    CONFIG.IMAGES.forEach((img, index) => {
        const card = document.createElement('div');
        card.className = 'preset-image-card';
        card.dataset.imageId = img.id;

        card.innerHTML = `
            <img src="${img.url}" alt="${img.name}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23333%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2214%22>${img.name}</text></svg>'">
            <div class="image-label">${img.name}</div>
        `;

        // 点击选择图片
        card.addEventListener('click', () => {
            selectPresetImage(img, card);
        });

        container.appendChild(card);

        // 默认选中第一张
        if (index === 0) {
            selectPresetImage(img, card);
        }
    });
}

/**
 * 选择预设图片
 */
function selectPresetImage(imageData, cardElement) {
    // 移除所有 active 状态
    $$('.preset-image-card').forEach(c => c.classList.remove('active'));
    // 设置当前 active
    cardElement.classList.add('active');
    // 更新状态
    state.selectedImage = { id: imageData.id, name: imageData.name, url: imageData.url };
    // 隐藏上传预览
    clearUploadPreview();
}

// ===== 5. 首页 - 图片上传 =====

function initUpload() {
    const uploadArea = $('#upload-area');
    const fileInput = $('#file-input');
    const placeholder = $('#upload-placeholder');
    const preview = $('#upload-preview');
    const previewImg = $('#upload-preview-img');
    const removeBtn = $('#upload-remove-btn');

    if (!uploadArea || !fileInput) return;

    // 点击上传区域触发文件选择
    uploadArea.addEventListener('click', (e) => {
        // 如果点击的是移除按钮，不触发文件选择
        if (e.target.closest('#upload-remove-btn')) return;
        fileInput.click();
    });

    // 文件选择变化
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleUploadedFile(file);
    });

    // 拖拽支持
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) handleUploadedFile(file);
    });

    // 移除按钮
    if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearUploadPreview();
            state.selectedImage = null;
            // 重新选中第一张预设图
            const firstCard = $('.preset-image-card');
            if (firstCard) {
                firstCard.classList.add('active');
                state.selectedImage = {
                    id: CONFIG.IMAGES[0].id,
                    name: CONFIG.IMAGES[0].name,
                    url: CONFIG.IMAGES[0].url
                };
            }
        });
    }
}

/**
 * 处理上传的文件
 */
function handleUploadedFile(file) {
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
        showToast('请上传图片文件');
        return;
    }

    // 验证文件大小（限制 10MB）
    if (file.size > 10 * 1024 * 1024) {
        showToast('图片文件不能超过 10MB');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;

        // 取消预设图片选中状态
        $$('.preset-image-card').forEach(c => c.classList.remove('active'));

        // 显示预览
        const placeholder = $('#upload-placeholder');
        const preview = $('#upload-preview');
        const previewImg = $('#upload-preview-img');

        placeholder.classList.add('hidden');
        preview.classList.remove('hidden');
        previewImg.src = dataUrl;

        // 更新状态
        state.selectedImage = {
            id: 'upload',
            name: '自定义图片',
            url: dataUrl
        };

        showToast('图片上传成功');
    };
    reader.readAsDataURL(file);
}

/**
 * 清除上传预览
 */
function clearUploadPreview() {
    const placeholder = $('#upload-placeholder');
    const preview = $('#upload-preview');
    const previewImg = $('#upload-preview-img');
    const fileInput = $('#file-input');

    if (placeholder) placeholder.classList.remove('hidden');
    if (preview) preview.classList.add('hidden');
    if (previewImg) previewImg.src = '';
    if (fileInput) fileInput.value = '';
}

// ===== 6. 首页 - 难度选择 =====

function initDifficulty() {
    const buttons = $$('.difficulty-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            // 移除所有 active
            buttons.forEach(b => b.classList.remove('active'));
            // 设置当前 active
            btn.classList.add('active');
            // 更新状态
            state.selectedDifficulty = btn.dataset.difficulty;
        });
    });
}

// ===== 7. 开始游戏 =====

function startGame() {
    if (!state.selectedImage) {
        showToast('请先选择图片');
        return;
    }

    // 设置网格大小
    const difficulty = CONFIG.DIFFICULTY[state.selectedDifficulty];
    state.gridSize = difficulty.grid;
    state.totalPieces = state.gridSize * state.gridSize;
    state.correctCount = 0;
    state.firstSelected = null;
    state.selectedPiece = null;
    state.refVisible = false;
    state.history = [];
    state.hintsUsed = 0;

    // 隐藏参考图面板
    const refPanel = $('#ref-panel');
    if (refPanel) refPanel.classList.add('hidden');

    // 更新进度显示
    const progressText = $('#progress-text');
    if (progressText) progressText.textContent = `已完成: 0/${state.totalPieces}`;
    const progressBarFill = $('#progress-bar-fill');
    if (progressBarFill) progressBarFill.style.width = '0%';

    // 显示记忆屏幕
    showScreen('memory');

    // 加载图片并启动记忆倒计时
    loadImageAndStartMemory();
}

/**
 * 加载图片确保就绪，然后启动记忆倒计时
 */
function loadImageAndStartMemory() {
    const memoryImg = $('#memory-image');
    if (!memoryImg) return;

    // 如果是预设图片，直接设置 src 并等待加载
    memoryImg.src = state.selectedImage.url;

    // 等待图片加载完成（如果已经缓存了则会立即触发）
    const loadImage = new Promise((resolve) => {
        if (memoryImg.complete && memoryImg.naturalWidth > 0) {
            resolve();
        } else {
            memoryImg.onload = resolve;
            memoryImg.onerror = resolve; // 即使加载失败也继续
        }
    });

    loadImage.then(() => {
        // 设置参考图和胜利屏幕图片
        const refImg = $('#ref-panel-img');
        if (refImg) refImg.src = state.selectedImage.url;
        const winImg = $('#win-image');
        if (winImg) winImg.src = state.selectedImage.url;

        // 短暂延迟后开始记忆倒计时
        setTimeout(() => {
            startMemoryCountdown();
        }, 300);
    });
}

// ===== 8. 记忆倒计时 =====

function startMemoryCountdown() {
    state.memoryCountdown = CONFIG.MEMORY_TIME;

    const countdownEl = $('#memory-countdown');
    const progressEl = $('#memory-progress');

    if (countdownEl) countdownEl.textContent = state.memoryCountdown;
    if (progressEl) progressEl.style.width = '100%';

    // 倒计时
    state.memoryInterval = setInterval(() => {
        state.memoryCountdown--;

        if (countdownEl) {
            countdownEl.textContent = state.memoryCountdown;
            // 重新触发弹出动画
            countdownEl.style.animation = 'none';
            countdownEl.offsetHeight; // 强制重排
            countdownEl.style.animation = 'countdownPop 1s ease-in-out';
        }

        // 更新进度条
        if (progressEl) {
            const percent = (state.memoryCountdown / CONFIG.MEMORY_TIME) * 100;
            progressEl.style.width = percent + '%';
        }

        // 倒计时结束
        if (state.memoryCountdown <= 0) {
            clearInterval(state.memoryInterval);
            state.memoryInterval = null;

            // 初始化拼图碎片并进入游戏
            initPieces();
            shufflePieces();
            checkCorrectPieces();
            renderPuzzle();

            showScreen('game');
            startTimer();
        }
    }, 1000);
}

// ===== 9. 拼图逻辑 - 初始化碎片 =====

function initPieces() {
    state.pieces = [];
    const grid = state.gridSize;

    for (let y = 0; y < grid; y++) {
        for (let x = 0; x < grid; x++) {
            state.pieces.push({
                id: `${x}-${y}`,
                correctX: x,
                correctY: y,
                currentX: x,
                currentY: y,
                rotation: 0,
                isCorrect: false
            });
        }
    }
}

// ===== 10. 拼图逻辑 - 打乱 =====

function shufflePieces() {
    const shuffled = shuffleArray(state.pieces);
    const grid = state.gridSize;

    // 重新分配当前位置
    shuffled.forEach((piece, index) => {
        piece.currentX = Math.floor(index / grid);
        piece.currentY = index % grid;
    });

    // 随机旋转（每个碎片随机选择 [0, 90, 180, 270] 中的一个）
    const rotations = [0, 90, 180, 270];
    shuffled.forEach(piece => {
        piece.rotation = rotations[Math.floor(Math.random() * rotations.length)];
    });

    // 检查是否恰好全部在正确位置且旋转为0（即已经解好），如果是则重新打乱
    let allCorrect = shuffled.every(p =>
        p.currentX === p.correctX &&
        p.currentY === p.correctY &&
        p.rotation === 0
    );

    if (allCorrect) {
        // 如果不小心打成了完成状态，重新打乱
        shufflePieces();
        return;
    }
}

// ===== 11. 拼图渲染 =====

function renderPuzzle() {
    const board = $('#puzzle-board');
    if (!board) return;

    board.innerHTML = '';

    const grid = state.gridSize;

    // 设置 CSS Grid
    board.style.gridTemplateColumns = `repeat(${grid}, 1fr)`;

    // 按当前位置排序以正确显示在网格中
    const sortedPieces = [...state.pieces].sort((a, b) => {
        if (a.currentX !== b.currentX) return a.currentX - b.currentX;
        return a.currentY - b.currentY;
    });

    sortedPieces.forEach(piece => {
        const div = document.createElement('div');
        div.className = 'puzzle-piece';
        div.dataset.id = piece.id;

        // 添加状态类
        if (state.selectedPiece && state.selectedPiece.id === piece.id) {
            div.classList.add('selected');
        }
        if (piece.isCorrect) {
            div.classList.add('correct');
        }

        // 计算背景位置
        // background-size 为 gridSize * 100% 使图片按网格放大
        // background-position 根据正确位置计算百分比
        const bgPosX = grid > 1 ? (piece.correctX / (grid - 1)) * 100 : 0;
        const bgPosY = grid > 1 ? (piece.correctY / (grid - 1)) * 100 : 0;

        div.style.backgroundImage = `url(${state.selectedImage.url})`;
        div.style.backgroundSize = `${grid * 100}% ${grid * 100}%`;
        div.style.backgroundPosition = `${bgPosX}% ${bgPosY}%`;
        div.style.transform = `rotate(${piece.rotation}deg)`;

        // 点击事件
        div.addEventListener('click', () => {
            selectPiece(piece.id);
        });

        board.appendChild(div);
    });
}

// ===== 12. 碎片选择与交换 =====

function selectPiece(pieceId) {
    const piece = state.pieces.find(p => p.id === pieceId);
    if (!piece || piece.isCorrect) return;

    if (state.firstSelected === null) {
        // 第一次选择
        state.firstSelected = piece;
        state.selectedPiece = piece;
        renderPuzzle();
    } else if (state.firstSelected.id === pieceId) {
        // 点击同一个碎片，取消选择
        state.firstSelected = null;
        state.selectedPiece = null;
        renderPuzzle();
    } else {
        // 第二次选择 —— 执行交换
        swapPieces(state.firstSelected, piece);
    }
}

/**
 * 交换两个碎片的位置
 */
function swapPieces(piece1, piece2) {
    saveToHistory();
    // 交换当前坐标
    const tempX = piece1.currentX;
    const tempY = piece1.currentY;
    piece1.currentX = piece2.currentX;
    piece1.currentY = piece2.currentY;
    piece2.currentX = tempX;
    piece2.currentY = tempY;

    // 清除选择状态
    state.firstSelected = null;
    state.selectedPiece = null;

    // 重新渲染
    renderPuzzle();

    // 交换动画：给两个碎片的 DOM 元素添加动画类
    setTimeout(() => {
        const el1 = $(`.puzzle-piece[data-id="${piece1.id}"]`);
        const el2 = $(`.puzzle-piece[data-id="${piece2.id}"]`);
        if (el1) el1.classList.add('swap-anim');
        if (el2) el2.classList.add('swap-anim');

        // 动画结束后移除类
        setTimeout(() => {
            if (el1) el1.classList.remove('swap-anim');
            if (el2) el2.classList.remove('swap-anim');
        }, 350);
    }, 10);

    // 检查正确碎片
    checkCorrectPieces();
}

// ===== 13. 旋转 =====

function rotatePiece(angle) {
    if (!state.selectedPiece || state.selectedPiece.isCorrect) return;
    saveToHistory();

    const piece = state.pieces.find(p => p.id === state.selectedPiece.id);
    if (!piece || piece.isCorrect) return;

    let newRotation = (piece.rotation + angle) % 360;
    if (newRotation < 0) newRotation += 360;
    piece.rotation = newRotation;

    renderPuzzle();
    checkCorrectPieces();
}

// ===== 14. 正确碎片检查 =====

function checkCorrectPieces() {
    let correctCount = 0;

    state.pieces.forEach(piece => {
        const posCorrect = piece.currentX === piece.correctX && piece.currentY === piece.correctY;
        const rotCorrect = piece.rotation === 0;
        piece.isCorrect = posCorrect && rotCorrect;
        if (piece.isCorrect) correctCount++;
    });

    state.correctCount = correctCount;
    updateProgress();

    // 如果全部正确，触发胜利
    if (correctCount === state.totalPieces) {
        // 延迟一点触发胜利，让最后的动画完成
        setTimeout(() => {
            winGame();
        }, 400);
    }
}

// ===== 15. 计时器 =====

function startTimer() {
    state.timer = 0;
    updateTimerDisplay();

    // 清除旧的计时器（防止重复）
    stopTimer();

    state.timerInterval = setInterval(() => {
        state.timer++;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
}

function updateTimerDisplay() {
    const el = $('#timer-display');
    if (el) el.textContent = formatTime(state.timer);
}

function updateProgress() {
    const total = state.totalPieces;
    const done = state.correctCount;

    const progressText = $('#progress-text');
    if (progressText) progressText.textContent = `已完成: ${done}/${total}`;

    const progressBarFill = $('#progress-bar-fill');
    if (progressBarFill) progressBarFill.style.width = `${(done / total) * 100}%`;
}

// ===== 16. 胜利 =====

function winGame() {
    stopTimer();

    const difficulty = CONFIG.DIFFICULTY[state.selectedDifficulty];
    const time = state.timer;
    const limits = difficulty.timeLimits;

    let emoji, title, stars, comment;

    if (time <= limits.excellent) {
        emoji = '🏆'; title = '太厉害了！'; stars = 5;
        comment = '你是拼图大师！';
    } else if (time <= limits.good) {
        emoji = '🌟'; title = '非常棒！'; stars = 4;
        comment = '表现出色！继续加油！';
    } else if (time <= limits.normal) {
        emoji = '👍'; title = '完成了！'; stars = 3;
        comment = '不错的成绩！再接再厉！';
    } else {
        emoji = '💪'; title = '坚持就是胜利！'; stars = 2;
        comment = '虽然时间长了点，但你没有放弃！';
    }

    // 更新胜利屏幕元素
    const winEmoji = $('#win-emoji');
    if (winEmoji) winEmoji.textContent = emoji;

    const winTitle = $('#win-title');
    if (winTitle) winTitle.textContent = title;

    const winComment = $('#win-comment');
    if (winComment) winComment.textContent = comment;

    const winTime = $('#win-time');
    if (winTime) winTime.textContent = formatTime(time);

    const winDifficulty = $('#win-difficulty');
    if (winDifficulty) winDifficulty.textContent = difficulty.label;

    // 渲染星星
    const starsContainer = $('#win-stars');
    if (starsContainer) {
        starsContainer.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            const star = document.createElement('span');
            star.textContent = i < stars ? '\u2B50' : '\u2606'; // 实心星 / 空心星
            star.className = 'star' + (i < stars ? ' active' : '');
            starsContainer.appendChild(star);
        }
    }

    // 保存排行榜
    saveRanking(state.timer, state.selectedDifficulty, stars);
    // 撒花庆祝
    launchConfetti();

    showScreen('win');
}

// ===== 17. 导航与重置 =====

function goHome() {
    stopTimer();
    // 清除记忆倒计时
    if (state.memoryInterval) {
        clearInterval(state.memoryInterval);
        state.memoryInterval = null;
    }
    // 隐藏参考图面板
    const refPanel = $('#ref-panel');
    if (refPanel) refPanel.classList.add('hidden');
    state.refVisible = false;
    // 重置选择状态
    state.firstSelected = null;
    state.selectedPiece = null;
    showScreen('home');
}

function restartGame() {
    stopTimer();
    // 清除记忆倒计时
    if (state.memoryInterval) {
        clearInterval(state.memoryInterval);
        state.memoryInterval = null;
    }
    // 隐藏参考图面板
    const refPanel = $('#ref-panel');
    if (refPanel) refPanel.classList.add('hidden');
    state.refVisible = false;
    state.firstSelected = null;
    state.selectedPiece = null;
    startGame();
}

// ===== 18. Toast 通知 =====

function showToast(message) {
    const container = $('#toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    container.appendChild(toast);

    // 2 秒后自动消失
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 2000);
}

// ===== 19. 参考图切换 =====

function initRefToggle() {
    const refToggleBtn = $('#btn-ref-toggle');
    const refPanel = $('#ref-panel');

    if (!refToggleBtn || !refPanel) return;

    refToggleBtn.addEventListener('click', () => {
        state.refVisible = !state.refVisible;
        if (state.refVisible) {
            refPanel.classList.remove('hidden');
        } else {
            refPanel.classList.add('hidden');
        }
    });

    // 点击参考图面板也可以关闭
    refPanel.addEventListener('click', () => {
        state.refVisible = false;
        refPanel.classList.add('hidden');
    });
}

// ===== 19.5. 提示系统 =====

function useHint() {
    if (state.hintsUsed >= state.maxHints) {
        showToast('💡 提示次数已用完（最多 ' + state.maxHints + ' 次）', 'warning');
        return;
    }
    
    // 找一个不在正确位置的碎片
    const wrongPieces = state.pieces.filter(p => !p.isCorrect);
    if (wrongPieces.length === 0) return;
    
    // 找到这个碎片应该在的位置上目前放的是什么碎片
    const targetPiece = wrongPieces[0];
    const pieceAtTarget = state.pieces.find(p => 
        p.currentX === targetPiece.correctX && p.currentY === targetPiece.correctY && p.id !== targetPiece.id
    );
    
    state.hintsUsed++;
    
    // 高亮提示：闪烁两个需要交换的碎片
    const board = $('#puzzle-board');
    const pieces = board.querySelectorAll('.puzzle-piece');
    
    pieces.forEach(p => {
        if (p.dataset.id === targetPiece.id) {
            p.classList.add('hint-highlight');
            setTimeout(() => p.classList.remove('hint-highlight'), 2000);
        }
        if (pieceAtTarget && p.dataset.id === pieceAtTarget.id) {
            p.classList.add('hint-highlight');
            setTimeout(() => p.classList.remove('hint-highlight'), 2000);
        }
    });
    
    showToast('💡 提示 ' + state.hintsUsed + '/' + state.maxHints + '：试试交换高亮的碎片', 'success');
}

// ===== 19.6. 撤销系统 =====

function saveToHistory() {
    state.history.push({
        pieces: state.pieces.map(p => ({...p})),
        correctCount: state.correctCount
    });
    // 最多保留 50 步
    if (state.history.length > 50) state.history.shift();
}

function undo() {
    if (state.history.length === 0) {
        showToast('↩ 没有可撤销的操作', 'warning');
        return;
    }
    
    const prev = state.history.pop();
    state.pieces = prev.pieces;
    state.correctCount = prev.correctCount;
    state.firstSelected = null;
    state.selectedPiece = null;
    
    renderPuzzle();
    updateProgress();
    showToast('↩ 已撤销', 'success');
}

// ===== 19.7. 本地排行榜 =====

function saveRanking(time, difficulty, stars) {
    const record = {
        time,
        difficulty,
        stars,
        date: new Date().toISOString(),
        imageName: state.selectedImage ? state.selectedImage.name : '自定义图片'
    };
    
    state.rankings.push(record);
    // 按时间排序，保留前 10 条
    state.rankings.sort((a, b) => a.time - b.time);
    if (state.rankings.length > 10) state.rankings = state.rankings.slice(0, 10);
    
    localStorage.setItem('puzzle_rankings', JSON.stringify(state.rankings));
    renderRankings();
}

function renderRankings() {
    const container = $('#ranking-list');
    if (!container) return;
    
    if (state.rankings.length === 0) {
        container.innerHTML = '<p class="ranking-empty">暂无记录，开始游戏创造你的纪录吧！</p>';
        return;
    }
    
    container.innerHTML = state.rankings.map((r, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ' + (i + 1) + '.';
        const stars = '⭐'.repeat(r.stars) + '☆'.repeat(5 - r.stars);
        const diff = CONFIG.DIFFICULTY[r.difficulty] ? CONFIG.DIFFICULTY[r.difficulty].label : r.difficulty;
        return `
            <div class="ranking-item">
                <span class="ranking-medal">${medal}</span>
                <div class="ranking-info">
                    <span class="ranking-diff">${diff}</span>
                    <span class="ranking-stars">${stars}</span>
                </div>
                <span class="ranking-time">${formatTime(r.time)}</span>
            </div>
        `;
    }).join('');
}

// ===== 19.8. 庆祝动画（撒花） =====

function launchConfetti() {
    const container = $('#confetti-container');
    if (!container) return;
    
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    const count = 60;
    
    for (let i = 0; i < count; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + '%';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDelay = Math.random() * 1 + 's';
        piece.style.animationDuration = (2 + Math.random() * 2) + 's';
        piece.style.width = (6 + Math.random() * 8) + 'px';
        piece.style.height = (6 + Math.random() * 8) + 'px';
        piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        container.appendChild(piece);
    }
    
    setTimeout(() => {
        container.innerHTML = '';
    }, 4000);
}

// ===== 20. 音乐切换（占位） =====

function initMusic() {
    const musicBtn = $('#btn-music');

    if (!musicBtn) return;

    musicBtn.addEventListener('click', () => {
        state.isMusicPlaying = !state.isMusicPlaying;

        // 更新按钮视觉状态
        const svg = musicBtn.querySelector('svg');
        if (state.isMusicPlaying) {
            musicBtn.style.background = 'rgba(108, 92, 231, 0.2)';
            if (svg) svg.style.color = '#6C5CE7';
            showToast('🎵 背景音乐已开启（占位）');
        } else {
            musicBtn.style.background = '';
            if (svg) svg.style.color = '';
            showToast('🔇 背景音乐已关闭');
        }
    });
}

// ===== 21. 事件绑定（DOMContentLoaded 主入口） =====

document.addEventListener('DOMContentLoaded', () => {
    // 初始化加载屏幕
    initLoading();

    // 初始化预设图片
    initPresetImages();

    // 初始化上传功能
    initUpload();

    // 初始化难度选择
    initDifficulty();

    // 初始化参考图切换
    initRefToggle();

    // 初始化音乐
    initMusic();

    // 排行榜渲染
    renderRankings();

    // 帮助展开/折叠
    const helpToggle = $('#btn-help-toggle');
    const helpContent = $('#help-content');
    const helpArrow = $('#help-arrow');
    if (helpToggle && helpContent) {
        helpToggle.addEventListener('click', () => {
            const isHidden = helpContent.classList.contains('hidden');
            helpContent.classList.toggle('hidden');
            if (helpArrow) helpArrow.textContent = isHidden ? '▲' : '▼';
        });
    }

    // 开始按钮
    const startBtn = $('#btn-start');
    if (startBtn) {
        startBtn.addEventListener('click', startGame);
    }

    // 返回按钮
    const backBtn = $('#btn-back');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (state.currentScreen === 'home') return; // 首页不需要返回
            goHome();
        });
    }

    // 旋转按钮
    const rotateLeftBtn = $('#btn-rotate-left');
    if (rotateLeftBtn) {
        rotateLeftBtn.addEventListener('click', () => rotatePiece(-90));
    }

    const rotateRightBtn = $('#btn-rotate-right');
    if (rotateRightBtn) {
        rotateRightBtn.addEventListener('click', () => rotatePiece(90));
    }

    // 提示按钮
    const hintBtn = $('#btn-hint');
    if (hintBtn) {
        hintBtn.addEventListener('click', useHint);
    }

    // 撤销按钮
    const undoBtn = $('#btn-undo');
    if (undoBtn) {
        undoBtn.addEventListener('click', undo);
    }

    // 胜利屏幕按钮
    const restartBtn = $('#btn-restart');
    if (restartBtn) {
        restartBtn.addEventListener('click', restartGame);
    }

    const winHomeBtn = $('#btn-win-home');
    if (winHomeBtn) {
        winHomeBtn.addEventListener('click', goHome);
    }

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
        // Escape: 取消选择或返回首页
        if (e.key === 'Escape') {
            if (state.currentScreen === 'game') {
                if (state.firstSelected) {
                    state.firstSelected = null;
                    state.selectedPiece = null;
                    renderPuzzle();
                } else {
                    goHome();
                }
            }
        }

        // 左箭头：逆时针旋转
        if (e.key === 'ArrowLeft' && state.currentScreen === 'game') {
            rotatePiece(-90);
        }

        // 右箭头：顺时针旋转
        if (e.key === 'ArrowRight' && state.currentScreen === 'game') {
            rotatePiece(90);
        }
    });
});
