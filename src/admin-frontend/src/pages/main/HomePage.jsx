import React, { useState, useEffect, useRef } from 'react';
import Navbar from '../../components/Navbar';
import './HomePage.css';

const HomePage = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [visibleElements, setVisibleElements] = useState(new Set());

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleElements(prev => new Set([...prev, entry.target.id]));
          } else {
            setVisibleElements(prev => {
              const newSet = new Set(prev);
              newSet.delete(entry.target.id);
              return newSet;
            });
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      }
    );


    const elementsToObserve = document.querySelectorAll('[data-animate]');
    elementsToObserve.forEach(el => observer.observe(el));

    return () => {
      elementsToObserve.forEach(el => observer.unobserve(el));
    };
  }, []);
  return (
    <div className="home-page">
      <Navbar type="main" />

      <section className="hero">
        
        <div className="container">
          <div className="hero-content">
            <h2 className={`hero-title ${isVisible ? 'animate-fade-in-up' : ''}`}>
              Team ONE
            </h2>
            <p className="hero-subtitle">
              AI로 완벽한 프로젝트 팀을 구성하세요
            </p>
            <p className="hero-description">
              AI 기반 매칭 시스템으로 개발자, 디자이너, 기획자를 연결하여 최적의 프로젝트 팀을 자동으로 구성합니다.
            </p>
            <div className={`hero-buttons ${isVisible ? 'animate-fade-in-up' : ''}`} style={{ animationDelay: '4.5s' }}>
              <a href="#about" className="btn btn-primary">더 알아보기</a>
            </div>
          </div>
        </div>
      </section>

      {/* 서비스 소개 섹션 */}
      <section id="about" className="about-section">
        <div className="container">
          <h2 className="section-title">서비스 소개</h2>
          <div className="features-grid">
            <div 
              id="feature-1" 
              data-animate 
              className={`feature-card ${visibleElements.has('feature-1') ? 'animate-fade-in-up' : ''}`}
            >
              <div className="feature-icon">🤖</div>
              <h3>스마트 매칭</h3>
              <p>AI가 개발자의 스킬, 경험, 성향을 분석하여 최적의 팀원을 매칭합니다.</p>
            </div>
            <div 
              id="feature-2" 
              data-animate 
              className={`feature-card ${visibleElements.has('feature-2') ? 'animate-fade-in-up' : ''}`}
            >
              <div className="feature-icon">📁</div>
              <h3>프로젝트 관리</h3>
              <p>프로젝트 생성부터 팀 구성, 진행 상황 추적까지 한 번에 관리합니다.</p>
            </div>
            <div 
              id="feature-3" 
              data-animate 
              className={`feature-card ${visibleElements.has('feature-3') ? 'animate-fade-in-up' : ''}`}
            >
              <div className="feature-icon">🏆</div>
              <h3>공모전 연동</h3>
              <p>각종 코딩 공모전과 연동하여 대회 참가팀을 쉽게 구성할 수 있습니다.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 팀원 소개 섹션 */}
      <section id="team" className="team-section">
        <div className="container">
          <h2 className="section-title">팀원 소개</h2>
          <div className="team-grid">
            <div 
              id="member-1" 
              data-animate 
              className={`team-member ${visibleElements.has('member-1') ? 'animate-fade-in-up' : ''}`}
            >
              <div className="member-avatar">👨‍💻</div>
              <h3>김광수</h3>
              <p className="member-role">앱 백엔드 개발자</p>
              <p className="member-description">팀 '유일무이'의 리더이자 앱 백엔드 개발을 담당합니다.</p>
            </div>
            <div 
              id="member-2" 
              data-animate 
              className={`team-member ${visibleElements.has('member-2') ? 'animate-fade-in-up' : ''}`}
            >
              <div className="member-avatar">👨‍💻</div>
              <h3>김현재</h3>
              <p className="member-role">웹 백엔드 개발자</p>
              <p className="member-description">웹 백엔드 개발을 담당합니다.</p>
            </div>
            <div 
              id="member-3" 
              data-animate 
              className={`team-member ${visibleElements.has('member-3') ? 'animate-fade-in-up' : ''}`}
            >
              <div className="member-avatar">👨‍🎨</div>
              <h3>마강현</h3>
              <p className="member-role">앱 프론트엔드 개발자</p>
              <p className="member-description">앱 프론트엔드 개발을 담당합니다.</p>
            </div>
            <div 
              id="member-4" 
              data-animate 
              className={`team-member ${visibleElements.has('member-4') ? 'animate-fade-in-up' : ''}`}
            >
              <div className="member-avatar">👩‍🎨</div>
              <h3>김민주</h3>
              <p className="member-role">웹 프론트엔드 개발자</p>
              <p className="member-description">웹 프론트엔드 개발을 담당합니다.</p>
            </div>
            <div 
              id="member-5" 
              data-animate 
              className={`team-member ${visibleElements.has('member-5') ? 'animate-fade-in-up' : ''}`}
            >
              <div className="member-avatar">👩‍💻</div>
              <h3>이채민</h3>
              <p className="member-role">AI 개발자</p>
              <p className="member-description">프로젝트의 전체적인 AI 개발을 담당합니다.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="footer">
        <div className="container">
          <p>&copy; 2024 Team ONE. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
