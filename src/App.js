import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Login from './Login';
import Cadastro from './Cadastro';
import ChatApp from './ChatApp';
import './CustomChatLayout.css';

function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#f7f8fa'
      }}>
        <div>Carregando...</div>
      </div>
    );
  }

  return user ? children : <Navigate to="/" replace />;
}

function App() {
  return (
    <div className="chat-app-container">
      {/* Sidebar lateral */}
      <aside className="sidebar">
        <nav className="sidebar-nav">
          <button className="sidebar-nav-item active">
            🏠
            <span className="sidebar-nav-label">Início</span>
          </button>
          <button className="sidebar-nav-item">
            💼
            <span className="sidebar-nav-label">Trabalho</span>
          </button>
          <button className="sidebar-nav-item">
            👥
            <span className="sidebar-nav-label">Amigos</span>
          </button>
          <button className="sidebar-nav-item">
            🗂️
            <span className="sidebar-nav-label">Arquivos</span>
          </button>
          <button className="sidebar-nav-item">
            👤
            <span className="sidebar-nav-label">Perfil</span>
          </button>
          <button className="sidebar-nav-item">
            ✏️
            <span className="sidebar-nav-label">Editar</span>
          </button>
        </nav>
        <button className="sidebar-logout">
          🚪
          <span className="sidebar-nav-label">Sair</span>
        </button>
      </aside>

      {/* Lista de chats */}
      <section className="chat-list-section">
        <div className="chat-list-logo">
          <img src="/assets/images/logoLogin.png" alt="Logo" className="chat-list-logo-img" />
        </div>
        <div className="chat-list-header">
          <input className="chat-search" placeholder="Search" />
        </div>
        <ul className="chat-list">
          {/* Exemplo de chat item */}
          <li className="chat-list-item active">
            <div className="chat-avatar">DC</div>
            <div className="chat-info">
              <div className="chat-title">Design chat</div>
              <div className="chat-last-msg">Jessie Rollins sent a photo</div>
            </div>
            <div className="chat-meta">
              <span className="chat-time">4m</span>
              <span className="chat-status">★</span>
            </div>
          </li>
          <li className="chat-list-item">
            <img className="chat-avatar" src="https://randomuser.me/api/portraits/men/32.jpg" alt="avatar" />
            <div className="chat-info">
              <div className="chat-title">Osman Campos</div>
              <div className="chat-last-msg">You: Hey! We are ready...</div>
            </div>
            <div className="chat-meta">
              <span className="chat-time">20m</span>
            </div>
          </li>
          {/* ...outros chats... */}
        </ul>
      </section>

      {/* Área principal do chat */}
      <main className="chat-main">
        <header className="chat-header">
          <div className="chat-header-title">Design chat</div>
          <div className="chat-header-actions">
            <button>🔍</button>
            <button>📞</button>
            <button>⋮</button>
          </div>
        </header>
        <div className="chat-messages">
          {/* Exemplo de mensagem */}
          <div className="chat-message received">
            <img className="message-avatar" src="https://randomuser.me/api/portraits/women/44.jpg" alt="avatar" />
            <div className="message-bubble">
              <div className="message-author">Jasmin Lowery</div>
              <div className="message-text">I added new flows to our design system. Now you can use them for your projects!</div>
              <div className="message-meta">23:20</div>
            </div>
          </div>
          <div className="chat-message sent">
            <div className="message-bubble">
              <div className="message-text">Jaden, my congratulations! I will be glad to work with you on a new project. 😊</div>
              <div className="message-meta">10 👍 09:27</div>
            </div>
            <img className="message-avatar" src="https://randomuser.me/api/portraits/men/45.jpg" alt="avatar" />
          </div>
          {/* ...outras mensagens... */}
        </div>
        <form className="chat-input-area">
          <input className="chat-input" placeholder="Your message" />
          <button className="chat-send-btn" type="submit">➤</button>
        </form>
      </main>
    </div>
  );
}

export default App;