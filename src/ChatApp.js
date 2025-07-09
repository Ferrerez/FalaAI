import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, push, onValue, off, set, serverTimestamp, query, orderByChild, limitToLast, endAt, get } from 'firebase/database';
import { auth, db } from './firebase';
import './CustomChatLayout.css';
import { FiSearch, FiVideo, FiPhone, FiMoreVertical, FiSmile, FiPaperclip, FiSend, FiMic, FiEdit2, FiLogOut, FiPlus, FiChevronDown, FiSettings } from 'react-icons/fi';
import 'bootstrap/dist/css/bootstrap.min.css';
import './style.css';
import { MessageList } from 'react-chat-elements';
import 'react-chat-elements/dist/main.css';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

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
  const [oldestTimestamp, setOldestTimestamp] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [users, setUsers] = useState([]);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [chatsWithMessages, setChatsWithMessages] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 700);
  const [showChat, setShowChat] = useState(false); // Para mobile
  const [activeSidebar, setActiveSidebar] = useState('conversas'); // 'conversas' ou 'contatos'
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messagesContainerRef = useRef(null);
  const chatMainRef = useRef(null);
  const [chatMainRect, setChatMainRect] = useState({ left: 0, width: 0 });
  const [showNewContactModal, setShowNewContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactError, setNewContactError] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const [personalContacts, setPersonalContacts] = useState([]);
  const [chatToDelete, setChatToDelete] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showLabel, setShowLabel] = useState(null);

  // Função para verificar se está no final do chat
  const checkScrollToBottomBtn = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    console.log('scrollTop:', el.scrollTop, 'clientHeight:', el.clientHeight, 'scrollHeight:', el.scrollHeight);
    // Mostra o botão se não está colado no final (tolerância de 20px)
    if (el.scrollTop + el.clientHeight < el.scrollHeight - 20) {
      setShowScrollToBottom(true);
    } else {
      setShowScrollToBottom(false);
    }
  };
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScrollToBottomBtn);
    // Checa também ao atualizar mensagens, após o próximo frame
    requestAnimationFrame(() => {
      checkScrollToBottomBtn();
    });
    return () => {
      el.removeEventListener('scroll', checkScrollToBottomBtn);
    };
  }, [messages]);
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    // Garante que o cálculo do botão será feito após o scroll
    requestAnimationFrame(() => {
      checkScrollToBottomBtn();
    });
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 700);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Carregar mensagens do chat selecionado (paginado)
  useEffect(() => {
    if (!selectedChat) return;
    setLoading(true);
    setHasMore(true);
    setOldestTimestamp(null);
    const messagesRef = ref(db, `chats/${selectedChat}/messages`);
    const messagesQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(20));
    const unsubscribe = onValue(messagesQuery, (snapshot) => {
      const messagesData = [];
      snapshot.forEach((childSnapshot) => {
        messagesData.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      console.log('Mensagens carregadas:', messagesData);
      setMessages(messagesData);
      setOldestTimestamp(messagesData[0]?.timestamp || null);
      setHasMore(messagesData.length === 20);
      setLoading(false);
      setShouldScrollToBottom(true); // Scroll ao trocar de chat
    }, (error) => {
      console.error('Erro ao carregar mensagens:', error);
      setLoading(false);
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

  // Carregar contatos pessoais do usuário logado
  useEffect(() => {
    if (!user) return;
    const contactsRef = ref(db, `contacts/${user.uid}`);
    const unsubscribe = onValue(contactsRef, (snapshot) => {
      const contactsData = [];
      snapshot.forEach((child) => {
        contactsData.push({ id: child.key, ...child.val() });
      });
      setPersonalContacts(contactsData);
    });
    return () => unsubscribe();
  }, [user]);

  // Scroll para o final apenas quando shouldScrollToBottom for true
  useEffect(() => {
    if (shouldScrollToBottom) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        setShouldScrollToBottom(false);
      }, 100);
    }
  }, [shouldScrollToBottom, messages]);

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

  // Carregar arquivos quando a aba Arquivos for selecionada
  useEffect(() => {
    if (activeSidebar === 'arquivos' && user) {
      loadFiles();
    }
  }, [activeSidebar, user]);

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
      setShouldScrollToBottom(true); // Scroll ao enviar mensagem
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      setErrorMessage('Erro ao enviar mensagem: ' + err.message);
    }
  };

  // Função para upload de arquivo
  const uploadFile = async (file) => {
    console.log('uploadFile called with:', file.name, 'selectedChat:', selectedChat);
    
    if (!selectedChat) {
      console.error('Nenhum chat selecionado');
      alert('Selecione um chat primeiro');
      return;
    }
    
    if (!user) {
      console.error('Usuário não autenticado');
      alert('Usuário não autenticado');
      return;
    }
    
    setUploadingFile(true);
    
    try {
      console.log('Iniciando upload para chat:', selectedChat);
      
      // Criar referência no Storage
      const fileRef = storageRef(storage, `chats/${selectedChat}/${Date.now()}_${file.name}`);
      console.log('Storage reference created:', fileRef.fullPath);
      
      // Upload do arquivo
      console.log('Iniciando upload...');
      const uploadTask = uploadBytesResumable(fileRef, file);
      
      // Aguardar conclusão do upload
      await uploadTask;
      console.log('Upload concluído');
      
      // Obter URL de download
      const downloadURL = await getDownloadURL(fileRef);
      console.log('Download URL obtida:', downloadURL);
      
      // Salvar mensagem com link do arquivo
      const messageRef = ref(db, `chats/${selectedChat}/messages`);
      const newMessageRef = push(messageRef);
      const messageData = {
        text: `📎 ${file.name}`,
        fileURL: downloadURL,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        sender: user.uid,
        timestamp: serverTimestamp(),
        senderName: user.displayName || user.email,
        isFile: true,
      };
      
      console.log('Salvando mensagem no database:', messageData);
      await set(newMessageRef, messageData);
      console.log('Mensagem salva com sucesso');
      
    } catch (error) {
      console.error('Erro ao fazer upload do arquivo:', error);
      alert('Erro ao enviar arquivo: ' + error.message);
      throw error; // Re-throw para ser capturado pelo handler
    } finally {
      setUploadingFile(false);
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
    console.log('abrir chat', chatId);
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
    setActiveSidebar('conversas'); // Voltar para conversas ao abrir chat com contato
    if (isMobile) setShowChat(true);
  };

  // Função para carregar mais mensagens antigas
  const handleLoadMore = () => {
    if (!selectedChat || !oldestTimestamp) return;
    setLoadingMore(true);
    setIsLoadingMore(true);
    // Salvar posição do primeiro elemento de mensagem
    const firstMessage = document.querySelector('.chat-message');
    const prevTop = firstMessage ? firstMessage.getBoundingClientRect().top : 0;
    const messagesRef = ref(db, `chats/${selectedChat}/messages`);
    const messagesQuery = query(messagesRef, orderByChild('timestamp'), endAt(oldestTimestamp - 1), limitToLast(20));
    onValue(messagesQuery, (snapshot) => {
      const moreMessages = [];
      snapshot.forEach((childSnapshot) => {
        moreMessages.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      setMessages(prev => {
        setTimeout(() => {
          const newFirstMessage = document.querySelector('.chat-message');
          if (newFirstMessage) {
            const newTop = newFirstMessage.getBoundingClientRect().top;
            window.scrollBy(0, newTop - prevTop);
          }
          setLoadingMore(false);
          setIsLoadingMore(false);
        }, 50);
        return [...moreMessages, ...prev];
      });
      setOldestTimestamp(moreMessages[0]?.timestamp || oldestTimestamp);
      setHasMore(moreMessages.length === 20);
    }, {
      onlyOnce: true
    });
  };

  // Atualiza a posição do chat-main ao montar e ao redimensionar
  useEffect(() => {
    function updateRect() {
      if (chatMainRef.current) {
        const rect = chatMainRef.current.getBoundingClientRect();
        setChatMainRect({ left: rect.left, width: rect.width });
      }
    }
    updateRect();
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [showChat, isMobile]);

  // Adicionar este useEffect para scroll automático ao abrir o chat no mobile
  useEffect(() => {
    if (isMobile && showChat && selectedChat) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [isMobile, showChat, selectedChat]);

  // Função utilitária para saber se nenhum chat está selecionado (mas não o global)
  function isNoChatSelected() {
    return (
      activeSidebar === 'conversas' &&
      (!selectedChat || selectedChat === '' || selectedChat === undefined || selectedChat === false || selectedChat === null)
    );
  }

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
    if (!selectedChat) return null;
    
    // Primeiro tenta encontrar entre os usuários cadastrados
    const parts = typeof selectedChat === 'string' ? selectedChat.split('_') : [];
    const otherUserId = parts.find(id => id !== user.uid);
    
    let userContact = users.find(u => u.id === otherUserId);
    if (userContact) {
      return userContact;
    }
    
    // Se não encontrar, tenta entre os contatos pessoais
    for (let contact of personalContacts) {
      // Verifica se já existe um usuário cadastrado com esse email
      let existingUser = users.find(u => u.email === contact.email);
      let expectedChatId;
      
      if (existingUser) {
        expectedChatId = [user.uid, existingUser.id].sort().join('_');
      } else {
        // Substitui caracteres inválidos do email para path do Firebase
        const safeEmail = contact.email.replace(/[.#$\[\]]/g, '_');
        expectedChatId = [user.uid, safeEmail].sort().join('_');
      }
      
      if (expectedChatId === selectedChat) {
        return { displayName: contact.name, email: contact.email };
      }
    }
    
    return null;
  };

  const getChatName = () => {
    const contact = getChatContact();
    if (contact) return contact.displayName || contact.email;
    return '';
  };

  // Função para carregar arquivos de todos os chats
  const loadFiles = async () => {
    if (!user) return;
    
    setLoadingFiles(true);
    try {
      const allFiles = [];
      
      // Buscar arquivos em todos os chats do usuário
      const chatIds = users.map(u => [user.uid, u.id].sort().join('_'));
      
      for (const chatId of chatIds) {
        const messagesRef = ref(db, `chats/${chatId}/messages`);
        const snapshot = await get(messagesRef);
        
        if (snapshot.exists()) {
          snapshot.forEach((childSnapshot) => {
            const message = childSnapshot.val();
            if (message.isFile) {
              allFiles.push({
                id: childSnapshot.key,
                chatId,
                ...message,
                chatName: users.find(u => {
                  const expectedChatId = [user.uid, u.id].sort().join('_');
                  return expectedChatId === chatId;
                })?.displayName || 'Chat privado'
              });
            }
          });
        }
      }
      
      // Ordenar por timestamp (mais recentes primeiro)
      allFiles.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setFiles(allFiles);
    } catch (error) {
      console.error('Erro ao carregar arquivos:', error);
    } finally {
      setLoadingFiles(false);
    }
  };

  return (
    <div className="chat-app-container">
      {/* Sidebar e lista de chats juntos no mobile quando showChat for false */}
      {(!isMobile || (isMobile && !showChat)) && (
        <>
          <aside className="sidebar" style={{position:'relative'}}>
            <div className="sidebar-logo">
              <img src={process.env.PUBLIC_URL + '/assets/images/logoLogin.png'} alt="Logo" className="sidebar-logo-img" />
            </div>
            <nav className="sidebar-nav">
              {/* Conversas */}
              <button
                className={`sidebar-nav-item${activeSidebar === 'conversas' ? ' active' : ''}`}
                onClick={() => {
                  setActiveSidebar('conversas');
                  if (selectedChat && !chatsWithMessages.includes(selectedChat)) {
                    setSelectedChat(null);
                  }
                }}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  width: '100%',
                  padding: 0,
                  margin: 0,
                  minHeight: 60
                }}
                onMouseEnter={() => setShowLabel('conversas')}
                onMouseLeave={() => setShowLabel(null)}
              >
                <span
                  style={{
                    transition: 'transform 0.2s',
                    transform: showLabel === 'conversas' ? 'scale(1.3)' : 'scale(1)',
                    fontSize: 26,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  💬
                </span>
                {showLabel === 'conversas' && (
                  <span
                    style={{
                      marginTop: 4,
                      color: '#fff',
                      fontSize: 13,
                      background: 'rgba(0,0,0,0.7)',
                      borderRadius: 6,
                      padding: '2px 10px',
                      minWidth: 60,
                      textAlign: 'center',
                      transition: 'opacity 0.2s'
                    }}
                  >
                    Conversas
                  </span>
                )}
              </button>
              {/* Grupos */}
              <button
                className={`sidebar-nav-item${activeSidebar === 'grupos' ? ' active' : ''}`}
                onClick={() => {
                  setActiveSidebar('grupos');
                  setSelectedChat(null);
                }}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  width: '100%',
                  padding: 0,
                  margin: 0,
                  minHeight: 60
                }}
                onMouseEnter={() => setShowLabel('grupos')}
                onMouseLeave={() => setShowLabel(null)}
              >
                <span
                  style={{
                    transition: 'transform 0.2s',
                    transform: showLabel === 'grupos' ? 'scale(1.3)' : 'scale(1)',
                    fontSize: 26,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  👥
                </span>
                {showLabel === 'grupos' && (
                  <span
                    style={{
                      marginTop: 4,
                      color: '#fff',
                      fontSize: 13,
                      background: 'rgba(0,0,0,0.7)',
                      borderRadius: 6,
                      padding: '2px 10px',
                      minWidth: 60,
                      textAlign: 'center',
                      transition: 'opacity 0.2s'
                    }}
                  >
                    Grupos
                  </span>
                )}
              </button>
              {/* Contatos */}
              <button
                className={`sidebar-nav-item${activeSidebar === 'contatos' ? ' active' : ''}`}
                onClick={() => {
                  setActiveSidebar('contatos');
                  setSelectedChat(null);
                }}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  width: '100%',
                  padding: 0,
                  margin: 0,
                  minHeight: 60
                }}
                onMouseEnter={() => setShowLabel('contatos')}
                onMouseLeave={() => setShowLabel(null)}
              >
                <span
                  style={{
                    transition: 'transform 0.2s',
                    transform: showLabel === 'contatos' ? 'scale(1.3)' : 'scale(1)',
                    fontSize: 26,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <FiPhone />
                </span>
                {showLabel === 'contatos' && (
                  <span
                    style={{
                      marginTop: 4,
                      color: '#fff',
                      fontSize: 13,
                      background: 'rgba(0,0,0,0.7)',
                      borderRadius: 6,
                      padding: '2px 10px',
                      minWidth: 60,
                      textAlign: 'center',
                      transition: 'opacity 0.2s'
                    }}
                  >
                    Contatos
                  </span>
                )}
              </button>
              {/* Arquivos */}
              <button
                className={`sidebar-nav-item${activeSidebar === 'arquivos' ? ' active' : ''}`}
                onClick={() => {
                  setActiveSidebar('arquivos');
                  setSelectedChat(null);
                }}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  width: '100%',
                  padding: 0,
                  margin: 0,
                  minHeight: 60
                }}
                onMouseEnter={() => setShowLabel('arquivos')}
                onMouseLeave={() => setShowLabel(null)}
              >
                <span
                  style={{
                    transition: 'transform 0.2s',
                    transform: showLabel === 'arquivos' ? 'scale(1.3)' : 'scale(1)',
                    fontSize: 26,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  🗂️
                </span>
                {showLabel === 'arquivos' && (
                  <span
                    style={{
                      marginTop: 4,
                      color: '#fff',
                      fontSize: 13,
                      background: 'rgba(0,0,0,0.7)',
                      borderRadius: 6,
                      padding: '2px 10px',
                      minWidth: 60,
                      textAlign: 'center',
                      transition: 'opacity 0.2s'
                    }}
                  >
                    Arquivos
                  </span>
                )}
              </button>
              {/* Perfil */}
              <button
                className={`sidebar-nav-item${activeSidebar === 'perfil' ? ' active' : ''}`}
                onClick={() => {
                  setActiveSidebar('perfil');
                  setSelectedChat(null);
                }}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  width: '100%',
                  padding: 0,
                  margin: 0,
                  minHeight: 60
                }}
                onMouseEnter={() => setShowLabel('perfil')}
                onMouseLeave={() => setShowLabel(null)}
              >
                <span
                  style={{
                    transition: 'transform 0.2s',
                    transform: showLabel === 'perfil' ? 'scale(1.3)' : 'scale(1)',
                    fontSize: 26,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  👤
                </span>
                {showLabel === 'perfil' && (
                  <span
                    style={{
                      marginTop: 4,
                      color: '#fff',
                      fontSize: 13,
                      background: 'rgba(0,0,0,0.7)',
                      borderRadius: 6,
                      padding: '2px 10px',
                      minWidth: 60,
                      textAlign: 'center',
                      transition: 'opacity 0.2s'
                    }}
                  >
                    Perfil
                  </span>
                )}
              </button>
              {/* Configurações */}
              <button
                className={`sidebar-nav-item${activeSidebar === 'editar' ? ' active' : ''}`}
                onClick={() => {
                  setActiveSidebar('editar');
                  setSelectedChat(null);
                }}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  width: '100%',
                  padding: 0,
                  margin: 0,
                  minHeight: 60
                }}
                onMouseEnter={() => setShowLabel('editar')}
                onMouseLeave={() => setShowLabel(null)}
              >
                <span
                  style={{
                    transition: 'transform 0.2s',
                    transform: showLabel === 'editar' ? 'scale(1.3)' : 'scale(1)',
                    fontSize: 26,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <FiSettings />
                </span>
                {showLabel === 'editar' && (
                  <span
                    style={{
                      marginTop: 4,
                      color: '#fff',
                      fontSize: 13,
                      background: 'rgba(0,0,0,0.7)',
                      borderRadius: 6,
                      padding: '2px 10px',
                      minWidth: 60,
                      textAlign: 'center',
                      transition: 'opacity 0.2s'
                    }}
                  >
                    Configurações
                  </span>
                )}
              </button>
            </nav>
            <button className="sidebar-logout" onClick={handleLogout}>
              🚪
              <span className="sidebar-nav-label">Sair</span>
            </button>
          </aside>
          <section className="chat-list-section" style={{position:'relative'}}>
            <div className="chat-list-logo">
              <img src={process.env.PUBLIC_URL + '/assets/images/logoLogin.png'} alt="Logo" className="chat-list-logo-img" />
            </div>
            <div className="chat-list-header">
              <input className="chat-search" placeholder="Search" />
            </div>
            <div className="chat-list-title" style={{fontWeight:600, fontSize:20, marginTop:10, marginBottom:10, textAlign:'center'}}>
              {activeSidebar === 'conversas' && 'Conversas'}
              {activeSidebar === 'grupos' && 'Grupos'}
              {activeSidebar === 'contatos' && 'Contatos'}
              {activeSidebar === 'arquivos' && 'Arquivos'}
              {activeSidebar === 'perfil' && 'Perfil'}
              {activeSidebar === 'editar' && 'Configurações'}
            </div>
            <ul className="chat-list">
              {activeSidebar === 'conversas' && chatsWithMessages.length === 0 && (
                <li className="chat-list-item" style={{justifyContent:'center', color:'#888', fontStyle:'italic', padding:'32px 0', textAlign:'center'}}>Você ainda não mandou nenhuma mensagem</li>
              )}
              {/* Chat Global removido completamente */}
              {activeSidebar === 'conversas' && users.filter(u => u.id !== 'global').map((otherUser) => {
                const chatId = [user.uid, otherUser.id].sort().join('_');
                if (!chatsWithMessages.includes(chatId)) return null;
                return (
                  <li key={otherUser.id} className={`chat-list-item${selectedChat === chatId ? ' active' : ''}`} onClick={() => handleSelectChat(chatId)}>
                    {otherUser.photoURL ? (
                      <img className="chat-avatar" src={otherUser.photoURL} alt={otherUser.displayName || otherUser.email} />
                    ) : (
                      <div className="chat-avatar">{(otherUser.displayName || otherUser.email).split(' ')[0][0].toUpperCase()}</div>
                    )}
                    <div className="chat-info">
                      <div className="chat-title">{otherUser.displayName || otherUser.email}</div>
                      <div className="chat-last-msg">{otherUser.online ? 'online' : 'offline'}</div>
                    </div>
                    <div className="chat-meta">
                      <span className="chat-time">20m</span>
                    </div>
                    <button
                      className="delete-chat-btn"
                      title="Excluir chat"
                      onClick={e => {e.stopPropagation(); setChatToDelete(chatId); setShowDeleteModal(true);}}
                    >
                      🗑️
                    </button>
                  </li>
                );
              })}
              {activeSidebar === 'contatos' && personalContacts.length === 0 && (
                <li className="chat-list-item" style={{justifyContent:'center', color:'#888', fontStyle:'italic', padding:'32px 0'}}>Nenhum contato adicionado ainda.</li>
              )}
              {activeSidebar === 'contatos' && personalContacts.map((contact) => {
                // Verifica se já existe um usuário cadastrado com esse email
                let existingUser = users.find(u => u.email === contact.email);
                let chatId;
                if (existingUser) {
                  chatId = [user.uid, existingUser.id].sort().join('_');
                } else {
                  // Substitui caracteres inválidos do email para path do Firebase
                  const safeEmail = contact.email.replace(/[.#$\[\]]/g, '_');
                  chatId = [user.uid, safeEmail].sort().join('_');
                }
                return (
                  <li key={contact.id} className="chat-list-item" style={{cursor:'pointer'}} onClick={() => {
                    setSelectedChat(chatId);
                    setActiveSidebar('conversas');
                    setTimeout(() => { if (isMobile) setShowChat(true); }, 0);
                  }}>
                    <div className="chat-avatar" style={{background:'#1976d2', color:'#fff', fontWeight:600, fontSize:18}}>
                      {contact.name ? contact.name[0].toUpperCase() : '?'}
                    </div>
                    <div className="chat-info">
                      <div className="chat-title">{contact.name}</div>
                      <div className="chat-last-msg">{contact.email}</div>
                    </div>
                  </li>
                );
              })}
              {activeSidebar === 'arquivos' && (
                <div style={{ padding: '16px' }}>
                  {loadingFiles ? (
                    <div style={{ textAlign: 'center', color: '#888', padding: '32px 0' }}>
                      Carregando arquivos...
                    </div>
                  ) : files.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#888', fontStyle: 'italic', padding: '32px 0' }}>
                      Nenhum arquivo encontrado
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {files.map((file) => (
                        <div
                          key={file.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '12px',
                            background: '#f8f9fa',
                            borderRadius: 8,
                            border: '1px solid #e9ecef',
                            gap: 12,
                          }}
                        >
                          <span style={{ fontSize: 24 }}>📎</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, color: '#333', marginBottom: 2 }}>
                              {file.fileName}
                            </div>
                            <div style={{ fontSize: 12, color: '#666' }}>
                              {file.chatName} • {(file.fileSize / 1024).toFixed(1)} KB
                            </div>
                          </div>
                          <a
                            href={file.fileURL}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              background: '#1976d2',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              padding: '6px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              textDecoration: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            Baixar
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </ul>
            {/* Botão flutuante de novo contato dentro da lista de chats */}
            {activeSidebar === 'contatos' && (
              <button 
                className="fab-novo-contato"
                title="Novo contato"
                style={{
                  position: 'absolute',
                  bottom: 24,
                  right: 24,
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: '#1976d2',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 16px rgba(25,118,210,0.18)',
                  fontSize: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 100,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onClick={() => setShowNewContactModal(true)}
              >
                +
              </button>
            )}
          </section>
        </>
      )}
      {/* Área principal do chat - só mostra no mobile se showChat for true */}
      {(!isMobile || (isMobile && showChat)) && (
        (activeSidebar === 'conversas' || activeSidebar === 'contatos' || selectedChat) ? (
          <main className="chat-main" ref={chatMainRef} style={{ position: 'relative' }}>
            {/* Só mostra header e chat se houver chat selecionado */}
            {selectedChat ? (
              <>
                <header className="chat-header">
                  {isMobile && showChat && (
                    <button className="chat-back-btn chat-back-btn-mobile" onClick={handleBackToChats} title="Voltar" style={{marginRight: 12}}>
                      ←
                    </button>
                  )}
                  <div className="chat-header-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {getChatContact() && (
                      getChatContact().photoURL ? (
                        <img src={getChatContact().photoURL} alt={getChatName()} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', marginRight: 6 }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1976d2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 18, marginRight: 6 }}>
                          {getChatContact().displayName ? getChatContact().displayName[0].toUpperCase() : (getChatContact().email ? getChatContact().email[0].toUpperCase() : '?')}
                        </div>
                      )
                    )}
                    {getChatName()}
                  </div>
                  <div className="chat-header-actions">
                    <button><FiSearch /></button>
                    <button><FiPhone /></button>
                    <button><FiMoreVertical /></button>
                  </div>
                </header>
                <div className="chat-messages" ref={messagesContainerRef} style={{ position: 'relative', overflowY: 'auto', height: '100%' }}>
                  {showScrollToBottom && (
                    <button
                      className="scroll-to-bottom-btn"
                      style={{
                        position: isMobile ? 'absolute' : 'fixed',
                        bottom: isMobile ? 16 : 88,
                        right: isMobile ? 16 : 80,
                        left: isMobile ? 'auto' : undefined,
                        zIndex: 9999,
                        background: 'rgba(25, 118, 210, 0.97)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        width: 44,
                        height: 44,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        cursor: 'pointer',
                        fontSize: 28,
                        transition: 'background 0.2s',
                        opacity: 0.97,
                      }}
                      onClick={scrollToBottom}
                      title="Ir para o final"
                    >
                      <FiChevronDown size={28} />
                    </button>
                  )}
                  {hasMore && (
                    <button className="chat-load-more" onClick={handleLoadMore} disabled={loadingMore}>
                      {loadingMore ? 'Carregando...' : 'Carregar mais mensagens'}
                    </button>
                  )}
                  {messages.map(msg => (
                    <div key={msg.id} className={`chat-message ${(msg.sender || msg.userId) === user.uid ? 'sent' : 'received'}`}>
                      {msg.avatarUrl && (
                        <img className="message-avatar" src={msg.avatarUrl} alt={msg.senderName || msg.userName} />
                      )}
                      <div className="message-bubble">
                        <div className="message-author">{msg.senderName || msg.userName}</div>
                        <div className="message-text">
                          {msg.isFile ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 20 }}>📎</span>
                              <a
                                href={msg.fileURL}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: 'inherit',
                                  textDecoration: 'none',
                                  fontWeight: 'bold',
                                }}
                              >
                                {msg.fileName}
                              </a>
                              <span style={{ fontSize: 12, opacity: 0.7 }}>
                                ({(msg.fileSize / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                          ) : (
                            msg.text
                          )}
                        </div>
                        <div className="message-meta">{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}</div>
                      </div>
                    </div>
                  ))}
                  {uploadingFile && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'flex-end', 
                      marginBottom: 8, 
                      padding: '0 16px' 
                    }}>
                      <div style={{
                        padding: '8px 12px',
                        background: '#e3f2fd',
                        borderRadius: 12,
                        fontSize: 14,
                        color: '#1976d2',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}>
                        <span>⏳</span>
                        Enviando arquivo...
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <form
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '16px 16px',
                    background: '#fff',
                    borderTop: '1px solid #eee',
                    width: '100%',
                    boxSizing: 'border-box',
                    gap: 8,
                    flexDirection: 'row',
                    flexWrap: 'nowrap',
                    position: 'relative',
                    zIndex: 2,
                    flex: '0 0 auto',
                  }}
                  onSubmit={handleSendMessage}
                  autoComplete="off"
                >
                  {/* Ícone de emoji */}
                  <button type="button" title="Emoji" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, marginRight: 4, color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FiSmile />
                  </button>
                  {/* Ícone de anexo (clip) */}
                  <button
                    type="button"
                    title={uploadingFile ? "Enviando arquivo..." : "Anexar arquivo"}
                    disabled={uploadingFile}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      cursor: uploadingFile ? 'not-allowed' : 'pointer', 
                      fontSize: 22, 
                      marginRight: 4, 
                      color: uploadingFile ? '#ccc' : '#888', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      opacity: uploadingFile ? 0.5 : 1
                    }}
                    onClick={e => {
                      e.preventDefault();
                      if (!uploadingFile) {
                        document.getElementById('file-input-chat').click();
                      }
                    }}
                  >
                    {uploadingFile ? '⏳' : <FiPaperclip />}
                  </button>
                                   <input
                   id="file-input-chat"
                   type="file"
                   style={{ display: 'none' }}
                   multiple={false}
                   onChange={async (e) => {
                     console.log('File input changed:', e.target.files);
                     const file = e.target.files[0];
                     if (file) {
                       console.log('File selected:', file.name, file.size, file.type);
                       try {
                         await uploadFile(file);
                         console.log('File uploaded successfully');
                       } catch (error) {
                         console.error('Error uploading file:', error);
                         alert('Erro ao enviar arquivo: ' + error.message);
                       }
                       e.target.value = ''; // Limpa o input file
                     }
                   }}
                 />
                  <input
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: isMobile ? 44 : 48,
                      fontSize: 18,
                      border: '2px solid #111',
                      borderRadius: 12,
                      padding: isMobile ? '10px 12px' : '12px 16px',
                      outline: 'none',
                      background: '#fafafa',
                      color: '#222',
                      fontFamily: 'inherit',
                      transition: 'border 0.2s',
                      margin: 0,
                      boxSizing: 'border-box',
                      display: 'block',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 4 }}>
                    {isMobile && (
                      <button
                        type="submit"
                        tabIndex={-1}
                        title="Enviar"
                        style={{
                          background: '#111',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          width: 44,
                          height: 44,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: 18,
                          flexShrink: 0,
                        }}
                      >
                        <FiSend size={22} />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Mensagem de áudio"
                      style={{
                        background: '#111',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        width: 44,
                        height: 44,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: 18,
                        flexShrink: 0,
                      }}
                    >
                      <FiMic size={22} />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              // Se não há chat selecionado e está em conversas ou contatos, mostra a mensagem
              (activeSidebar === 'conversas' || activeSidebar === 'contatos') && (
                <div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',color:'#888',fontSize:22,fontStyle:'italic',textAlign:'center',background:'#fff'}}>
                  Você ainda não mandou nenhuma mensagem
                </div>
              )
            )}
          </main>
        ) : null
      )}
      {/* Modal de novo contato */}
      {showNewContactModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.32)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
          onClick={() => setShowNewContactModal(false)}
        >
          <div style={{
            background: '#fff',
            borderRadius: 16,
            minWidth: 320,
            maxWidth: '90vw',
            minHeight: 180,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            padding: 32,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{fontWeight:600, fontSize:22, marginBottom:18, color:'#1976d2'}}>Novo Contato</div>
            <button onClick={() => setShowNewContactModal(false)} style={{position:'absolute',top:12,right:16,background:'none',border:'none',fontSize:26,cursor:'pointer',color:'#1976d2'}} title="Fechar">×</button>
            <form style={{width:'100%', maxWidth:340, display:'flex', flexDirection:'column', gap:16, marginTop:8}} onSubmit={async e => {
              e.preventDefault();
              setNewContactError("");
              if (!newContactName.trim() || !newContactEmail.trim()) {
                setNewContactError("Preencha nome e email.");
                return;
              }
              if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newContactEmail)) {
                setNewContactError("Email inválido.");
                return;
              }
              setSavingContact(true);
              try {
                // Cria novo contato no nó 'contacts/{user.uid}' (contato pessoal)
                await push(ref(db, `contacts/${user.uid}`), {
                  name: newContactName,
                  email: newContactEmail,
                  criadoEm: serverTimestamp()
                });
                setNewContactName("");
                setNewContactEmail("");
                setShowNewContactModal(false);
              } catch (err) {
                setNewContactError("Erro ao salvar contato: " + err.message);
              } finally {
                setSavingContact(false);
              }
            }}>
              <div style={{display:'flex', flexDirection:'column', gap:4}}>
                <label htmlFor="novo-nome" style={{fontWeight:500, color:'#1976d2'}}>Nome</label>
                <input id="novo-nome" name="nome" type="text" placeholder="Nome do contato" value={newContactName} onChange={e => setNewContactName(e.target.value)} style={{padding:'10px 12px', border:'1.5px solid #d1d5db', borderRadius:8, fontSize:16, outline:'none'}} disabled={savingContact} />
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:4}}>
                <label htmlFor="novo-email" style={{fontWeight:500, color:'#1976d2'}}>Email</label>
                <input id="novo-email" name="email" type="email" placeholder="email@exemplo.com" value={newContactEmail} onChange={e => setNewContactEmail(e.target.value)} style={{padding:'10px 12px', border:'1.5px solid #d1d5db', borderRadius:8, fontSize:16, outline:'none'}} disabled={savingContact} />
              </div>
              {newContactError && <div style={{color:'#d32f2f', fontSize:15, marginTop:-8}}>{newContactError}</div>}
              <button type="submit" style={{marginTop:8, background:'#1976d2', color:'#fff', border:'none', borderRadius:8, padding:'10px 0', fontWeight:600, fontSize:17, cursor:'pointer', transition:'background 0.2s', opacity:savingContact?0.7:1}} disabled={savingContact}>{savingContact ? 'Salvando...' : 'Salvar'}</button>
            </form>
          </div>
        </div>
      )}
      {/* Modal de confirmação de exclusão de chat */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.32)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div style={{
            background: '#fff',
            borderRadius: 16,
            minWidth: 320,
            maxWidth: '90vw',
            minHeight: 120,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            padding: 32,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{fontWeight:600, fontSize:20, marginBottom:18, color:'#d32f2f'}}>Excluir chat?</div>
            <div style={{color:'#888', fontSize:16, textAlign:'center', marginBottom:18}}>Tem certeza que deseja excluir todas as mensagens deste chat?<br/>Esta ação não pode ser desfeita.</div>
            <div style={{display:'flex', gap:16, marginTop:8}}>
              <button onClick={() => setShowDeleteModal(false)} style={{background:'#eee',color:'#222',border:'none',borderRadius:8,padding:'8px 22px',fontWeight:600,fontSize:16,cursor:'pointer'}}>Cancelar</button>
              <button onClick={async () => {
                setDeletingChat(true);
                try {
                  await set(ref(db, `chats/${chatToDelete}`), null);
                  setShowDeleteModal(false);
                  setChatToDelete(null);
                  if (selectedChat === chatToDelete) setSelectedChat('global');
                } catch (err) {
                  alert('Erro ao excluir chat: ' + err.message);
                }
                setDeletingChat(false);
              }} style={{background:'#d32f2f',color:'#fff',border:'none',borderRadius:8,padding:'8px 22px',fontWeight:600,fontSize:16,cursor:'pointer',opacity:deletingChat?0.7:1}} disabled={deletingChat}>{deletingChat ? 'Excluindo...' : 'Excluir'}</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de contatos removido, agora a lista aparece na área de chats */}
    </div>
  );
}

export default ChatApp;