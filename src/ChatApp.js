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
import { Picker } from 'emoji-mart';
import 'emoji-mart/css/emoji-mart.css';

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
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedGroupContacts, setSelectedGroupContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiModal, setShowEmojiModal] = useState(false);
  const emojiList = ['😀','😂','😍','😎','😊','😉','😢','😭','😡','👍','🙏','👏','🎉','❤️','🔥','😱','😅','��','🤔','😇','🥰'];
  // 1. Adicionar um ref para o botão de emoji
  const emojiBtnRef = useRef(null);
  const [emojiModalPos, setEmojiModalPos] = useState({top: 0, left: 0});
  const emojiModalRef = useRef(null);
  // Estado para menu flutuante do grupo
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const groupMenuBtnRef = useRef(null);

  // Hook para fechar o balão de emoji ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        showEmojiModal &&
        emojiModalRef.current &&
        !emojiModalRef.current.contains(event.target) &&
        emojiBtnRef.current &&
        !emojiBtnRef.current.contains(event.target)
      ) {
        setShowEmojiModal(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showEmojiModal]);

  // Hook para fechar o menu flutuante do grupo ao clicar fora
  useEffect(() => {
    if (!showGroupMenu) return;
    function handleClickOutside(event) {
      if (
        groupMenuBtnRef.current &&
        !groupMenuBtnRef.current.contains(event.target)
      ) {
        setShowGroupMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showGroupMenu]);

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

  // Carregar grupos do Firebase
  useEffect(() => {
    if (!user) return;
    const groupsRef = ref(db, 'groups');
    const unsubscribe = onValue(groupsRef, (snapshot) => {
      const groupsData = [];
      snapshot.forEach((childSnapshot) => {
        const group = childSnapshot.val();
        if (group.members && group.members.includes(user.uid)) {
          groupsData.push({ id: childSnapshot.key, ...group });
        }
      });
      setGroups(groupsData);
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

  // Função para verificar se o usuário é membro do grupo selecionado
  const isUserInSelectedGroup = () => {
    const group = groups.find(g => g.id === selectedChat);
    if (!group) return false;
    return group.members && group.members.includes(user.uid);
  };

  // Função para saber se o chat selecionado é um grupo
  const isSelectedChatGroup = () => {
    return groups && groups.find(g => g.id === selectedChat);
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

  // 2. Ao abrir o modal, calcular a posição do botão de emoji
  const openEmojiModal = () => {
    if (emojiBtnRef.current) {
      const rect = emojiBtnRef.current.getBoundingClientRect();
      setEmojiModalPos({
        top: rect.top - 70, // 70px acima do botão
        left: rect.left + rect.width/2 - 140 // centraliza o balão de 280px
      });
    }
    setShowEmojiModal(true);
  };

  // Função para sair do grupo
  const handleLeaveGroup = async () => {
    // Remove o usuário do grupo no Firebase
    const group = groups.find(g => g.id === selectedChat);
    if (!group) return;
    const newMembers = group.members.filter(uid => uid !== user.uid);
    await set(ref(db, `groups/${group.id}/members`), newMembers);
    setShowGroupMenu(false);
    // Se o usuário não for mais membro, sair do chat
    if (!newMembers.includes(user.uid)) {
      setSelectedChat(null);
    }
  };

  // Função para apagar grupo (só aparece se o usuário já saiu)
  const handleDeleteGroup = () => {
    set(ref(db, `groups/${selectedChat}`), null);
    setSelectedChat(null);
    setShowGroupMenu(false);
  };

  // Função para limpar conversa
  const handleClearGroupChat = async () => {
    await set(ref(db, `chats/${selectedChat}/messages`), null);
    setShowGroupMenu(false);
  };

  return (
    <div className="chat-app-container">
      {/* Sidebar e lista de chats juntos no mobile quando showChat for false */}
      {(!isMobile || (isMobile && !showChat)) && (
        <>
          {/* Removido o <aside className="sidebar" ...> da versão web */}
          <section className="chat-list-section" style={{position:'relative'}}>
            <div className="chat-list-logo" style={{display:'flex', alignItems:'center', justifyContent:'center', width:'100%', position:'relative', paddingRight:48}}>
              <img src={process.env.PUBLIC_URL + '/assets/images/logoLogin.png'} alt="Logo" className="chat-list-logo-img" />
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  boxShadow: 'none',
                  outline: 'none',
                  position: 'absolute',
                  right: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 28,
                  color: '#1976d2',
                  cursor: 'pointer',
                  padding: 8,
                  zIndex: 10
                }}
                onClick={() => setShowMenu(v => !v)}
                title="Menu"
              >
                <FiMoreVertical />
              </button>
              {showMenu && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: 48,
                  background: '#fff',
                  borderRadius: 10,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                  minWidth: 180,
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  padding: '8px 0',
                }}
                  onClick={e => e.stopPropagation()}
                >
                  <button style={{background:'none',border:'none',padding:'12px 20px',textAlign:'left',fontSize:16,cursor:'pointer',color:'#222'}} onClick={() => {setShowMenu(false); /* abrir modal de configurações futuramente */}}>Configurações</button>
                  <button style={{background:'none',border:'none',padding:'12px 20px',textAlign:'left',fontSize:16,cursor:'pointer',color:'#222'}} onClick={() => {setShowMenu(false); /* abrir modal de temas futuramente */}}>Temas</button>
                  <button style={{background:'none',border:'none',padding:'12px 20px',textAlign:'left',fontSize:16,cursor:'pointer',color:'#d32f2f'}} onClick={handleLogout}>Sair</button>
                </div>
              )}
            </div>
            <div className="chat-list-header">
              <input 
                className="chat-search" 
                placeholder="Pesquisar" 
                onFocus={() => setShowSearchModal(true)}
                readOnly
                style={{cursor:'pointer', background:'#f3f4f6', border:'1.5px solid #23263a', color:'#111'}}
              />
            </div>
            {/* Modal de pesquisa de chats */}
            {showSearchModal && (
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
                onClick={() => setShowSearchModal(false)}
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
                  maxHeight: '80vh',
                  overflowY: 'auto',
                }}
                  onClick={e => e.stopPropagation()}
                >
                  <div style={{fontWeight:600, fontSize:22, marginBottom:18, color:'#1976d2'}}>Pesquisar chats</div>
                  <button onClick={() => setShowSearchModal(false)} style={{position:'absolute',top:12,right:16,background:'none',border:'none',fontSize:26,cursor:'pointer',color:'#1976d2'}} title="Fechar">×</button>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Digite o nome do chat..."
                    value={searchTerm}
                    onChange={e => {
                      setSearchTerm(e.target.value);
                      const term = e.target.value.toLowerCase();
                      const results = users.filter(u => (u.displayName || u.email).toLowerCase().includes(term));
                      setSearchResults(results);
                    }}
                    style={{padding:'10px 12px', border:'1.5px solid #d1d5db', borderRadius:8, fontSize:16, outline:'none', width:'100%', maxWidth:340, marginBottom:16}}
                  />
                  <div style={{width:'100%', maxWidth:340, display:'flex', flexDirection:'column', gap:8, marginBottom:16}}>
                    {searchTerm && searchResults.length === 0 && (
                      <div style={{color:'#888', fontStyle:'italic', textAlign:'center', padding:'24px 0'}}>Nenhum chat encontrado.</div>
                    )}
                    {searchResults.map((u) => {
                      const chatId = [user.uid, u.id].sort().join('_');
                      return (
                        <button key={u.id} style={{
                          display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:8,border:'1.5px solid #d1d5db',background:'#f7f7f7',cursor:'pointer',fontSize:16,transition:'background 0.18s',color:'#222',fontWeight:500
                        }}
                onClick={() => {
                            setSelectedChat(chatId);
                            setActiveSidebar('conversas');
                            setShowSearchModal(false);
                            setTimeout(() => { if (isMobile) setShowChat(true); }, 0);
                          }}
                        >
                          <div style={{background:'#1976d2',color:'#fff',fontWeight:600,fontSize:18,width:36,height:36,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            {u.displayName ? u.displayName[0].toUpperCase() : (u.email ? u.email[0].toUpperCase() : '?')}
                          </div>
                          <div style={{flex:1,minWidth:0,textAlign:'left'}}>
                            <div style={{fontWeight:600,fontSize:16}}>{u.displayName || u.email}</div>
                            <div style={{fontSize:14,color:'#888'}}>{u.email}</div>
                          </div>
              </button>
                      );
                    })}
            </div>
            </div>
              </div>
            )}
            <div className="chat-list-title" style={{
  fontWeight:600,
  fontSize:20,
  marginTop:10,
  marginBottom:10,
  textAlign:'center',
  background:'#f3f4f6',
  border:'1.5px solid #23263a',
  borderRadius:12,
  color:'#111',
}}>
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
              {/* Grupos */}
              {activeSidebar === 'grupos' && groups.length === 0 && (
                <li className="chat-list-item" style={{justifyContent:'center', color:'#888', fontStyle:'italic', padding:'32px 0', textAlign:'center'}}>Nenhum grupo encontrado.</li>
              )}
              {activeSidebar === 'grupos' && groups.map((group) => (
                <li key={group.id} className={`chat-list-item${selectedChat === group.id ? ' active' : ''}`} style={{cursor:'pointer'}} onClick={() => {
                  setSelectedChat(group.id);
                  setActiveSidebar('grupos');
                  setTimeout(() => { if (isMobile) setShowChat(true); }, 0);
                }}>
                  <div style={{background:'#1976d2',color:'#fff',fontWeight:600,fontSize:18,width:44,height:44,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {group.name ? group.name[0].toUpperCase() : '?'}
                  </div>
                  <div className="chat-info">
                    <div className="chat-title">{group.name}</div>
                    <div className="chat-last-msg">{group.members && group.members.length} Membro{group.members && group.members.length > 1 ? 's' : ''}</div>
                  </div>
                </li>
              ))}
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
            {/* Botão flutuante de novo contato ou grupo */}
            {(
              (!isMobile && activeSidebar === 'conversas') ||
              (isMobile && !showChat && activeSidebar === 'conversas')
            ) && (
              <button 
                className="fab-novo-contato"
                title="Novo chat"
                style={{
                  position: 'absolute',
                  bottom: 80,
                  right: 32,
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'rgba(25, 118, 210, 0.75)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 16px rgba(25,118,210,0.18)',
                  fontSize: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2000,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  backdropFilter: 'blur(2px)',
                }}
                onClick={() => setShowContactsModal(true)}
              >
                +
              </button>
            )}
            {(
              (!isMobile && activeSidebar === 'grupos') ||
              (isMobile && !showChat && activeSidebar === 'grupos')
            ) && (
              <button 
                className="fab-novo-contato"
                title="Criar grupo"
                style={{
                  position: 'absolute',
                  bottom: 140, // Subiu o botão
                  right: 32,
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'rgba(25, 118, 210, 0.75)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 16px rgba(25,118,210,0.18)',
                  fontSize: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2000,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  backdropFilter: 'blur(2px)',
                }}
                onClick={() => setShowCreateGroupModal(true)}
              >
                <FiPlus />
              </button>
            )}
            {/* Modal de contatos salvos para novo chat */}
            {showContactsModal && (
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
                onClick={() => setShowContactsModal(false)}
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
                  maxHeight: '80vh',
                  overflowY: 'auto',
                }}
                  onClick={e => e.stopPropagation()}
                >
                  <div style={{fontWeight:600, fontSize:22, marginBottom:18, color:'#1976d2'}}>Contatos</div>
                  <button onClick={() => setShowContactsModal(false)} style={{position:'absolute',top:12,right:16,background:'none',border:'none',fontSize:26,cursor:'pointer',color:'#1976d2'}} title="Fechar">×</button>
                  <div style={{width:'100%', maxWidth:340, display:'flex', flexDirection:'column', gap:8, marginBottom:16}}>
                    {personalContacts.length === 0 && (
                      <div style={{color:'#888', fontStyle:'italic', textAlign:'center', padding:'24px 0'}}>Nenhum contato salvo ainda.</div>
                    )}
                    {personalContacts.map((contact) => (
                      <button key={contact.id} style={{
                        display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:8,border:'1.5px solid #d1d5db',background:'#f7f7f7',cursor:'pointer',fontSize:16,transition:'background 0.18s',color:'#222',fontWeight:500
                      }}
                        onClick={() => {
                          // Seleciona o contato e inicia o chat
                          let existingUser = users.find(u => u.email === contact.email);
                          let chatId;
                          if (existingUser) {
                            chatId = [user.uid, existingUser.id].sort().join('_');
                          } else {
                            const safeEmail = contact.email.replace(/[.#$\[\]]/g, '_');
                            chatId = [user.uid, safeEmail].sort().join('_');
                          }
                          setSelectedChat(chatId);
                          setActiveSidebar('conversas');
                          setShowContactsModal(false);
                          setTimeout(() => { if (isMobile) setShowChat(true); }, 0);
                        }}
                      >
                        <div style={{background:'#1976d2',color:'#fff',fontWeight:600,fontSize:18,width:36,height:36,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {contact.name ? contact.name[0].toUpperCase() : '?'}
                        </div>
                        <div style={{flex:1,minWidth:0,textAlign:'left'}}>
                          <div style={{fontWeight:600,fontSize:16}}>{contact.name}</div>
                          <div style={{fontSize:14,color:'#888'}}>{contact.email}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => { setShowContactsModal(false); setShowNewContactModal(true); }} style={{marginTop:8, background:'#1976d2', color:'#fff', border:'none', borderRadius:8, padding:'12px 0', fontWeight:600, fontSize:17, cursor:'pointer', transition:'background 0.2s', width:'100%', maxWidth:340}}>
                    Adicionar novo contato
                  </button>
                </div>
              </div>
            )}
            {/* Modal de criação de grupo */}
            {showCreateGroupModal && (
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
                onClick={() => setShowCreateGroupModal(false)}
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
                  maxHeight: '80vh',
                  overflowY: 'auto',
                }}
                  onClick={e => e.stopPropagation()}
                >
                  <div style={{fontWeight:600, fontSize:22, marginBottom:18, color:'#1976d2'}}>Criar novo grupo</div>
                  <button onClick={() => setShowCreateGroupModal(false)} style={{position:'absolute',top:12,right:16,background:'none',border:'none',fontSize:26,cursor:'pointer',color:'#1976d2'}} title="Fechar">×</button>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Nome do grupo"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    style={{padding:'10px 12px', border:'1.5px solid #d1d5db', borderRadius:8, fontSize:16, outline:'none', width:'100%', maxWidth:340, marginBottom:16}}
                  />
                  <div style={{width:'100%', maxWidth:340, display:'flex', flexDirection:'column', gap:8, marginBottom:16}}>
                    {personalContacts.length === 0 && (
                      <div style={{color:'#888', fontStyle:'italic', textAlign:'center', padding:'24px 0'}}>Nenhum contato salvo ainda.</div>
                    )}
                    {personalContacts.map((contact) => (
                      <label key={contact.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',cursor:'pointer'}}>
                        <input
                          type="checkbox"
                          checked={selectedGroupContacts.includes(contact.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedGroupContacts(prev => [...prev, contact.id]);
                            } else {
                              setSelectedGroupContacts(prev => prev.filter(id => id !== contact.id));
                            }
                          }}
                        />
                        <div style={{background:'#1976d2',color:'#fff',fontWeight:600,fontSize:16,width:32,height:32,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {contact.name ? contact.name[0].toUpperCase() : '?'}
                        </div>
                        <div style={{flex:1,minWidth:0,textAlign:'left'}}>
                          <div style={{fontWeight:600,fontSize:15}}>{contact.name}</div>
                          <div style={{fontSize:13,color:'#888'}}>{contact.email}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={async () => {
                      if (!newGroupName.trim() || selectedGroupContacts.length === 0) return;
                      const groupRef = push(ref(db, 'groups'));
                      await set(groupRef, {
                        name: newGroupName.trim(),
                        members: [user.uid, ...selectedGroupContacts],
                        createdBy: user.uid,
                        createdAt: Date.now()
                      });
                      setShowCreateGroupModal(false);
                      setNewGroupName("");
                      setSelectedGroupContacts([]);
                    }}
                    style={{marginTop:8, background:'#1976d2', color:'#fff', border:'none', borderRadius:8, padding:'12px 0', fontWeight:600, fontSize:17, cursor:'pointer', transition:'background 0.2s', width:'100%', maxWidth:340}}
                    disabled={!newGroupName.trim() || selectedGroupContacts.length === 0}
                  >
                    Criar grupo
                  </button>
                </div>
              </div>
            )}
            {/* Sidebar de menus na parte de baixo da lista de chats */}
            <div style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 24,
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
              gap: 18,
              zIndex: 1001,
              pointerEvents: 'auto',
            }}>
              {/* Conversas */}
              <button
                onClick={() => {
                  setActiveSidebar('conversas');
                  if (selectedChat && !chatsWithMessages.includes(selectedChat)) {
                    setSelectedChat(null);
                  }
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: '#fff',
                  color: '#23263a',
                  border: '2px solid #111',
                  borderRadius: 12,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                  padding: '0 12px',
                  fontWeight: 700,
                  fontSize: 16,
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0,
                  cursor: 'pointer',
                  outline: activeSidebar === 'conversas' ? '2px solid #1976d2' : 'none',
                  transition: 'outline 0.2s, border 0.2s',
                  height: 40,
                  minHeight: 0,
                  maxHeight: 40,
                  margin: 2,
                }}
                title="Conversas"
              >
                <span style={{ fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 6 }}>💬</span>
                <span style={{ fontSize: 15, color: '#23263a', fontWeight: 700 }}>Conversas</span>
              </button>
              {/* Grupos */}
              <button
                onClick={() => {
                  setActiveSidebar('grupos');
                  setSelectedChat(null);
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: '#fff',
                  color: '#23263a',
                  border: '2px solid #111',
                  borderRadius: 12,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                  padding: '0 12px',
                  fontWeight: 700,
                  fontSize: 16,
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0,
                  cursor: 'pointer',
                  outline: activeSidebar === 'grupos' ? '2px solid #1976d2' : 'none',
                  transition: 'outline 0.2s, border 0.2s',
                  height: 40,
                  minHeight: 0,
                  maxHeight: 40,
                  margin: 2,
                }}
                title="Grupos"
              >
                <span style={{ fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 6 }}>👥</span>
                <span style={{ fontSize: 15, color: '#23263a', fontWeight: 700 }}>Grupos</span>
              </button>
            </div>
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
                    {/* Se for grupo, mostra avatar e nome do grupo */}
                    {groups && groups.find(g => g.id === selectedChat) ? (
                      <>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1976d2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 18, marginRight: 6 }}>
                          {groups.find(g => g.id === selectedChat)?.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span style={{fontWeight:600, fontSize:18}}>{groups.find(g => g.id === selectedChat)?.name || 'Grupo'}</span>
                      </>
                    ) : (
                      // Caso contrário, mostra avatar e nome do contato
                      getChatContact() && (
                      getChatContact().photoURL ? (
                        <img src={getChatContact().photoURL} alt={getChatName()} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', marginRight: 6 }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1976d2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 18, marginRight: 6 }}>
                          {getChatContact().displayName ? getChatContact().displayName[0].toUpperCase() : (getChatContact().email ? getChatContact().email[0].toUpperCase() : '?')}
                        </div>
                        )
                      )
                    )}
                    {/* Nome do contato ou grupo */}
                    {groups && groups.find(g => g.id === selectedChat) ? null : getChatName()}
                  </div>
                  <div className="chat-header-actions" style={{ position: 'relative' }}>
                    <button><FiSearch /></button>
                    <button><FiPhone /></button>
                    {groups && groups.find(g => g.id === selectedChat) ? (
                      <button ref={groupMenuBtnRef} onClick={() => setShowGroupMenu(v => !v)} style={{ position: 'relative' }}>
                        <FiMoreVertical />
                      </button>
                    ) : (
                      <button><FiMoreVertical /></button>
                    )}
                    {/* Menu flutuante do grupo */}
                    {showGroupMenu && (
                      <div style={{
                        position: 'absolute',
                        top: 36,
                        right: 0,
                        background: '#fff',
                        border: '2px solid #111',
                        borderRadius: 12,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                        minWidth: 180,
                        zIndex: 2000,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        padding: '8px 0',
                      }}
                        onClick={e => e.stopPropagation()}
                      >
                        {isSelectedChatGroup() && isUserInSelectedGroup() ? (
                          <button style={{background:'none',border:'none',padding:'12px 20px',textAlign:'left',fontSize:16,cursor:'pointer',color:'#d32f2f'}} onClick={handleLeaveGroup}>Sair do grupo</button>
                        ) : (
                          <button style={{background:'none',border:'none',padding:'12px 20px',textAlign:'left',fontSize:16,cursor:'pointer',color:'#d32f2f'}} onClick={handleDeleteGroup}>Apagar grupo</button>
                        )}
                        <button style={{background:'none',border:'none',padding:'12px 20px',textAlign:'left',fontSize:16,cursor:'pointer',color:'#222'}} onClick={handleClearGroupChat}>Limpar conversa</button>
                      </div>
                    )}
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
                    position: 'relative', // Para ancorar o balão
                    zIndex: 2,
                    flex: '0 0 auto',
                    opacity: isSelectedChatGroup() && !isUserInSelectedGroup() ? 0.5 : 1,
                    pointerEvents: isSelectedChatGroup() && !isUserInSelectedGroup() ? 'none' : 'auto',
                  }}
                  onSubmit={handleSendMessage}
                  autoComplete="off"
                >
                  {/* Ícone de emoji */}
                  <button
                    type="button"
                    title="Emoji"
                    ref={emojiBtnRef}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, marginRight: 4, color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={openEmojiModal}
                  >
                    <FiSmile />
                  </button>
                  {/* Modal de emojis balão dentro do form */}
                  {showEmojiModal && (
                    <div
                      ref={emojiModalRef}
                      style={isMobile ? {
                        position: 'fixed',
                        left: '50%',
                        bottom: 70,
                        transform: 'translateX(-50%)',
                        zIndex: 9999,
                        width: '95vw',
                        maxWidth: 340,
                        minWidth: 220,
                        boxSizing: 'border-box',
                      } : {
                        position: 'absolute',
                        left: '50%',
                        bottom: 56,
                        transform: 'translateX(-50%)',
                        zIndex: 9999,
                      }}
                      onClick={e => e.stopPropagation()}
                      onTouchStart={e => e.stopPropagation()}
                    >
                      <Picker
                        set="apple"
                        theme="light"
                        showPreview={false}
                        showSkinTones={false}
                        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.13)', borderRadius: 14, width: '100%' }}
                        onSelect={emoji => {
                          setNewMessage(msg => msg + emoji.native);
                          setShowEmojiModal(false);
                        }}
                        i18n={{
                          search: 'Buscar',
                          clear: 'Limpar',
                          notfound: 'Nenhum emoji encontrado',
                          skintext: 'Escolha o tom de pele padrão',
                          categories: {
                            search: 'Resultados da busca',
                            recent: 'Usados recentemente',
                            smileys: 'Emoções',
                            people: 'Pessoas',
                            nature: 'Animais & Natureza',
                            foods: 'Comidas & Bebidas',
                            activity: 'Atividades',
                            places: 'Viagens & Lugares',
                            objects: 'Objetos',
                            symbols: 'Símbolos',
                            flags: 'Bandeiras',
                            custom: 'Personalizados',
                          },
                          categorieslabel: 'Categorias',
                          skintones: {
                            1: 'Pele padrão',
                            2: 'Pele clara',
                            3: 'Pele morena clara',
                            4: 'Pele morena',
                            5: 'Pele escura',
                            6: 'Pele muito escura',
                          },
                          recent: 'Usados recentemente',
                        }}
                      />
                    </div>
                  )}
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