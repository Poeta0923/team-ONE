import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBlockedUsers } from '../../../utils/api';
import Pagination from './Pagination';

const BlockedUsersList = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  useEffect(() => {
    loadBlockedUsers(currentPage);
  }, [currentPage]);

  const loadBlockedUsers = async (page) => {
    setLoading(true);
    
    try {
      const result = await fetchBlockedUsers(page, 10);
      
      if (result.success) {
        setUsers(result.data);
        setTotalElements(result.total);
        setTotalPages(Math.ceil(result.total / 10));
      } else {
        console.error('차단된 회원 조회 실패');
      }
    } catch (error) {
      console.error('차단된 회원 조회 실패:', error);
    } finally {
      setLoading(false);
    }
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

