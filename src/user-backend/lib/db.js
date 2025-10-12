// =================================================================
// DB Connection Module (MySQL)
// =================================================================

// MySQL 데이터베이스 드라이버 로드
const mysql = require('mysql');

// [1] DB 연결 설정 정의
// NOTE: 보안 강화를 위해 모든 민감 정보는 process.env 환경 변수에서 가져옵니다.
const dbConfig = {
    // 호스트 주소 (process.env.DB_HOST)
    host : process.env.DB_HOST || 'localhost', 
    // 포트 번호
    port: process.env.DB_PORT || 3306,
    // 데이터베이스 사용자 이름 (process.env.DB_USER)
    user : process.env.DB_USER || 'team-ONE',
    // 사용자 비밀번호 (process.env.DB_PASSWORD)
    password : process.env.DB_PASSWORD || 'team-ONE123',
    // 연결할 데이터베이스 이름
    database : process.env.DB_DATABASE || 'team-ONE',
    // 한 번의 쿼리에서 여러 개의 SQL 문을 사용할 수 있도록 허용
    multipleStatements : true 
};

// [2] MySQL Connection 객체 생성
const db = mysql.createConnection(dbConfig);

// [3] DB 연결 실행
// 애플리케이션 시작 시 연결을 수립합니다.
db.connect(err => {
    if (err) {
        console.error('MySQL 연결 실패:', err.stack);
        return; 
    }
    console.log('MySQL 연결 성공. ID:', db.threadId);
});

// [4] 모듈 외부로 연결 객체 내보내기
// 다른 파일(라우터, 서비스)에서 데이터베이스 접근 시 이 객체를 사용합니다.
module.exports = db;
