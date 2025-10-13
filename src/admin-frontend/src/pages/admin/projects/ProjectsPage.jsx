import React from 'react';
import AdminLayout from '../../../components/AdminLayout';
import './ProjectsPage.css';

const ProjectsPage = () => {
  return (
    <AdminLayout>
      <div className="projects-content">
        <div className="content-header">
          <h2>프로젝트 관리</h2>
          <button className="btn btn-primary">새 프로젝트 생성</button>
        </div>
        
        <div className="projects-grid">
          <div className="project-card">
            <div className="project-header">
              <h3>웹 포트폴리오 사이트</h3>
              <span className="project-status active">진행중</span>
            </div>
            <p className="project-description">개발자 포트폴리오를 위한 반응형 웹사이트 개발 프로젝트</p>
            <div className="project-meta">
              <span className="project-team">팀원: 3명</span>
              <span className="project-deadline">마감: 2024-03-15</span>
            </div>
            <div className="project-actions">
              <button className="btn-small btn-outline">수정</button>
              <button className="btn-small btn-primary">상세보기</button>
            </div>
          </div>

          <div className="project-card">
            <div className="project-header">
              <h3>모바일 앱 개발</h3>
              <span className="project-status completed">완료</span>
            </div>
            <p className="project-description">React Native를 사용한 크로스 플랫폼 모바일 앱 개발</p>
            <div className="project-meta">
              <span className="project-team">팀원: 4명</span>
              <span className="project-deadline">완료: 2024-02-28</span>
            </div>
            <div className="project-actions">
              <button className="btn-small btn-outline">수정</button>
              <button className="btn-small btn-primary">상세보기</button>
            </div>
          </div>

          <div className="project-card">
            <div className="project-header">
              <h3>AI 챗봇 서비스</h3>
              <span className="project-status planning">기획중</span>
            </div>
            <p className="project-description">고객 서비스를 위한 AI 기반 챗봇 시스템 구축</p>
            <div className="project-meta">
              <span className="project-team">팀원: 5명</span>
              <span className="project-deadline">시작: 2024-03-01</span>
            </div>
            <div className="project-actions">
              <button className="btn-small btn-outline">수정</button>
              <button className="btn-small btn-primary">상세보기</button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default ProjectsPage;
