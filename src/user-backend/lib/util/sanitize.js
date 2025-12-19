// =================================================================
// 1. Core Modules & Configuration
// =================================================================
// HTML 파싱 & 필터링 라이브러리 로드 (XSS 방지 및 기본 입력 Sanitization)
const sanitizeHtml = require('sanitize-html');

// =================================================================
// 2. Feature Implement (모듈 내보내기)
// =================================================================

/**
 * @description 객체 내의 모든 문자열 값에 대해 HTML Sanitization을 적용하여 XSS 공격을 방지합니다.
 * @param {object} inputObject 정제가 필요한 입력 객체 (예: req.body)
 * @returns {object} 정제가 완료된 새로운 객체
 */
const sanitizeObject = (inputObject) => {
    // 입력 객체가 유효하지 않거나 배열인 경우 원본 반환
    if (typeof inputObject !== 'object' || inputObject === null || Array.isArray(inputObject)) {
        return inputObject;
    }

    // 새로운 객체를 생성하여 원본 객체를 변경하지 않도록 함 (불변성 유지)
    const sanitizedObject = {};

    for (const key in inputObject) {
        // 객체의 고유 속성만 처리 (프로토타입 체인 속성 제외)
        if (Object.prototype.hasOwnProperty.call(inputObject, key)) {
            const value = inputObject[key];

            if (typeof value === 'string') {
                // 문자열인 경우에만 sanitize-html 적용
                // 'allowedTags: []'는 모든 HTML 태그를 제거하고 순수 텍스트만 남김
                sanitizedObject[key] = sanitizeHtml(value, {
                    allowedTags: [],
                    allowedAttributes: {},
                });
            } else if (typeof value === 'object' && value !== null) {
                // 중첩된 객체도 재귀적으로 처리
                sanitizedObject[key] = sanitizeObject(value);
            } else {
                // 문자열이나 객체가 아닌 값(숫자, boolean 등)은 그대로 복사
                sanitizedObject[key] = value;
            }
        }
    }

    return sanitizedObject;
};

// 모듈 외부로 함수 내보내기
module.exports = {
    sanitizeObject,
};