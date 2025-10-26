import React, { useState, useEffect } from 'react';
import AdminLayout from '../../../components/AdminLayout';
import Pagination from '../users/Pagination';
import { fetchProjects, deleteProject } from '../../../utils/api';
import './ProjectsPage.css';

const ProjectsPage = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  useEffect(() => {
    loadProjects(currentPage);
  }, [currentPage]);

  const loadProjects = async (page) => {
    setLoading(true);
    
    try {
      const result = await fetchProjects(page, 10);
      
      if (result.success) {
        setProjects(result.data);
        setTotalElements(result.total);
        setTotalPages(Math.ceil(result.total / 10));
      } else {
        console.error('프로젝트 목록 조회 실패');
      }
    } catch (error) {
      console.error('프로젝트 목록 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (projectId, projectName) => {
    if (!confirm(`"${projectName}" 프로젝트를 정말 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const result = await deleteProject(projectId);
      
      if (result.success) {
        alert(result.message || '프로젝트가 삭제되었습니다.');
        loadProjects(currentPage); // 목록 새로고침
      } else {
        alert(result.message || '프로젝트 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('프로젝트 삭제 실패:', error);
      alert('프로젝트 삭제 중 오류가 발생했습니다.');
    }
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
