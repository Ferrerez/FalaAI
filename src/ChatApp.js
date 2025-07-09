import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, push, onValue, off, set, serverTimestamp, query, orderByChild } from 'firebase/database';
import { auth, db } from './firebase';
import './CustomChatLayout.css';
import { FiSearch, FiVideo, FiPhone, FiMoreVertical, FiSmile, FiPaperclip, FiSend, FiMic, FiEdit2, FiLogOut, FiPlus } from 'react-icons/fi';
import 'bootstrap/dist/css/bootstrap.min.css';
import './style.css';
import { MessageList } from 'react-chat-elements';
import 'react-chat-elements/dist/main.css';

function getInitials(name) {
  if (!name) return 'U';
  const parts = name.split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ChatApp() {
  const [user, setUser] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState('global');
  const [users, setUsers] = useState([]);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [chatsWithMessages, setChatsWithMessages] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 700);
  const [showChat, setShowChat] = useState(false); // Para mobile
  const [showContactsModal, setShowContactsModal] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 700);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Carregar mensagens do chat selecionado
  useEffect(() => {
    if (!selectedChat) return;
    
    console.log('Carregando mensagens para o chat:', selectedChat);
    
    const messagesRef = ref(db, `chats/${selectedChat}/messages`);
    const messagesQuery = query(messagesRef, orderByChild('timestamp'));
    
    const unsubscribe = onValue(messagesQuery, (snapshot) => {
      const messagesData = [];
      snapshot.forEach((childSnapshot) => {
        messagesData.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      console.log('Mensagens carregadas:', messagesData.length, 'mensagens');
      setMessages(messagesData);
    }, (error) => {
      console.error('Erro ao carregar mensagens:', error);
    });

    return () => unsubscribe();
  }, [selectedChat]);

  // Carregar lista de usuários
  useEffect(() => {
    const usersRef = ref(db, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const usersData = [];
      snapshot.forEach((childSnapshot) => {
        if (childSnapshot.key !== user?.uid) {
          usersData.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        }
      });
      setUsers(usersData);
    });

    return () => unsubscribe();
  }, [user]);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Atualizar status online
        set(ref(db, `users/${currentUser.uid}`), {
          displayName: currentUser.displayName || currentUser.email,
          email: currentUser.email,
          photoURL: currentUser.photoURL || '',
          online: true,
          lastSeen: serverTimestamp()
        });
      } else {
        navigate('/');
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (user) {
        set(ref(db, `users/${user.uid}/online`), false);
        set(ref(db, `users/${user.uid}/lastSeen`), serverTimestamp());
      }
    };
  }, [navigate, user]);

  // Buscar chats privados com mensagens
  useEffect(() => {
    if (!user) return;
    const chatIds = users.map(u => [user.uid, u.id].sort().join('_'));
    const unsubscribes = [];
    const chatsComMsg = [];
    chatIds.forEach(chatId => {
      const messagesRef = ref(db, `chats/${chatId}/messages`);
      const unsub = onValue(messagesRef, (snap) => {
        if (snap.exists()) {
          if (!chatsComMsg.includes(chatId)) {
            chatsComMsg.push(chatId);
            setChatsWithMessages(prev => Array.from(new Set([...prev, chatId])));
          }
        } else {
          setChatsWithMessages(prev => prev.filter(id => id !== chatId));
        }
      });
      unsubscribes.push(unsub);
    });
    return () => unsubscribes.forEach(u => u && u());
  }, [user, users]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !selectedChat) {
      console.log('Dados inválidos para envio:', { newMessage: newMessage.trim(), user: !!user, selectedChat });
      return;
    }

    const msgData = {
      userId: user.uid,
      userName: user.displayName || user.email,
      avatarUrl: user.photoURL || '',
      text: newMessage.trim(),
      timestamp: Date.now(),
    };

    console.log('Enviando mensagem:', msgData);

    try {
      const messagesRef = ref(db, `chats/${selectedChat}/messages`);
      const result = await push(messagesRef, msgData);
      console.log('Mensagem enviada com sucesso:', result.key);
      setNewMessage('');
      setErrorMessage('');
      setChatsWithMessages(prev => Array.from(new Set([...prev, selectedChat])));
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      setErrorMessage('Erro ao enviar mensagem: ' + err.message);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    sendMessage();
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (err) {
      console.error('Erro ao fazer logout:', err);
    }
  };

  const createChat = (userId) => {
    const chatId = [user.uid, userId].sort().join('_');
    setSelectedChat(chatId);
  };

  // Ao selecionar um chat no mobile, mostrar a tela de chat
  const handleSelectChat = (chatId) => {
    setSelectedChat(chatId);
    if (isMobile) setShowChat(true);
  };

  // Ao clicar em voltar no mobile, mostrar a lista de chats
  const handleBackToChats = () => {
    setShowChat(false);
  };

  // Função para abrir chat com contato
  const handleOpenContactChat = (userId) => {
    const chatId = [user.uid, userId].sort().join('_');
    setSelectedChat(chatId);
    setShowContactsModal(false);
    if (isMobile) setShowChat(true);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh', background: '#f0f2f5' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Carregando...</span>
          </div>
          <p className="mt-3 text-muted">Carregando chat...</p>
        </div>
      </div>
    );
  }

  // Função para obter dados do contato do chat privado
  const getChatContact = () => {
    if (selectedChat === 'global') return null;
    const otherUserId = selectedChat.split('_').find(id => id !== user.uid);
    return users.find(u => u.id === otherUserId) || null;
  };

  const getChatName = () => {
    if (selectedChat === 'global') return 'Chat Global';
    const contact = getChatContact();
    return contact ? (contact.displayName || contact.email) : 'Chat Privado';
  };

  return (
    <div className="chat-app-container">
      {/* Sidebar e lista de chats juntos no mobile quando showChat for false */}
      {(!isMobile || (isMobile && !showChat)) && (
        <>
          <aside className="sidebar">
            <div className="sidebar-logo">
              <img src={process.env.PUBLIC_URL + '/assets/images/logoLogin.png'} alt="Logo" className="sidebar-logo-img" />
            </div>
            <nav className="sidebar-nav">
              <button className="sidebar-nav-item active">
                🏠
                <span className="sidebar-nav-label">Início</span>
              </button>
              <button className="sidebar-nav-item">
                💼
                <span className="sidebar-nav-label">Trabalho</span>
              </button>
              <button className="sidebar-nav-item" onClick={() => setShowContactsModal(true)}>
                👥
                <span className="sidebar-nav-label">Contatos</span>
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
            <button className="sidebar-logout" onClick={handleLogout}>
              🚪
              <span className="sidebar-nav-label">Sair</span>
            </button>
          </aside>
          <section className="chat-list-section">
            <div className="chat-list-logo">
              <img src={process.env.PUBLIC_URL + '/assets/images/logoLogin.png'} alt="Logo" className="chat-list-logo-img" />
            </div>
            <div className="chat-list-header">
              <input className="chat-search" placeholder="Search" />
            </div>
            <ul className="chat-list">
              {users.map((otherUser) => {
                const chatId = [user.uid, otherUser.id].sort().join('_');
                if (!chatsWithMessages.includes(chatId)) return null;
                return (
                  <li key={otherUser.id} className={`chat-list-item${selectedChat === chatId ? ' active' : ''}`} onClick={() => handleSelectChat(chatId)}>
                    {otherUser.photoURL ? (
                      <img className="chat-avatar" src={otherUser.photoURL} alt={otherUser.displayName || otherUser.email} />
                    ) : (
                      <div className="chat-avatar">{getInitials(otherUser.displayName || otherUser.email)}</div>
                    )}
                    <div className="chat-info">
                      <div className="chat-title">{otherUser.displayName || otherUser.email}</div>
                      <div className="chat-last-msg">{otherUser.online ? 'online' : 'offline'}</div>
                    </div>
                    <div className="chat-meta">
                      <span className="chat-time">20m</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
      {/* Área principal do chat - só mostra no mobile se showChat for true */}
      {(!isMobile || (isMobile && showChat)) && (
        <main className="chat-main">
          {isMobile && showChat && (
            <button className="chat-back-btn" onClick={handleBackToChats} style={{margin: '16px 0 0 16px'}}>
              ← Voltar
            </button>
          )}
          <header className="chat-header">
            <div className="chat-header-title">{getChatName()}</div>
            <div className="chat-header-actions">
              <button><FiSearch /></button>
              <button><FiPhone /></button>
              <button><FiMoreVertical /></button>
            </div>
          </header>
          <div className="chat-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`chat-message ${msg.userId === user.uid ? 'sent' : 'received'}`}>
                {msg.avatarUrl && (
                  <img className="message-avatar" src={msg.avatarUrl} alt={msg.userName} />
                )}
                <div className="message-bubble">
                  <div className="message-author">{msg.userName}</div>
                  <div className="message-text">{msg.text}</div>
                  <div className="message-meta">{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form className="chat-input-area" onSubmit={handleSendMessage}>
            <input
              className="chat-input"
              placeholder="Your message"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button type="submit" className="chat-send-btn wa-send-mobile" tabIndex={-1} title="Enviar">
              <FiSend size={22} />
            </button>
          </form>
        </main>
      )}
      {/* Modal de contatos */}
      {showContactsModal && (
        <div className="wa-modal-bg" onClick={() => setShowContactsModal(false)}>
          <div className="wa-modal wa-modal-contacts" onClick={e => e.stopPropagation()}>
            <div className="wa-modal-header">
              <div className="wa-modal-title">Contatos</div>
            </div>
            <div className="wa-modal-list">
              {users.map(otherUser => (
                <div key={otherUser.id} className="wa-modal-user" onClick={() => handleOpenContactChat(otherUser.id)}>
                  <div className="wa-avatar wa-modal-avatar">
                    {otherUser.photoURL ? (
                      <img src={otherUser.photoURL} alt={otherUser.displayName || otherUser.email} />
                    ) : (
                      <div className="wa-avatar-fallback">{getInitials(otherUser.displayName || otherUser.email)}</div>
                    )}
                  </div>
                  <div className="wa-modal-user-info">
                    <div className="wa-modal-user-name">{otherUser.displayName || otherUser.email}</div>
                    <div className="wa-modal-user-status">{otherUser.online ? 'online' : 'offline'}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="wa-modal-close wa-modal-close-bottom" onClick={() => setShowContactsModal(false)}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatApp;