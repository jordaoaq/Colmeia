# Configuração do Firebase Anonymous Auth

## 📋 O que foi implementado

Adicionamos a funcionalidade de **Login Anônimo** no app Colmeia, permitindo que usuários explorem o aplicativo sem criar uma conta imediatamente.

### Funcionalidades:

- ✅ Botão "Explorar como visitante" na tela de login
- ✅ Banner de usuário anônimo na tela principal
- ✅ Conversão de usuário anônimo para permanente
- ✅ Indicador visual de modo visitante

## 🔧 Configuração necessária no Firebase Console

Para que o login anônimo funcione, você precisa habilitar a autenticação anônima no Firebase Console:

### Passo a passo:

1. **Acesse o Firebase Console**

   - Vá para: https://console.firebase.google.com
   - Selecione seu projeto (Colmeia)

2. **Navegue até Authentication**

   - No menu lateral, clique em **Authentication**
   - Clique na aba **Sign-in method**

3. **Habilite Anonymous Authentication**
   - Encontre o provedor **Anonymous** na lista
   - Clique nele
   - Ative o toggle **Enable**
   - Clique em **Save**

### Print de referência:

```
Authentication > Sign-in method > Anonymous
Status: [ ] Disabled  [✓] Enabled
```

## 📱 Como funciona no app

### 1. Login Anônimo

- Na tela de login, clique em "Explorar como visitante"
- O usuário é autenticado automaticamente sem precisar de email/senha
- Um banner laranja aparece no topo indicando "Modo Visitante"

### 2. Navegação

- O usuário anônimo pode:
  - Ver o dashboard
  - Navegar pelas telas
  - Entrar em colmeias existentes
  - **Limitação**: Algumas funcionalidades podem exigir conta permanente

### 3. Converter para conta permanente

- Clique no botão "Criar Conta" no banner laranja
- Ou acesse a tela de cadastro normalmente
- Preencha email e senha
- O sistema converterá automaticamente o usuário anônimo em permanente
- Todos os dados são mantidos (colmeias, tarefas, etc.)

## 🔐 Segurança

### Firebase Authentication Anonymous

O Firebase gerencia automaticamente:

- Criação de UID único para cada usuário anônimo
- Tokens de autenticação
- Sessão persistente
- Conversão segura para conta permanente

### Firestore Rules

Certifique-se de que suas regras do Firestore permitem leitura/escrita para usuários autenticados (incluindo anônimos):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir acesso a usuários autenticados (incluindo anônimos)
    match /colmeias/{colmeiaId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

## 📊 Vantagens do Login Anônimo

1. **Menor fricção**: Usuários podem testar o app sem compromisso
2. **Conversão gradual**: Converter visitantes em usuários permanentes
3. **Demonstrações**: Ideal para apresentações e demos
4. **Onboarding**: Usuários exploram antes de decidir criar conta

## 🎯 Casos de Uso

- **Apresentações**: Mostrar o app sem precisar criar contas demo
- **Testes**: Permitir que pessoas testem o app rapidamente
- **Onboarding**: Reduzir barreira de entrada
- **Colaboração**: Visitantes podem entrar em colmeias por convite antes de criar conta

## 🐛 Troubleshooting

### Erro: "Anonymous sign-in is not enabled"

**Solução**: Habilite o provedor Anonymous no Firebase Console (veja passos acima)

### Erro ao converter para permanente

**Causa comum**: Email já está em uso em outra conta
**Solução**: Use um email diferente ou faça login com a conta existente

### Usuário perde dados após logout

**Causa**: Usuário anônimo não converteu para permanente
**Solução**: Sempre converta para conta permanente antes de fazer logout

## 📚 Documentação Oficial

- [Firebase Anonymous Authentication](https://firebase.google.com/docs/auth/web/anonymous-auth)
- [Convert Anonymous to Permanent](https://firebase.google.com/docs/auth/web/account-linking)

---

**Nota**: Lembre-se de habilitar o provedor Anonymous no Firebase Console antes de testar!
