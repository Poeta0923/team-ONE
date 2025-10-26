import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_ENDPOINTS, getAuthHeaders } from '../../../utils/api';
import Pagination from './Pagination';

const BlockedUsersList = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  // TODO: 여기에 API 필요합니다 - 차단된 회원 목록 조회 API
  useEffect(() => {
    fetchBlockedUsers(currentPage);
  }, [currentPage]);

  const fetchBlockedUsers = async (page) => {
    setLoading(true);
    
    // 임시 데이터
    setTimeout(() => {
      const mockUsers = Array.from({ length: 10 }, (_, index) => ({
        userId: (page - 1) * 10 + index + 1,
        name: `김OO${(page - 1) * 10 + index + 1}`,
        nickName: `닉네임${(page - 1) * 10 + index + 1}`,
        status: 'banned',
        reason: '반복적인 신고 접수로 인한 계정 차단',
        updatedAt: '2025-10-02T20:00:00Z'
      }));

      setUsers(mockUsers);
      setTotalPages(1);
      setTotalElements(10);
      setLoading(false);
    }, 500);

    /* 실제 API 호출 예시
    try {
      const response = await fetch(`${API_ENDPOINTS.USERS_BLOCKED}?page=${page}&size=10`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      const data = await response.json();
      
      if (data.result_code === 200) {
        setUsers(data.data.users);
        setTotalPages(data.data.totalPages);
        setTotalElements(data.data.totalElements);
      } else {
        console.error('차단된 회원 조회 실패');
      }
      setLoading(false);
    } catch (error) {
      console.error('차단된 회원 조회 실패:', error);
      setLoading(false);
    }
    */
  };

  const handleMoreClick = (userId) => {
    navigate(`/admin/users/report-detail/${userId}`);
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
          {users.map(user => (
            <tr key={user.userId}>
              <td>{user.name}</td>
              <td>{user.nickName}</td>
              <td>{formatDateTime(user.updatedAt)}</td>
              <td>{user.reason}</td>
              <td>
                <button
                  className="more-button"
                  onClick={() => handleMoreClick(user.userId)}
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
    </div>
  );
};

export default BlockedUsersList;

