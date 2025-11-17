# Colmeia

Colmeia é um aplicativo colaborativo para organização de tarefas, compras, rotinas e finanças de grupos, famílias ou repúblicas. Ele foi desenvolvido para facilitar a vida em comunidade, promovendo transparência, divisão de responsabilidades e praticidade no dia a dia.

## Funcionalidades principais

- **Tarefas**: Crie, edite e acompanhe tarefas em aberto, com visualização clara do que está pendente.
- **Rotinas**: Gerencie rotinas domésticas com calendário dinâmico e visual, adaptado ao tema escolhido. Agora com entrada flexível para horários agendados, permitindo maior personalização.
- **Compras**: Lista de compras compartilhada, com categorias, unidades, preço por unidade/peso e cálculo automático de subtotal. Possui área de "total" que exibe o custo total das compras em tempo real.
- **Finanças**: Controle de despesas do grupo, com visualização de gastos semanais e mensais.
- **Colmeias**: Crie ou entre em diferentes grupos (colmeias) usando código de convite.
- **Sistema de votação**: Para grupos com 3 ou mais membros, ações como deletar tarefas, itens de compra, despesas e remover membros requerem votação democrática.
- **Temas sazonais**: Interface personalizável com temas de primavera, verão, outono e inverno, em versões dia e noite.
- **Feed de atividades**: Acompanhe todas as ações realizadas pelos membros do grupo em tempo real.

## Tecnologias utilizadas

- React Native (Expo)
- TypeScript
- Firebase Firestore & Authentication
- React Navigation
- React Native Calendars
- AsyncStorage
- Sistema de votação customizado
- Sistema de logs de atividades

## Como rodar o projeto

1. Instale as dependências:
   ```bash
   npm install
   npx expo install
   ```
2. Configure as variáveis de ambiente do Firebase:

   - Copie o arquivo `.env.example` para `.env`:
     ```bash
     cp .env.example .env
     ```
   - Edite o `.env` e preencha com suas credenciais do Firebase

   As variáveis necessárias são:

   - FIREBASE_API_KEY
   - FIREBASE_AUTH_DOMAIN
   - FIREBASE_PROJECT_ID
   - FIREBASE_STORAGE_BUCKET
   - FIREBASE_MESSAGING_SENDER_ID
   - FIREBASE_APP_ID

   **Nunca compartilhe seu `.env` no repositório!**

3. Rode o app:

   ```bash
   npx expo start
   ```

   **Nota:** O projeto usa `expo-constants` para carregar variáveis de ambiente do `.env` via `app.config.js`.

## Estrutura de pastas

- `app/` - Telas principais do app
  - `(auth)/` - Telas de autenticação (login, signup)
  - `(app)/` - Telas principais da aplicação (home, tarefas, compras, finanças, rotinas, colmeias)
- `components/` - Componentes reutilizáveis (botões, modals, etc)
- `contexts/` - Contextos globais (tema, colmeia ativa)
- `hooks/` - Hooks customizados
- `utils/` - Funções utilitárias (votingSystem, activityLogger)
- `constants/` - Temas e constantes
- `assets/` - Imagens e recursos estáticos

## Segurança e boas práticas

- Nunca commite arquivos `.env` ou credenciais sensíveis.
- Use sempre o `.env.example` para compartilhar o modelo de variáveis com o time.
- Se vazar uma chave, gere uma nova no Firebase e atualize o `.env`.

## Onboarding rápido para novos colaboradores

1. Faça o clone do repositório.
2. Instale as dependências com `npm install` e `npx expo install`.
3. Copie `.env.example` para `.env` e solicite as credenciais ao responsável.
4. Rode o app com `npx expo start`.

## Diferenciais

- Interface moderna, responsiva e acessível
- Cores e calendário dinâmicos conforme o tema
- Cálculo inteligente de subtotais e total geral nas compras
- Dashboard com métricas úteis para o grupo
- Sistema de votação democrático para grupos maiores
- Feed de atividades em tempo real
- Entrada flexível para horários nas rotinas
- Experiência pensada para uso real em repúblicas, famílias e grupos
- TypeScript para maior segurança de tipos e manutenibilidade

## Licença

Projeto privado. O uso, distribuição ou cópia não são permitidos sem autorização dos autores.
