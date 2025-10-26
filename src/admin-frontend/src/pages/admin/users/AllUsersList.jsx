import React, { useState, useEffect } from 'react';
import { fetchAllUsers } from '../../../utils/api';
import Pagination from './Pagination';

const AllUsersList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  useEffect(() => {
    loadUsers(currentPage);
  }, [currentPage]);

  const loadUsers = async (page) => {
    setLoading(true);
    
    try {
      const result = await fetchAllUsers(page, 10);
      
      if (result.success) {
        setUsers(result.data);
        setTotalElements(result.total);
        // 페이지 계산 (총 개수 / 페이지당 개수)
        setTotalPages(Math.ceil(result.total / 10));
      } else {
        console.error('전체 회원 조회 실패');
      }
    } catch (error) {
      console.error('전체 회원 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  if (users.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">👥</div>
        <p>등록된 회원이 없습니다.</p>
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
            <th>주요스택</th>
            <th>전화번호</th>
            <th>생일</th>
            <th>거주지</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.nickName}</td>
              <td>{user.techStack}</td>
              <td>{user.phoneNumber}</td>
              <td>{user.birth}</td>
              <td>{user.address}</td>
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

export default AllUsersList;

