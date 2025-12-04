# 🛡️ Team-ONE Admin System(Backend)
> **AI 기반 팀원 매칭 에이전시 'Team-ONE'을 위한 통합 관리자 플랫폼**
---
## 🗂️ 목차
1. [프로젝트 개요 및 목표](#1-프로젝트-개요-및-목표)
2. [아키텍처 및 시스템 구조](#2-아키텍처-및-시스템-구조)
3. [백엔드 개발환경](#3-백엔드-개발환경)
4. [API 서버 실행 가이드](#4-api-서버-실행-가이드)
5. [API 기능 명세](#5-api-기능-명세)
---
## 1. 프로젝트 개요 및 목표
Team-ONE은 프로젝트 팀원을 구하는 대학생들을 AI로 매칭해주는 서비스입니다. Team-ONE 관리자 시스템은 서비스 품질 향상과 데이터 무결성 확보를 위한 관리자자 전용 대시보드 및 관리 시스템입니다.  
### 🗓️ 개발 기간
`2025.09.03` ~ `2025.12.03`
### 💡 필요성 
 본 서비스의 규모가 커질 경우 아래와 같은 문제점이 발생할 것으로 예상하여 별도의 관리자 시스템 구축의 필요성을 느꼈습니다.
* **💾 데이터 관리의 비효율성**
    * 회원수와 프로젝트 수가 증가할 경우 직접적인 DB 접근 방식으로는 효율적인 데이터 검색과 수정이 불가능해질 것으로 예상
* **🚨 신고 처리의 한계**
    * 악성 유저에 대한 신고가 접수되어도 즉각적인 확인과 제재가 어려워 서비스 품질이 저하 우려
* **📊 운영 가시성 부족** 
    * 현재 가입자 추이나 AI 모델의 작동 상태 등 서비스의 전반적인 현황을 한 눈에 파악할 수 있는 지표가 부재

위와 같은 운영상의 Pain Point를 해결하고 안정적인 서비스 제공을 위해 통합 관리자 시스템을 개발하게 되었습니다. 
### 🎯 핵심 목표
다음 세 가지 핵심 가치를 중심으로 개발하였습니다.

* **👥 효율적인 사용자 관리**
    * 방대한 회원 및 프로젝트 데이터를 체계적으로 조회하고 관리할 수 있는 **중앙 집중형 시스템**을 구축
* **⚡ 신속한 대응 및 운영**
    * 신고 접수 시 즉각적인 처리 및 제재(블랙리스트 등록) 프로세스를 통해 **쾌적하고 안전한 서비스 환경**을 조성
* **✅ 서비스 신뢰성 확보**
    * AI 모델 상태 및 서비스 지표를 실시간으로 모니터링하여 **시스템 안정성**과 **데이터 무결성**을 보장

      
## 2. 아키텍처 및 시스템 구조
Team-ONE 관리자 시스템은 확장성과 유지보수성을 고려하여 프론트엔드, 백엔드, 그리고 AI 서비스가 독립적으로 분리된 **마이크로서비스 지향 아키텍처(Microservices-oriented Architecture)** 를 채택했습니다.

<img width="2224" height="1124" alt="architecture" src="https://github.com/user-attachments/assets/7f4ced3c-d097-40ef-b8cc-72d8ac3cf30f" />

각 서비스는 특화된 기술 스택(React, Node.js, Spring Boot, FastAPI)을 사용하여 최적의 성능을 내도록 설계되었으며 리버스 프록시 기술을 통해 서버를 유기적으로 통합하였습니다.


### ☕ 관리자 서버(Spring Boot)의 역할
관리자 서버는 MSA 환경 내에서 **데이터 허브**이자 **제어 센터**로서의 역할을 수행합니다.

* **📂 통합 데이터 관리**
  * 사용자 서비스의 DB에 직접 접근하여 회원 목록, 프로젝트 목록, 신고 내역, 차단 내역 등을 중앙에서 조회하고 제어
* **👁️ 운영 가시성 확보**
  * 월간/연간 이용자 증감, 최근 생성된 프로젝트, 최근 가입한 회원과 같은 핵심 통계 데이터를 실시간으로 연산하여 대시보드에 시각화

### 🤖 AI 서버(FastAPI) 연동 구조
서비스의 신뢰성을 보장하기 위해 **FastAPI(Python)** 기반의 AI 서버와 연동됩니다.

| 기능               | 통신 방식 | 설명                                                                                                                                                                                             |
|:-----------------| :--- |:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **AI 모델 정확도 조회** | `RestTemplate` <br> (GET) | AI (임베딩, 재정렬, 수락확률)모델의 최신 정확도 지표를 호출하여 모니터링합니다.<br>*(Target: `ai.fastapi.url.embedding, ai.fastapi.url.scorer, ai.fastapi.url.acceptor`)*                                                      |
| **파라미터 제어**      | `RestTemplate` <br> (POST) | 관리자가 LearningRate(학습 속도 결정)을 변경하면,이를 JSON 포맷으로 변환하여 AI 모델에 실시간으로 적용합니다. 파라미터 수정이 가능한 모델은 재정렬, 수락확률 두 모델입니다.<br>*(Target: `ai.fastapi.url.parameter.score, ai.fastapi.url.parameter.acceptor`)* |


## 3. 백엔드 개발환경

| Category | Tech Stack |
| :--- | :--- |
| **👅 Language** | ![Java 17](https://img.shields.io/badge/Java_17-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white) |
| **🏗️ Framework** | ![Spring Boot 3.5.6](https://img.shields.io/badge/Spring_Boot_3.5.6-6DB33F?style=for-the-badge&logo=spring-boot&logoColor=white) |
| **💾 Database & ORM** | ![MariaDB](https://img.shields.io/badge/MariaDB-003545?style=for-the-badge&logo=mariadb&logoColor=white) ![Spring Data JPA](https://img.shields.io/badge/Spring_Data_JPA-6DB33F?style=for-the-badge&logo=spring&logoColor=white) |
| **🔒 Security** | ![Spring Security](https://img.shields.io/badge/Spring_Security-6DB33F?style=for-the-badge&logo=spring-security&logoColor=white) ![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=json-web-tokens&logoColor=white) |
| **🖥️ IDE** | ![IntelliJ IDEA](https://img.shields.io/badge/IntelliJ_IDEA-000000.svg?style=for-the-badge&logo=intellij-idea&logoColor=white) |
| **🛠️ Tools & Infra** | ![Git](https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white) ![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white) ![Notion](https://img.shields.io/badge/Notion-000000?style=for-the-badge&logo=notion&logoColor=white) ![Postman](https://img.shields.io/badge/Postman-FF6C37?style=for-the-badge&logo=postman&logoColor=white) <br> ![Linux](https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black) ![MariaDB](https://img.shields.io/badge/MariaDB-003545?style=for-the-badge&logo=mariadb&logoColor=white) ![PuTTY](https://img.shields.io/badge/PuTTY-0000FC?style=for-the-badge&logo=putty&logoColor=white) ![Gradle](https://img.shields.io/badge/Gradle-02303A?style=for-the-badge&logo=gradle&logoColor=white) |


## 4. API 서버 실행 가이드
### 🚀 4.1 API 서버 실행 절차(Node.js 환경)
**Node.js (Parent)** 가 실행되면 **Spring Boot (Child)** 가 자동으로 구동됩니다. PM2를 사용하여 프로세스를 관리합니다.

| Action | Command | 설명 |
| :--- | :--- | :--- |
| **Start** | `pm2 start app.js` | 통합 서버 시작 (Node + Spring) |
| **Stop** | `pm2 stop app` | 서버 일시 중지 |
| **Delete** | `pm2 delete app` | 프로세스 삭제 및 초기화 |
| **Logs** | `pm2 logs` | 실시간 로그 확인 (디버깅용) |

### ☕ 4.2 API 서버 실행 절차(Spring Boot 환경)
Spring Boot 서버만 단독적으로 실행할 경우 절차는 아래와 같습니다. application.properties은 로컬 환경에서 사용한 설정이므로 서버 환경에 맞춘 설정인
application-prod.properties을 사용해야 합니다.

**📦 실행 파일 생성(JAR 빌드)**
> ./gradlew clean build -x test

**🔥 서버 실행**
>cd build/libs

>java -jar admin-server-0.0.1-SNAPSHOT.jar --spring.profiles.active=prod


## 📋 5. API 기능 명세
관리자 시스템은 크게 5가지 핵심 모듈로 구성되어 있으며, 각 모듈별로 특화된 API를 제공합니다.

| 모듈  | 기능           | 세부 내용 |
| :--- |:-------------| :--- |
| **🔐 인증** | **관리자 로그인**  | • 아이디/비밀번호 기반 JWT 토큰 발급<br>• 로그아웃 (토큰 무효화) |
| **📊 대시보드** | **핵심 지표 조회** | • 월간/연간 이용자 증감 추이 분석<br>• 최근 생성된 프로젝트 및 가입자 현황 |
| **🛡️ 회원 관리** | **유저 제어**    | • 전체 회원 목록 조회<br>• 신고 내역 확인 및 블랙리스트(차단) 처리<br>• 차단된 회원 목록 별도 관리 |
| **📦 콘텐츠 관리** | **게시글 관리**   | • 프로젝트 목록 조회 및 삭제<br>• 공모전 정보 등록/조회/삭제 |
| **🧠 AI 관리** | **모델 모니터링**  | • 3종 모델(임베딩, 재정렬, 수락확률) 정확도 조회<br>• 재정렬 및 수락 확률 모델의 학습률(Learning Rate) 실시간 조정 |

### 🔌 관리자 시스템 REST API 정의
#### 🔐 관리자 인증 & Dashboard
| Method | Endpoint         | Description |
| :--- |:-----------------| :--- |
| `POST` | **/admin/login** | 관리자 로그인 (JWT 발급) |
| `POST` | **/admin/logout**      | 로그아웃 |
| `GET` | **/admin/dashboard**   | 메인 대시보드 통계 데이터 조회 |

#### 👥 회원 관리 기능
| Method | Endpoint                              | Description            |
|:-------|:--------------------------------------|:-----------------------|
| `GET`  | **/admin/users**                      | 전체 회원 목록 조회 (Paging)   |
| `GET`  | **/admin/reports**                    | 전체 신고 내역 조회            |
| `GET`  | **/admin/banned-users**               | 블랙리스트(차단된 회원) 목록 조회    |
| `PUT`  | **/admin/users/{userId}/status**      | 회원 상태 변경 (블랙리스트 등록/해제) |
| `PUT`  | **/admin/reports/{reportsId}/status** | 특정 신고 건에 대한 처리 상태 변경   |

#### 🗂️콘텐츠 관리
| Method | Endpoint                        | Description   |
| :--- |:--------------------------------|:--------------|
| `GET` | **/admin/projects**             | 전체 프로젝트 목록 조회 |
| `DELETE` | **/admin/projects/{projectId}** | 특정 프로젝트 삭제    |
| `POST` | **/admin/contests**             | 신규 공모전 정보 등록  |
| `GET` | **/admin/contests**             | 전체 공모전 리스트 조회 |
| `DELETE` | **/admin/contests/{contestId}** | 특정 공모전 삭제     |

### 🤖 AI 관리
| Method | Endpoint | Description                     |
| :--- | :--- |:--------------------------------|
| `GET` | **/admin/ai-model** | 3종 AI 모델(임베딩, 재정렬, 수락확률) 정확도 조회 |
| `PUT` | **/admin/ai-model/parameter/score** | 재정렬 모델 Learning Rate 파라미터 수정    |
| `PUT` | **/admin/ai-model/parameter/acceptor** | 수락 확률 모델 Learning Rate 파라미터 수정  |

