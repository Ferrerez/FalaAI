import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth, db } from './firebase';
import './style.css';

function Cadastro() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    
    if (!nome || !email || !senha || !confirmar) {
      setErro('Preencha todos os campos.');
      setLoading(false);
      return;
    }
    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.');
      setLoading(false);
      return;
    }
    if (senha !== confirmar) {
      setErro('As senhas não coincidem.');
      setLoading(false);
      return;
    }

    try {
      // Criar usuário no Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;

      // Atualizar perfil do usuário com o nome
      await updateProfile(user, {
        displayName: nome
      });

      // Salvar dados do usuário no Realtime Database
      await set(ref(db, `users/${user.uid}`), {
        nome: nome,
        email: email,
        createdAt: new Date().toISOString(),
        online: true
      });

      navigate('/chat');
    } catch (error) {
      console.error('Erro no cadastro:', error);
      switch (error.code) {
        case 'auth/email-already-in-use':
          setErro('Este email já está em uso.');
          break;
        case 'auth/invalid-email':
          setErro('Email inválido.');
          break;
        case 'auth/weak-password':
          setErro('A senha é muito fraca.');
          break;
        default:
          setErro('Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-main">
      <div className="login-left">
        <img src={process.env.PUBLIC_URL + '/assets/images/bannerlogin.jpg'} alt="Banner de cadastro" className="login-bg-img" />
      </div>
      <div className="login-right">
        <div className="login-box">
          <img src={process.env.PUBLIC_URL + '/assets/images/logoLogin.png'} alt="Logo FalaAI" className="logo-login" />
          <h2 className="login-title">Simples, Seguro e totalmente BRASILEIRO.</h2>
          <p className="login-desc">
            Com o FalaAI, você terá mensagens rápidas, simples e seguras, disponível para todos.
          </p>
          <h3 className="login-subtitle">Crie sua conta no FalaAI</h3>
          <form id="cadastroForm" onSubmit={handleSubmit}>
            <div className="form-group">
              <input
                type="text"
                id="nome"
                name="nome"
                placeholder="Nome completo"
                value={nome}
                onChange={e => setNome(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
            <div className="form-group">
              <input
                type="email"
                id="email"
                name="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="form-group">
              <div className="password-container">
                <input
                  type="password"
                  id="senha"
                  name="senha"
                  placeholder="Nova senha"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <div className="password-container">
                <input
                  type="password"
                  id="confirmar"
                  name="confirmar"
                  placeholder="Confirmar senha"
                  value={confirmar}
                  onChange={e => setConfirmar(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>
            {erro && <div className="fb-error-msg" style={{ marginBottom: 8 }}>{erro}</div>}
            <button type="submit" id="cadastroBtn" disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar Conta'}
            </button>
          </form>
          <p className="login-register">
            Já tem uma conta? <Link to="/">Faça login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Cadastro;