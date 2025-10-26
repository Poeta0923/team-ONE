import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../../components/AdminLayout';
import { API_ENDPOINTS, getAuthHeaders } from '../../../utils/api';
import './ReportDetailPage.css';

const ReportDetailPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  
  const [reports, setReports] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blockReason, setBlockReason] = useState('');
  const [showBlockInput, setShowBlockInput] = useState(false);

  // TODO: 여기에 API 필요합니다 - 특정 회원의 신고 내역 조회 API
  useEffect(() => {
    fetchUserReports();
  }, [userId]);

  const fetchUserReports = async () => {
    setLoading(true);
    
    // 임시 데이터
    setTimeout(() => {
      setUserInfo({
        userId: userId,
        name: '김철수',
        nickName: '코딩마스터',
        status: 'active' // active, banned
      });

      setReports([
        {
          id: 1,
          reporterName: '홍길동',
          reason: '시간 약속을 안 지킴',
          createdAt: '2025-09-30T14:00:00Z'
        },
        {
          id: 2,
          reporterName: '박영희',
          reason: '욕설 및 비방',
          createdAt: '2025-09-29T10:30:00Z'
        },
        {
          id: 3,
          reporterName: '이민수',
          reason: '프로젝트 무단 이탈',
          createdAt: '2025-09-28T16:20:00Z'
        }
      ]);

      setLoading(false);
    }, 500);

    /* 실제 API 호출 예시
    try {
      const response = await fetch(API_ENDPOINTS.USER_REPORT_DETAIL(userId), {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      const data = await response.json();
      
      if (data.result_code === 200) {
        setUserInfo(data.data.user);
        setReports(data.data.reports);
      } else {
        console.error('신고 내역 조회 실패');
      }
      setLoading(false);
    } catch (error) {
      console.error('신고 내역 조회 실패:', error);
      setLoading(false);
    }
    */
  };

  // TODO: 여기에 API 필요합니다 - 회원 차단 API
  const handleBlock = async () => {
    if (!blockReason.trim()) {
      alert('차단 사유를 입력해주세요.');
      return;
    }

    if (!confirm('정말로 이 회원을 차단하시겠습니까?')) {
      return;
    }

    // 임시 처리
    alert('회원이 차단되었습니다.');
    setUserInfo({ ...userInfo, status: 'banned' });
    setShowBlockInput(false);
    setBlockReason('');

    /* 실제 API 호출 예시
    try {
      const response = await fetch(API_ENDPOINTS.USER_BAN(userId), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: 'banned',
          reason: blockReason
        })
      });
      
      const data = await response.json();
      
      if (data.result_code === 200) {
        alert(data.successMessage || '회원이 차단되었습니다.');
        setUserInfo({ ...userInfo, status: 'banned' });
        setShowBlockInput(false);
        setBlockReason('');
      } else {
        alert(data.errorMessage || '회원 차단에 실패했습니다.');
      }
    } catch (error) {
      console.error('회원 차단 실패:', error);
      alert('회원 차단에 실패했습니다.');
    }
    */
  };

  // TODO: 여기에 API 필요합니다 - 회원 차단 해제 API
  const handleUnblock = async () => {
    if (!confirm('정말로 이 회원의 차단을 해제하시겠습니까?')) {
      return;
    }

    // 임시 처리
    alert('차단이 해제되었습니다.');
    setUserInfo({ ...userInfo, status: 'active' });

    /* 실제 API 호출 예시
    try {
      const response = await fetch(API_ENDPOINTS.USER_UNBAN(userId), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: 'active'
        })
      });
      
      const data = await response.json();
      
      if (data.result_code === 200) {
        alert(data.successMessage || '차단이 해제되었습니다.');
        setUserInfo({ ...userInfo, status: 'active' });
      } else {
        alert(data.errorMessage || '차단 해제에 실패했습니다.');
      }
    } catch (error) {
      console.error('차단 해제 실패:', error);
      alert('차단 해제에 실패했습니다.');
    }
    */
  };

  const handleBack = () => {
    navigate('/admin/users');
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="report-detail-page">
          <div className="loading">로딩 중...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="report-detail-page">
        <div className="detail-header">
          <h2>신고 관리 상세</h2>
          <div className="user-status">
            <span className="user-name">{userInfo?.name} ({userInfo?.nickName})</span>
            <span className={`status-badge ${userInfo?.status === 'banned' ? 'status-banned' : 'status-active'}`}>
              {userInfo?.status === 'banned' ? '차단됨' : '활성'}
            </span>
          </div>
        </div>

        <div className="reports-section">
          <h3>받은 신고 내역 ({reports.length}건)</h3>
          <div className="reports-list">
            {reports.map(report => (
              <div key={report.id} className="report-card">
                <div className="report-info">
                  <div className="report-row">
                    <span className="report-label">신고자:</span>
                    <span className="report-value">{report.reporterName}</span>
                  </div>
                  <div className="report-row">
                    <span className="report-label">신고 사유:</span>
                    <span className="report-value">{report.reason}</span>
                  </div>
                  <div className="report-row">
                    <span className="report-label">신고 시간:</span>
                    <span className="report-value">{formatDateTime(report.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="action-section">
          <h3>회원 관리</h3>
          
          {userInfo?.status === 'banned' ? (
            <div className="action-group">
              <button className="unblock-button" onClick={handleUnblock}>
                차단 해제
              </button>
            </div>
          ) : (
            <div className="action-group">
              {!showBlockInput ? (
                <button className="block-button" onClick={() => setShowBlockInput(true)}>
                  회원 차단
                </button>
              ) : (
                <div className="block-input-group">
                  <textarea
                    className="block-reason-input"
                    placeholder="차단 사유를 입력하세요..."
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    rows={3}
                  />
                  <div className="block-buttons">
                    <button className="confirm-block-button" onClick={handleBlock}>
                      차단 확정
                    </button>
                    <button className="cancel-button" onClick={() => {
                      setShowBlockInput(false);
                      setBlockReason('');
                    }}>
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="detail-footer">
          <button className="back-button" onClick={handleBack}>
            뒤로가기
          </button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default ReportDetailPage;

