import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, push, onValue, off, set, serverTimestamp, query, orderByChild } from 'firebase/database';
import { auth, db } from './firebase';
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
    <div className="wa-wrapper">
      {/* Sidebar */}
      <div className="wa-sidebar">
        <div className="wa-sidebar-header">
          <div className="wa-sidebar-user">
            <div className="wa-avatar">
              {user?.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || user.email} />
              ) : (
                <div className="wa-avatar-fallback">{getInitials(user?.displayName || user?.email)}</div>
              )}
            </div>
            <div className="wa-sidebar-user-info">
              <div className="wa-sidebar-user-name">{user?.displayName || user?.email}</div>
              <div className="wa-sidebar-user-status">online</div>
            </div>
          </div>
          <div className="wa-sidebar-actions">
            <button className="wa-sidebar-action" onClick={handleLogout} title="Sair">
              <FiLogOut size={20} />
            </button>
          </div>
        </div>

        <div className="wa-sidebar-search">
          <div className="wa-search-input">
            <FiSearch size={16} />
            <input type="text" placeholder="Pesquisar ou começar uma nova conversa" />
          </div>
        </div>

        <div className="wa-sidebar-chats">
          {/* Chat Global */}
          <div 
            className={`wa-chat-item${selectedChat === 'global' ? ' active' : ''}`}
            onClick={() => setSelectedChat('global')}
          >
            <div className="wa-avatar">
              <div className="wa-avatar-fallback">🌐</div>
            </div>
            <div className="wa-chat-info">
              <div className="wa-chat-name">Chat Global</div>
              <div className="wa-chat-last-message">Conversa pública</div>
            </div>
          </div>

          {/* Chats privados apenas se houver mensagens */}
          {users.map((otherUser) => {
            const chatId = [user.uid, otherUser.id].sort().join('_');
            if (!chatsWithMessages.includes(chatId)) return null;
            return (
              <div 
                key={otherUser.id}
                className={`wa-chat-item${selectedChat === chatId ? ' active' : ''}`}
                onClick={() => setSelectedChat(chatId)}
              >
                <div className="wa-avatar">
                  {otherUser.photoURL ? (
                    <img src={otherUser.photoURL} alt={otherUser.displayName || otherUser.email} />
                  ) : (
                    <div className="wa-avatar-fallback">{getInitials(otherUser.displayName || otherUser.email)}</div>
                  )}
                </div>
                <div className="wa-chat-info">
                  <div className="wa-chat-name">{otherUser.displayName || otherUser.email}</div>
                  <div className="wa-chat-last-message">
                    {otherUser.online ? 'online' : 'offline'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Botão flutuante de novo chat */}
        <button className="wa-fab-newchat" onClick={() => setShowNewChatModal(true)} title="Novo chat">
          <FiPlus size={28} />
        </button>
        {/* Modal de novo chat */}
        {showNewChatModal && (
          <div className="wa-modal-bg" onClick={() => setShowNewChatModal(false)}>
            <div className="wa-modal" onClick={e => e.stopPropagation()}>
              <div className="wa-modal-title">Nova conversa</div>
              <button className="wa-modal-newcontact" onClick={async () => {
                const nome = prompt('Nome do novo contato:');
                if (!nome) return;
                const email = prompt('Email do novo contato:');
                if (!email) return;
                // Gera um id fictício (timestamp)
                const fakeId = 'fake_' + Date.now();
                await set(ref(db, `users/${fakeId}`), {
                  displayName: nome,
                  email,
                  photoURL: '',
                  online: false,
                  lastSeen: Date.now()
                });
                alert('Contato adicionado!');
              }}>
                + Novo contato
              </button>
              <div className="wa-modal-list">
                {users.map(otherUser => (
                  <div key={otherUser.id} className="wa-modal-user" onClick={() => {
                    const chatId = [user.uid, otherUser.id].sort().join('_');
                    setSelectedChat(chatId);
                    setShowNewChatModal(false);
                  }}>
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
              <button className="wa-modal-close" onClick={() => setShowNewChatModal(false)}>Fechar</button>
            </div>
          </div>
        )}
      </div>

      {/* Chat Principal */}
      <div className="wa-main wa-main-waweb">
        <div className="wa-main-header wa-main-header-waweb">
          {selectedChat === 'global' ? (
            <div className="wa-main-title wa-main-title-waweb" style={{textAlign: 'center', justifyContent: 'center'}}>
              <div className="wa-main-name wa-main-name-waweb">Chat Global</div>
              <div className="wa-main-status wa-main-status-waweb">online</div>
            </div>
          ) : (
            <div className="wa-main-title wa-main-title-private">
              <div className="wa-avatar wa-avatar-header">
                {getChatContact()?.photoURL ? (
                  <img src={getChatContact().photoURL} alt={getChatContact().displayName || getChatContact().email} />
                ) : (
                  <div className="wa-avatar-fallback">{getInitials(getChatContact()?.displayName || getChatContact()?.email)}</div>
                )}
              </div>
              <div>
                <div className="wa-main-name wa-main-name-waweb">{getChatName()}</div>
                <div className="wa-main-status wa-main-status-waweb">online</div>
              </div>
            </div>
          )}
          <div className="wa-main-actions">
            <button className="wa-main-action">
              <FiVideo size={20} />
            </button>
            <button className="wa-main-action">
              <FiPhone size={20} />
            </button>
            <button className="wa-main-action">
              <FiSearch size={20} />
            </button>
            <button className="wa-main-action">
              <FiMoreVertical size={20} />
            </button>
          </div>
        </div>

        <div className="wa-messages wa-messages-waweb">
          <MessageList
            className="rce-message-list"
            lockable={true}
            toBottomHeight={"100%"}
            dataSource={messages.map(msg => {
              let avatar = msg.avatarUrl;
              if (!avatar) {
                // Gera um avatar com a inicial do nome/email usando um serviço externo
                const initials = (msg.userName || msg.userId || '?').trim()[0].toUpperCase();
                avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=2979ff&color=fff&size=64&bold=true`;
              }
              return {
                position: msg.userId === user?.uid ? 'right' : 'left',
                type: 'text',
                text: msg.text,
                date: new Date(msg.timestamp),
                title: msg.userName,
                avatar,
                id: msg.id,
              };
            })}
          />
          <div ref={messagesEndRef} />
        </div>

        <form className="wa-input-form-waweb" onSubmit={handleSendMessage}>
          <button type="button" className="wa-input-icon wa-input-emoji" tabIndex={-1}>
            <FiSmile size={22} />
          </button>
          <button type="button" className="wa-input-icon wa-input-attach" tabIndex={-1}>
            <FiPaperclip size={22} />
          </button>
          <input
            className="wa-input wa-input-waweb"
            placeholder="Digite sua mensagem..."
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button type="button" className="wa-input-icon wa-input-mic" tabIndex={-1}>
            <FiMic size={22} />
          </button>
        </form>
        
        {errorMessage && (
          <div style={{ color: '#ff5252', margin: '8px 0 0 0', textAlign: 'center', fontSize: '0.97rem' }}>
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatApp;