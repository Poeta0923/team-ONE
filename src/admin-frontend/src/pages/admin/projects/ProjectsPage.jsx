import React, { useState, useEffect } from 'react';
import AdminLayout from '../../../components/AdminLayout';
import Pagination from '../users/Pagination';
import { API_ENDPOINTS, getAuthHeaders } from '../../../utils/api';
import './ProjectsPage.css';

const ProjectsPage = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  // TODO: 여기에 API 필요합니다 - 프로젝트 목록 조회 API
  useEffect(() => {
    fetchProjects(currentPage);
  }, [currentPage]);

  const fetchProjects = async (page) => {
    setLoading(true);
    
    // 임시 데이터
    setTimeout(() => {
      const mockProjects = [
        {
          projectId: 1,
          name: '웹 포트폴리오 사이트',
          type: '웹개발',
          category: 'IT',
          statement: '진행중',
          date: '2025-09-30T14:00:00Z'
        },
        {
          projectId: 2,
          name: '모바일 앱 개발',
          type: '앱개발',
          category: 'IT',
          statement: '완료',
          date: '2025-09-29T10:20:00Z'
        },
        {
          projectId: 3,
          name: 'AI 챗봇 서비스',
          type: '웹개발',
          category: 'IT',
          statement: '진행중',
          date: '2025-09-28T15:30:00Z'
        },
        {
          projectId: 4,
          name: '이커머스 플랫폼',
          type: '웹개발',
          category: '비즈니스',
          statement: '진행중',
          date: '2025-09-27T11:00:00Z'
        },
        {
          projectId: 5,
          name: '헬스케어 앱',
          type: '앱개발',
          category: '헬스',
          statement: '대기',
          date: '2025-09-26T09:15:00Z'
        },
        {
          projectId: 6,
          name: '게임 개발 프로젝트',
          type: '게임개발',
          category: '엔터테인먼트',
          statement: '진행중',
          date: '2025-09-25T16:45:00Z'
        },
        {
          projectId: 7,
          name: 'IoT 스마트홈',
          type: '하드웨어',
          category: 'IT',
          statement: '완료',
          date: '2025-09-24T13:20:00Z'
        },
        {
          projectId: 8,
          name: '블록체인 지갑',
          type: '웹개발',
          category: '금융',
          statement: '진행중',
          date: '2025-09-23T10:30:00Z'
        },
        {
          projectId: 9,
          name: 'SNS 플랫폼',
          type: '앱개발',
          category: 'IT',
          statement: '대기',
          date: '2025-09-22T14:00:00Z'
        },
        {
          projectId: 10,
          name: '교육 콘텐츠 관리',
          type: '웹개발',
          category: '교육',
          statement: '진행중',
          date: '2025-09-21T11:50:00Z'
        }
      ];

      setProjects(mockProjects);
      setTotalPages(3);
      setTotalElements(25);
      setLoading(false);
    }, 500);

    /* 실제 API 호출 예시
    try {
      const response = await fetch(`${API_ENDPOINTS.PROJECTS_LIST}?page=${page}&size=10`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      const data = await response.json();
      
      if (data.result_code === 200) {
        setProjects(data.data.projects);
        setTotalPages(data.data.totalPages);
        setTotalElements(data.data.totalElements);
      } else {
        console.error('프로젝트 목록 조회 실패');
      }
      setLoading(false);
    } catch (error) {
      console.error('프로젝트 목록 조회 실패:', error);
      setLoading(false);
    }
    */
  };

  // TODO: 여기에 API 필요합니다 - 프로젝트 삭제 API
  const handleDelete = async (projectId, projectName) => {
    if (!confirm(`"${projectName}" 프로젝트를 정말 삭제하시겠습니까?`)) {
      return;
    }

    // 임시 처리
    alert('프로젝트가 삭제되었습니다.');
    setProjects(projects.filter(project => project.projectId !== projectId));

    /* 실제 API 호출 예시
    try {
      const response = await fetch(API_ENDPOINTS.PROJECT_DELETE(projectId), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      const data = await response.json();
      
      if (data.result_code === 200) {
        alert(data.successMessage || '프로젝트가 삭제되었습니다.');
        fetchProjects(currentPage); // 목록 새로고침
      } else {
        alert(data.errorMessage || '프로젝트 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('프로젝트 삭제 실패:', error);
      alert('프로젝트 삭제 중 오류가 발생했습니다.');
    }
    */
  };

  const getStatusClass = (status) => {
    switch (status) {
      case '진행중': return 'status-active';
      case '완료': return 'status-completed';
      case '대기': return 'status-pending';
      default: return '';
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="projects-page">
          <div className="loading">로딩 중...</div>
        </div>
      </AdminLayout>
    );
  }

  if (projects.length === 0) {
    return (
      <AdminLayout>
        <div className="projects-page">
          <div className="empty-state">
            <div className="empty-state-icon">📁</div>
            <p>등록된 프로젝트가 없습니다.</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="projects-page">
        <div className="projects-content">
          <table className="projects-table">
            <thead>
              <tr>
                <th>프로젝트 이름</th>
                <th>프로젝트 유형</th>
                <th>카테고리</th>
                <th>상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(project => (
                <tr key={project.projectId}>
                  <td>{project.name}</td>
                  <td>{project.type}</td>
                  <td>{project.category}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(project.statement)}`}>
                      {project.statement}
                    </span>
                  </td>
                  <td>
                    <button
                      className="delete-button"
                      onClick={() => handleDelete(project.projectId, project.name)}
                    >
                      삭제하기
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
      </div>
    </AdminLayout>
  );
};

export default ProjectsPage;
