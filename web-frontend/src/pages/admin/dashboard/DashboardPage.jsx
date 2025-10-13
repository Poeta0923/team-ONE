import React from 'react';
import AdminLayout from '../../../components/AdminLayout';
import './DashboardPage.css';

const DashboardPage = () => {
  // TODO: API 연동 시 삭제될 임시 데이터
  const tempData = {
    monthlyUsers: {
      current: 1234,
      previous: 1100,
      change: 12.2
    },
    recentProjects: [
      { id: 1, name: '웹 포트폴리오 사이트', creator: '김개발', date: '2024-03-15', status: '진행중' },
      { id: 2, name: '모바일 앱 개발', creator: '이백엔드', date: '2024-03-14', status: '완료' },
      { id: 3, name: 'AI 챗봇 서비스', creator: '박디자인', date: '2024-03-13', status: '기획중' },
      { id: 4, name: '데이터 분석 도구', creator: '최프론트', date: '2024-03-12', status: '진행중' },
      { id: 5, name: '클라우드 마이그레이션', creator: '정데브옵스', date: '2024-03-11', status: '완료' }
    ],
    recentUsers: [
      { id: 1, name: '홍길동', role: '백엔드 개발자', joinDate: '2024-03-15' },
      { id: 2, name: '김철수', role: '프론트엔드 개발자', joinDate: '2024-03-14' },
      { id: 3, name: '이영희', role: 'UI/UX 디자이너', joinDate: '2024-03-13' },
      { id: 4, name: '박민수', role: '데이터 분석가', joinDate: '2024-03-12' },
      { id: 5, name: '최지영', role: 'DevOps 엔지니어', joinDate: '2024-03-11' },
      { id: 6, name: '정수현', role: 'AI 개발자', joinDate: '2024-03-10' },
      { id: 7, name: '한지민', role: '프론트엔드 개발자', joinDate: '2024-03-09' },
      { id: 8, name: '윤성호', role: '백엔드 개발자', joinDate: '2024-03-08' }
    ],
    yearlyUsers: {
      data: [
        { month: '1월', users: 800 },
        { month: '2월', users: 950 },
        { month: '3월', users: 1100 },
        { month: '4월', users: 1200 },
        { month: '5월', users: 1300 },
        { month: '6월', users: 1400 },
        { month: '7월', users: 1350 },
        { month: '8월', users: 1450 },
        { month: '9월', users: 1500 },
        { month: '10월', users: 1600 },
        { month: '11월', users: 1700 },
        { month: '12월', users: 1800 }
      ]
    }
  };

  const renderDashboard = () => (
    <div className="dashboard-content">
      {/* 1. 월간 이용자 증감 (그래프) */}
      <div className="dashboard-section">
        <div className="section-header">
          <h3>월간 이용자 증감</h3>
          <div className="change-indicator positive">
            <span className="change-icon">📈</span>
            <span className="change-text">+{tempData.monthlyUsers.change}%</span>
          </div>
        </div>
        <div className="chart-container">
          <div className="chart-placeholder">
            {/* TODO: API 연동 시 Chart.js 또는 Recharts로 교체 */}
            <p>월간 이용자 증감 차트 (Chart.js/Recharts 사용 예정)</p>
            <div className="temp-chart">
              <div className="chart-bar" style={{height: '60%'}}></div>
              <div className="chart-bar" style={{height: '80%'}}></div>
              <div className="chart-bar" style={{height: '100%'}}></div>
              <div className="chart-bar" style={{height: '70%'}}></div>
              <div className="chart-bar" style={{height: '90%'}}></div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 최근 생성된 프로젝트 */}
      <div className="dashboard-section">
        <div className="section-header">
          <h3>최근 생성된 프로젝트</h3>
          <a href="/admin/projects" className="view-all-link">전체보기</a>
        </div>
        <div className="list-container">
          {/* TODO: API 연동 시 tempData.recentProjects를 실제 API 데이터로 교체 */}
          {tempData.recentProjects.slice(0, 4).map(project => (
            <div key={project.id} className="list-item">
              <div className="item-info">
                <h4>{project.name}</h4>
                <p>생성자: {project.creator} | {project.date}</p>
              </div>
              <span className={`status-badge ${project.status === '진행중' ? 'active' : project.status === '완료' ? 'completed' : 'planning'}`}>
                {project.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. 최근 가입한 회원 */}
      <div className="dashboard-section">
        <div className="section-header">
          <h3>최근 가입한 회원</h3>
          <a href="/admin/users" className="view-all-link">전체보기</a>
        </div>
        <div className="user-cards-container">
          {/* TODO: API 연동 시 tempData.recentUsers를 실제 API 데이터로 교체 */}
          {tempData.recentUsers.slice(0, 4).map(user => (
            <div key={user.id} className="user-card">
              <div className="user-avatar">
                {user.name.charAt(0)}
              </div>
              <div className="user-info">
                <h4 className="user-name">{user.name}</h4>
                <p className="user-role">{user.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. 연간 이용자 증감 (그래프) */}
      <div className="dashboard-section">
        <div className="section-header">
          <h3>연간 이용자 증감</h3>
          <div className="change-indicator positive">
            <span className="change-icon">📈</span>
            <span className="change-text">+25.5%</span>
          </div>
        </div>
        <div className="chart-container">
          <div className="chart-placeholder">
            {/* TODO: API 연동 시 Chart.js 또는 Recharts로 교체 */}
            <p>연간 이용자 증감 차트 (Chart.js/Recharts 사용 예정)</p>
            <div className="temp-chart">
              {tempData.yearlyUsers.data.map((item, index) => (
                <div key={index} className="chart-bar" style={{height: `${(item.users / 2000) * 100}%`}}></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <AdminLayout>
      {renderDashboard()}
    </AdminLayout>
  );
};

export default DashboardPage;
