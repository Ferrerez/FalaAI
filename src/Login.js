import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';
import './style.css';

function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [lembrar, setLembrar] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    
    if (!email || !senha) {
      setErro('Preencha todos os campos.');
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, senha);
    navigate('/chat');
    } catch (error) {
      console.error('Erro no login:', error);
      switch (error.code) {
        case 'auth/user-not-found':
          setErro('Usuário não encontrado.');
          break;
        case 'auth/wrong-password':
          setErro('Senha incorreta.');
          break;
        case 'auth/invalid-email':
          setErro('Email inválido.');
          break;
        case 'auth/too-many-requests':
          setErro('Muitas tentativas. Tente novamente mais tarde.');
          break;
        default:
          setErro('Erro ao fazer login. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-main">
      <div className="login-left">
        <img src={process.env.PUBLIC_URL + '/assets/images/bannerlogin.jpg'} alt="Banner de login" className="login-bg-img" />
      </div>
      <div className="login-right">
        <div className="login-box">
          <img src={process.env.PUBLIC_URL + '/assets/images/logoLogin.png'} alt="Logo FalaE" className="logo-login" />
          <h2 className="login-title">Simples, Seguro e totalmente BRASILEIRO.</h2>
          <p className="login-desc">
            Com o FalaAI, você terá mensagens rápidas, simples e seguras, disponível para todos.
          </p>
          <h3 className="login-subtitle">Entrar na sua conta</h3>
          <form id="loginForm" onSubmit={handleSubmit}>
            <div className="form-group">
              <input
                type="email"
                id="email"
                name="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="off"
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
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>
            {erro && <div className="fb-error-msg" style={{ marginBottom: 8 }}>{erro}</div>}
            <div className="lembrar-container">
              <label className="lembrar-label">
                <input
                  type="checkbox"
                  id="lembrar"
                  checked={lembrar}
                  onChange={e => setLembrar(e.target.checked)}
                />
                <span className="checkmark"></span>
                Lembrar-me
              </label>
            </div>
            <div className="esqueci-senha-container">
              <button 
                type="button" 
                className="btn btn-link p-0 text-decoration-none"
                onClick={() => alert('Recuperação de senha em breve!')}
              >
                Esqueci a senha?
              </button>
            </div>
            <button type="submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
          <p className="login-register">
            Não tem uma conta? <a href="/cadastro">Cadastre-se</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;