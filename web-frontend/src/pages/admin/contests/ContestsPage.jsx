import React from 'react';
import AdminLayout from '../../../components/AdminLayout';
import './ContestsPage.css';

const ContestsPage = () => {
  return (
    <AdminLayout>
      <div className="contests-content">
        <div className="content-header">
          <h2>공모전 관리</h2>
          <button className="btn btn-primary">새 공모전 등록</button>
        </div>
        
        <div className="contests-grid">
          <div className="contest-card">
            <div className="contest-header">
              <h3>2024 해커톤 대회</h3>
              <span className="contest-status ongoing">진행중</span>
            </div>
            <p className="contest-description">24시간 동안 진행되는 해커톤 대회입니다.</p>
            <div className="contest-meta">
              <span className="contest-date">📅 2024-03-15 ~ 2024-03-16</span>
              <span className="contest-participants">👥 참가팀: 15팀</span>
            </div>
            <div className="contest-actions">
              <button className="btn-small btn-outline">수정</button>
              <button className="btn-small btn-primary">상세보기</button>
            </div>
          </div>

          <div className="contest-card">
            <div className="contest-header">
              <h3>AI 아이디어 공모전</h3>
              <span className="contest-status upcoming">예정</span>
            </div>
            <p className="contest-description">AI를 활용한 혁신적인 아이디어를 제안하는 공모전입니다.</p>
            <div className="contest-meta">
              <span className="contest-date">📅 2024-04-01 ~ 2024-04-30</span>
              <span className="contest-participants">👥 참가팀: 0팀</span>
            </div>
            <div className="contest-actions">
              <button className="btn-small btn-outline">수정</button>
              <button className="btn-small btn-primary">상세보기</button>
            </div>
          </div>

          <div className="contest-card">
            <div className="contest-header">
              <h3>웹 개발 챌린지</h3>
              <span className="contest-status completed">완료</span>
            </div>
            <p className="contest-description">React를 사용한 웹 애플리케이션 개발 챌린지입니다.</p>
            <div className="contest-meta">
              <span className="contest-date">📅 2024-02-01 ~ 2024-02-28</span>
              <span className="contest-participants">👥 참가팀: 8팀</span>
            </div>
            <div className="contest-actions">
              <button className="btn-small btn-outline">수정</button>
              <button className="btn-small btn-primary">상세보기</button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default ContestsPage;
