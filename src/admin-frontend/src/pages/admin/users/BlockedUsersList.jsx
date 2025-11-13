import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBannedUsers, unbanUser, fetchUserReportDetail } from '../../../utils/api';
import Pagination from './Pagination';

const BlockedUsersList = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  
  // 모달 관련 상태
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [userReports, setUserReports] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadBlockedUsers(currentPage);
  }, [currentPage]);

  const loadBlockedUsers = async (page) => {
    setLoading(true);
    
    try {
      // 백엔드는 페이지를 0부터 시작하므로 -1
      const result = await fetchBannedUsers(page - 1, 10);
      
      if (result.resultCode === 200) {
        setUsers(result.data.users);
        setTotalElements(result.data.totalElements);
        setTotalPages(result.data.totalPages);
      } else {
        console.error('차단된 회원 조회 실패:', result.successMessage);
      }
    } catch (error) {
      console.error('차단된 회원 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMoreClick = async (user) => {
    setSelectedUser(user);
    setShowModal(true);
    setLoadingDetails(true);
    
    // 사용자 신고 내역 로드 (userId 사용)
    try {
      const result = await fetchUserReportDetail(user.userId);
      console.log('차단된 회원 신고 내역:', result);
      
      // 백엔드 응답 성공
      if (result.resultCode === 200 && result.data && result.data.reports) {
        setUserReports(result.data.reports);
      } 
      // MOCK API 응답
      else if (result.success && result.data && result.data.reports) {
        setUserReports(result.data.reports);
      } 
      // API 없음 (404) - 신고 내역 없음으로 처리
      else if (result.status === 404) {
        console.warn('⚠️ 신고 내역 API 없음 (404)');
        setUserReports([]);
      } else {
        console.warn('신고 내역 조회 실패');
        setUserReports([]);
      }
    } catch (error) {
      console.error('신고 내역 로드 실패:', error);
      setUserReports([]);
    } finally {
      setLoadingDetails(false);
    }
  };
  
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setUserReports([]);
  };
  
  const handleUnblock = async () => {
    if (!window.confirm('정말로 이 회원의 차단을 해제하시겠습니까?')) {
      return;
    }

    try {
      // userId 사용
      const result = await unbanUser(selectedUser.userId);
      
      if (result.resultCode === 200) {
        alert(result.successMessage || '차단이 해제되었습니다.');
        handleCloseModal();
        // 목록 새로고침
        loadBlockedUsers(currentPage);
      } else {
        alert(result.successMessage || '차단 해제에 실패했습니다.');
      }
    } catch (error) {
      console.error('차단 해제 실패:', error);
      alert('차단 해제에 실패했습니다.');
    }
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
    return <div className="loading">로딩 중...</div>;
  }

  if (users.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🚫</div>
        <p>차단된 회원이 없습니다.</p>
      </div>
    );
  }

  return (
    <div>
      <table className="users-table">
        <thead>
          <tr>
            <th>이름</th>
            <th>닉네임</th>
            <th>차단일자</th>
            <th>차단사유</th>
            <th>신고정보</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => (
            <tr key={`${user.nickName}-${user.name}-${index}`}>
              <td>{user.name}</td>
              <td>{user.nickName}</td>
              <td>{formatDateTime(user.updatedAt)}</td>
              <td>{user.reason}</td>
              <td>
                <button
                  className="more-button"
                  onClick={() => handleMoreClick(user)}
                >
                  더보기
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
      
      {/* 차단 회원 상세 모달 */}
      {showModal && selectedUser && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>차단 회원 상세 정보</h3>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>
            
            <div className="modal-body">
              {loadingDetails ? (
                <div className="loading">신고 내역 로딩 중...</div>
              ) : (
                <>
                  {/* 회원 정보 */}
                  <div className="user-status-section">
                    <div className="detail-row">
                      <span className="detail-label">회원명:</span>
                      <span className="detail-value">{selectedUser.name} ({selectedUser.nickName})</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">차단 일시:</span>
                      <span className="detail-value">{formatDateTime(selectedUser.updatedAt)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">차단 사유:</span>
                      <span className="detail-value">{selectedUser.reason}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">회원 상태:</span>
                      <span className="detail-value">
                        <span className="status-badge status-banned">차단됨</span>
                      </span>
                    </div>
                  </div>
                  
                  {/* 신고 내역 */}
                  <div className="report-detail-section">
                    <h4>받은 신고 내역 ({userReports.length}건)</h4>
                    {userReports.length > 0 ? (
                      userReports.map((report, index) => (
                        <div key={index} className="report-card">
                          <div className="detail-row">
                            <span className="detail-label">신고자:</span>
                            <span className="detail-value">{report.reporterName}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">신고 사유:</span>
                            <span className="detail-value">{report.reason}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">신고 일시:</span>
                            <span className="detail-value">{formatDateTime(report.createdAt)}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">처리 상태:</span>
                            <span className="detail-value">
                              <span className={`status-badge status-${report.status}`}>
                                {report.status === 'resolved' ? '처리완료' : '대기중'}
                              </span>
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="info-message" style={{marginTop: '12px'}}>
                        ℹ️ 신고 내역이 없거나 조회할 수 없습니다.
                      </div>
                    )}
                  </div>
                  
                  {/* 차단 해제 */}
                  <div className="modal-actions">
                    <h4>회원 관리</h4>
                    <button className="btn-unblock" onClick={handleUnblock}>
                      차단 해제
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockedUsersList;

