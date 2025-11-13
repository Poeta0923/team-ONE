import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../../components/AdminLayout';
import { fetchUserReportDetail, banUser, unbanUser, updateReportStatus } from '../../../utils/api';
import './ReportDetailPage.css';

const ReportDetailPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  
  const [reports, setReports] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blockReason, setBlockReason] = useState('');
  const [showBlockInput, setShowBlockInput] = useState(false);

  useEffect(() => {
    loadUserReports();
  }, [userId]);

  const loadUserReports = async () => {
    setLoading(true);
    
    try {
      const result = await fetchUserReportDetail(userId);
      
      if (result.success) {
        setUserInfo(result.data.user);
        setReports(result.data.reports);
      } else {
        console.error('신고 내역 조회 실패');
      }
    } catch (error) {
      console.error('신고 내역 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!blockReason.trim()) {
      alert('차단 사유를 입력해주세요.');
      return;
    }

    if (!confirm('정말로 이 회원을 차단하시겠습니까?')) {
      return;
    }

    try {
      const result = await banUser(userId, blockReason);
      
      if (result.resultCode === 200) {
        alert(result.successMessage || '회원이 차단되었습니다.');
        setUserInfo({ ...userInfo, status: 'banned' });
        setShowBlockInput(false);
        setBlockReason('');
      } else {
        alert(result.successMessage || '회원 차단에 실패했습니다.');
      }
    } catch (error) {
      console.error('회원 차단 실패:', error);
      alert('회원 차단에 실패했습니다.');
    }
  };

  const handleUnblock = async () => {
    if (!confirm('정말로 이 회원의 차단을 해제하시겠습니까?')) {
      return;
    }

    try {
      const result = await unbanUser(userId);
      
      if (result.resultCode === 200) {
        alert(result.successMessage || '차단이 해제되었습니다.');
        setUserInfo({ ...userInfo, status: 'active' });
      } else {
        alert(result.successMessage || '차단 해제에 실패했습니다.');
      }
    } catch (error) {
      console.error('차단 해제 실패:', error);
      alert('차단 해제에 실패했습니다.');
    }
  };

  const handleReportStatusChange = async (reportId, newStatus) => {
    try {
      const result = await updateReportStatus(reportId, newStatus);
      
      if (result.resultCode === 200) {
        alert(result.successMessage || '신고 상태가 변경되었습니다.');
        // 신고 목록 업데이트
        setReports(reports.map(report => 
          report.id === reportId ? { ...report, status: newStatus } : report
        ));
      } else {
        alert(result.successMessage || '신고 상태 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('신고 상태 변경 실패:', error);
      alert('신고 상태 변경에 실패했습니다.');
    }
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

        <div className="user-info-section">
          <h3>회원 정보</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">이메일:</span>
              <span className="info-value">{userInfo?.email}</span>
            </div>
            <div className="info-item">
              <span className="info-label">전화번호:</span>
              <span className="info-value">{userInfo?.phoneNumber || '정보 없음'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">사용자명:</span>
              <span className="info-value">{userInfo?.username}</span>
            </div>
            <div className="info-item">
              <span className="info-label">가입일:</span>
              <span className="info-value">{userInfo?.createdAt}</span>
            </div>
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
                    <span className="report-value report-reason">{report.reason}</span>
                  </div>
                  {report.description && (
                    <div className="report-row report-description-row">
                      <span className="report-label">상세 내용:</span>
                      <span className="report-value report-description">{report.description}</span>
                    </div>
                  )}
                  <div className="report-row">
                    <span className="report-label">신고 일시:</span>
                    <span className="report-value">{formatDateTime(report.createdAt)}</span>
                  </div>
                  <div className="report-row">
                    <span className="report-label">처리 상태:</span>
                    <span className="report-value">
                      <span className={`report-status-badge ${report.status === 'resolved' ? 'status-resolved' : 'status-pending'}`}>
                        {report.status === 'resolved' ? '처리완료' : '대기중'}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="report-actions">
                  {report.status === 'pending' ? (
                    <button 
                      className="resolve-report-button" 
                      onClick={() => handleReportStatusChange(report.id, 'resolved')}
                    >
                      처리 완료로 변경
                    </button>
                  ) : (
                    <button 
                      className="reopen-report-button" 
                      onClick={() => handleReportStatusChange(report.id, 'pending')}
                    >
                      대기중으로 변경
                    </button>
                  )}
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

