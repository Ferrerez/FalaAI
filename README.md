# FalaAI Chat

Um aplicativo de chat em tempo real desenvolvido com React e Firebase, oferecendo uma experiência de mensagens simples, segura e totalmente brasileira.

## 🚀 Funcionalidades

- **Autenticação Firebase**: Login e cadastro de usuários
- **Chat em Tempo Real**: Mensagens instantâneas usando Firebase Realtime Database
- **Status Online**: Visualização de usuários online
- **Interface Responsiva**: Design moderno e adaptável para mobile
- **Proteção de Rotas**: Acesso restrito apenas para usuários autenticados

## 🛠️ Tecnologias Utilizadas

- **React 18**: Framework frontend
- **Firebase**: Autenticação e banco de dados em tempo real
- **React Router**: Navegação entre páginas
- **CSS3**: Estilização personalizada

## 📦 Instalação

1. Clone o repositório:
```bash
git clone [url-do-repositorio]
cd falaai-chat
```

2. Instale as dependências:
```bash
npm install
```

3. Configure o Firebase:
   - Crie um projeto no [Firebase Console](https://console.firebase.google.com/)
   - Ative Authentication com Email/Password
   - Ative Realtime Database
   - Copie as credenciais para `src/firebase.js`

4. Execute o projeto:
```bash
npm start
```

## 🔧 Configuração do Firebase

### 1. Authentication
- Vá para Authentication > Sign-in method
- Ative "Email/Password"

### 2. Realtime Database
- Vá para Realtime Database
- Crie um banco de dados
- Configure as regras de segurança:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid == $uid"
      }
    },
    "messages": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

## 📱 Como Usar

1. **Cadastro**: Crie uma conta com nome, email e senha
2. **Login**: Faça login com suas credenciais
3. **Chat**: Envie e receba mensagens em tempo real
4. **Usuários Online**: Veja quem está conectado
5. **Logout**: Clique em "Sair" para desconectar

## 🎨 Interface

- **Design Moderno**: Interface limpa e intuitiva
- **Responsivo**: Funciona em desktop e mobile
- **Tema Brasileiro**: Cores e identidade visual brasileira
- **Animações**: Transições suaves e feedback visual

## 🔒 Segurança

- Autenticação obrigatória para acessar o chat
- Dados de usuário protegidos
- Regras de segurança no Firebase
- Logout automático ao fechar o navegador

## 🚀 Deploy

Para fazer deploy:

1. Build do projeto:
```bash
npm run build
```

2. Deploy no Firebase Hosting:
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## 📄 Licença

Este projeto está sob a licença MIT.

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues e pull requests.

---

**FalaAI Chat** - Simples, Seguro e totalmente BRASILEIRO! 🇧🇷
