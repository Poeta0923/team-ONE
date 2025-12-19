// =================================================================
// 1. Core Modules & Middleware
// =================================================================

const express = require('express');
const router = express.Router();

const path = require('path');
const fs = require('fs');
const multer = require('multer');

const logger = require('../lib/util/logger');
const verifyToken = require('../lib/util/authMiddleware');
const uploadController = require('../lib/chat/upload');

// =================================================================
// 2. Multer Configuration (파일 저장 설정)
// =================================================================

// 업로드 경로가 없으면 자동 생성
const uploadDir = path.join(__dirname, '..', 'uploads', 'chat');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log("📁 uploads/chat 디렉토리 자동 생성 완료");
}

// Multer 저장 설정
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, unique + ext);
    }
});

const upload = multer({ storage });

// =================================================================
// 3. Upload Route
// =================================================================

/**
 * 파일 업로드 API
 * - 인증 필요
 * - 단일 파일 업로드
 * - roomId 필요
 */
router.post(
    '/upload',
    verifyToken,                  // JWT 인증
    upload.single('file'),        // 파일 1개 업로드
    uploadController.uploadFile   // 파일 저장 후 채팅 브로드캐스트 처리
);

// =================================================================
// 4. Export
// =================================================================

module.exports = router;
