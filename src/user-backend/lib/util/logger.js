// =================================================================
// 1. Core Modules & Configuration
// =================================================================

// 로깅 라이브러리: Node.js 환경에서 유연하고 확장 가능한 로깅을 제공
const winston = require('winston');
// Winston 플러그인: 로그 파일을 일별로 회전(rotate) 및 관리 기능 제공
const winstonDaily = require('winston-daily-rotate-file');
// Node.js 전역 객체: 현재 Node.js 프로세스 관련 정보 및 제어 기능 접근 (환경 변수, PID 등)
const process = require('process');

// Winston 포맷 유틸리티를 비구조화 할당하여 사용
const {combine, timestamp, label, printf} = winston.format;

// =================================================================
// 2. Format & Path Configuration
// =================================================================

// 로그 파일이 저장될 절대 경로 설정. 현재 작업 디렉토리 아래 'logs' 폴더 지정.
const logDirectory = `${process.cwd()}/logs`;

// 로그 출력 포맷 정의 함수
// [YYYY-MM-DD HH:mm:ss] [앱 레이블] 레벨: 메시지 형태로 출력
const logFormat = printf(({level, message, label, timestamp})=>{
    return `${timestamp} [${label}] ${level}: ${message}`;
});

// =================================================================
// 3. Feature Implement (모듈 내보내기)
// =================================================================

// Logger 인스턴스 생성
const logger = winston.createLogger({

    // [1] 로그 포맷 설정
    format: combine(
        // 로그 기록 시간 형식 지정
        timestamp({format : 'YYYY-MM-DD HH:mm:ss'}),
        // 애플리케이션 식별을 위한 레이블 지정
        label({label : 'bookCalander 관리자 어플리케이션'}),
        // 위에서 정의한 최종 출력 포맷 적용
        logFormat,
    ),

    // [2] 실제 로그를 어디에, 어떤 방식으로 기록할지 정의 (Transports)
    transports: [
        
        // [2-1] error 레벨 로그 전용 Transport 설정
        new winstonDaily({
            level: 'error',         // 이 Transport는 'error' 레벨만 기록
            datePattern : 'YYYYMMDD', // 로그 파일명에 사용될 날짜 형식
            dirname : logDirectory, // 로그 파일이 저장될 기본 경로
            filename : `%DATE%.log`, // 최종 파일명 형식 (날짜 + .log)
            maxFiles : 30,          // 최대 30일치 로그 파일 보관
            zippedArchive : true,  // 보관 기한이 지난 파일을 압축
        }),

        // [2-2] warn 레벨 로그 전용 Transport 설정
        // NOTE: 이 Transport는 'warn' 레벨만 기록하며, 'error' 로그는 이미 위의 Transport에서 처리됨
        new winstonDaily({
            level: 'warn',
            datePattern : 'YYYYMMDD',
            dirname : logDirectory,
            filename : `%DATE%.log`,
            maxFiles : 30,
            zippedArchive : true,
        }),

        // [2-3] info 레벨 로그 전용 Transport 설정
        // NOTE: 이 Transport는 'info' 레벨만 기록하며, 'warn'/'error' 로그는 이미 위에서 처리됨
        new winstonDaily({
            level: 'info',
            datePattern : 'YYYYMMDD',
            dirname : logDirectory,
            filename : `%DATE%.log`,
            maxFiles : 30,
            zippedArchive : true,
        }),

        // [2-4] debug 레벨 로그 전용 Transport 설정
        // NOTE: 이 Transport는 'debug' 레벨만 기록하며, 상위 레벨 로그는 이미 위에서 처리됨
        // (일반적으로 이 레벨까지 파일로 분리하는 대신 하나의 통합 Transport를 사용함)
        new winstonDaily({
            level: 'debug',
            datePattern : 'YYYYMMDD',
            dirname : logDirectory,
            filename : `%DATE%.log`,
            maxFiles : 30,
            zippedArchive : true,
        }),
    ],
})

// 다른 모듈에서 사용할 수 있도록 Logger 인스턴스를 내보냄 (module.exports로 로거 사용)
module.exports = logger;