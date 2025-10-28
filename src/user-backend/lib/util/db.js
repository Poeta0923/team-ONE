// =================================================================
// DB Connection Module (MySQL) - 수정된 내용 (Pool 사용)
// =================================================================

const mysql = require('mysql');

// [1] DB 연결 설정 정의 (동일)
const dbConfig = {
    host : process.env.DB_HOST || 'localhost', 
    port: process.env.DB_PORT || 3306,
    user : process.env.DB_USER || 'team-ONE',
    password : process.env.DB_PASSWORD || 'team-ONE123',
    database : process.env.DB_DATABASE || 'team-ONE',
    multipleStatements : true,
    // Pool 설정 추가 (선택적)
    connectionLimit: 10 // 최대 연결 개수 설정
};

// [2] MySQL Connection Pool 객체 생성
// NOTE: Connection Pool을 사용해야 getConnection() 메서드를 사용할 수 있고, 
//       동시 요청에 안전하며 연결 관리가 용이합니다.
const db = mysql.createPool(dbConfig);

// [3] DB 연결 테스트 (Pool.getConnection 사용)
db.getConnection((err, connection) => {
    if (err) {
        // Pool.getConnection 에러는 심각한 오류 (설정 오류 등)를 의미합니다.
        console.error('MySQL Pool 초기 연결 테스트 실패:', err.stack);
        return;
    }
    console.log('MySQL Connection Pool 생성 및 연결 성공.');
    connection.release(); // 연결을 Pool에 반환
});

// [4] 모듈 외부로 Pool 객체 내보내기
module.exports = db;