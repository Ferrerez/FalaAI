// Teste de conexão com Firebase
import { ref, push, onValue, set, serverTimestamp } from 'firebase/database';
import { db } from './src/firebase';

console.log('Testando conexão com Firebase...');

// Teste 1: Verificar se consegue ler dados
const testRef = ref(db, 'test');
onValue(testRef, (snapshot) => {
  console.log('✅ Leitura funcionando:', snapshot.val());
}, (error) => {
  console.error('❌ Erro na leitura:', error);
});

// Teste 2: Verificar se consegue escrever dados
set(testRef, {
  message: 'Teste de conexão',
  timestamp: serverTimestamp()
}).then(() => {
  console.log('✅ Escrita funcionando');
}).catch((error) => {
  console.error('❌ Erro na escrita:', error);
});

// Teste 3: Verificar se consegue enviar mensagem
const messagesRef = ref(db, 'chats/global/messages');
push(messagesRef, {
  userId: 'test-user',
  userName: 'Usuário Teste',
  text: 'Mensagem de teste',
  timestamp: Date.now()
}).then(() => {
  console.log('✅ Envio de mensagem funcionando');
}).catch((error) => {
  console.error('❌ Erro no envio de mensagem:', error);
});

console.log('Testes iniciados. Verifique o console do navegador.'); 