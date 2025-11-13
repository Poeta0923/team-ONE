import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import AdminLayout from '../../../components/AdminLayout';
import { fetchDashboard } from '../../../utils/api';
import './DashboardPage.css';

const DashboardPage = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetchDashboard();
      
      if (response.resultCode === 200) {
        setDashboardData(response.data);
      } else {
        setError(response.successMessage || '대시보드 데이터를 불러오는데 실패했습니다.');
      }
    } catch (err) {
      setError('대시보드 데이터를 불러오는 중 오류가 발생했습니다.');
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const renderDashboard = () => {
    if (loading) {
      return (
        <div className="dashboard-content">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>대시보드 데이터를 불러오는 중...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="dashboard-content">
          <div className="error-container">
            <p>{error}</p>
            <button onClick={loadDashboardData} className="retry-button">다시 시도</button>
          </div>
        </div>
      );
    }

    if (!dashboardData) {
      return (
        <div className="dashboard-content">
          <div className="empty-container">
            <p>대시보드 데이터가 없습니다.</p>
          </div>
        </div>
      );
    }

    // 월별 데이터 변환 (월 이름 추가)
    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    const monthlyData = dashboardData.monthlyUserGrowth.map(item => ({
      ...item,
      monthName: monthNames[item.month - 1],
      전체회원: item.totalUserCount,
      프로젝트참여자: item.projectParticipantCount
    }));

    // 연간 데이터 변환
    const annualData = dashboardData.annualUserGrowth.map(item => ({
      ...item,
      yearName: `${item.year}년`,
      전체회원: item.totalUserCount
    }));

    return (
      <div className="dashboard-content">
        {/* 월간 이용자 증감 */}
        <div className="dashboard-section">
          <div className="section-header">
            <h3>월간 이용자 증감</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monthName" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="전체회원" stroke="#ff6b35" strokeWidth={2} />
                <Line type="monotone" dataKey="프로젝트참여자" stroke="#f7931e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 최근 생성된 프로젝트 */}
        <div className="dashboard-section">
          <div className="section-header">
            <h3>최근 생성된 프로젝트</h3>
            <a href="/admin/projects" className="view-all-link">전체보기</a>
          </div>
          <div className="list-container">
            {dashboardData.recentProjects.map(project => (
              <div key={project.projectId} className="list-item">
                <div className="item-info">
                  <h4>{project.name}</h4>
                  <p>프로젝트 ID: {project.projectId}</p>
                </div>
                <span className={`status-badge ${project.statement === '진행중' ? 'active' : project.statement === '완료' ? 'completed' : 'planning'}`}>
                  {project.statement}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 최근 가입한 회원 */}
        <div className="dashboard-section">
          <div className="section-header">
            <h3>최근 가입한 회원</h3>
            <a href="/admin/users" className="view-all-link">전체보기</a>
          </div>
          <div className="user-cards-container">
            {dashboardData.recentUsers.slice(0, 6).map(user => (
              <div key={user.userId} className="user-card">
                <div className="user-avatar">
                  {user.name.charAt(0)}
                </div>
                <div className="user-info">
                  <h4 className="user-name">{user.name}</h4>
                  <p className="user-date">{formatDate(user.date)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 연간 이용자 증감 */}
        <div className="dashboard-section">
          <div className="section-header">
            <h3>연간 이용자 증감</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={annualData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="yearName" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="전체회원" fill="#ff6b35" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      {renderDashboard()}
    </AdminLayout>
  );
};

export default DashboardPage;
