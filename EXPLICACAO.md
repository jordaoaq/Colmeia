# Explicação Detalhada do App Colmeia

O Colmeia é um aplicativo colaborativo para grupos, repúblicas e famílias organizarem tarefas, compras, rotinas e finanças. Este documento explica como cada funcionalidade é implementada no código, como as alterações são feitas, e destaca as principais interfaces TypeScript e fluxos de dados.

## Visão Geral da Arquitetura

O app é modularizado em telas (pasta `app/`), componentes reutilizáveis (`components/`), contextos globais (`contexts/`), hooks customizados (`hooks/`), utilitários (`utils/`) e temas (`constants/`). A navegação é feita por abas, e o estado global (tema, colmeia ativa) é gerenciado por contextos React.

## Funcionalidades e Implementação no Código

### 1. Dashboard (Resumo)

- **Arquivo:** `app/(app)/home.tsx`
- **Fluxo:** Ao abrir, busca dados de tarefas, rotinas, compras e finanças do Firestore usando hooks customizados e listeners em tempo real (`onSnapshot`).
- **Interfaces:** Utiliza interfaces como `Tarefa`, `Rotina`, `Despesa` para tipar os dados.
- **Alterações:** O mural e feed de atividades são atualizados automaticamente via listeners. Alterações em tarefas/rotinas refletem imediatamente no dashboard.

### 2. Tarefas (Lista de Tarefas)

- **Arquivo:** `app/(app)/listas.tsx`
- **Fluxo:** Cada tarefa é um documento na subcoleção `tarefas` do grupo ativo no Firestore. O usuário pode criar, marcar como concluída ou excluir tarefas.
- **Interfaces:**
  ```ts
  interface Tarefa {
    id: string;
    titulo: string;
    concluida: boolean;
    criadaPor: string;
    data: any;
  }
  ```
- **Alterações:** As funções de adicionar, editar e remover tarefas usam `addDoc`, `updateDoc` e `deleteDoc` do Firebase. O estado local é sincronizado em tempo real.

### 3. Rotinas (Tarefas Recorrentes)

- **Arquivo:** `app/(app)/rotinas.tsx`
- **Fluxo:** Rotinas são documentos com frequência (`diária`, `semanal`, `mensal`.) e datas agendadas. O calendário é renderizado com `react-native-calendars`, destacando dias com rotinas.
- **Interfaces:**
  ```ts
  interface Rotina {
    id: string;
    titulo: string;
    frequencia: "diaria" | "semanal" | "mensal";
    agendamentos: string[]; // Agora suporta horários flexíveis
    criadaPor: string;
  }
  ```
- **Alterações:** Alterações em rotinas (criar, editar, excluir) são feitas via Firestore e refletem no calendário em tempo real.

### 4. Compras (Lista Compartilhada)

- **Arquivo:** `app/(app)/compras.tsx`
- **Fluxo:** Cada item de compra é um documento na subcoleção `compras`. O subtotal é calculado automaticamente somando os valores dos itens.
- **Interfaces:**
  ```ts
  interface ItemCompra {
    id: string;
    nome: string;
    categoria: string;
    unidade: string;
    quantidade: number;
    preco: number;
    comprado: boolean;
  }
  ```
- **Alterações:** Permite adicionar, editar, marcar como comprado e excluir itens. Ações em lote são suportadas. Adicionada uma área de "total" que calcula automaticamente a soma dos preços dos itens na lista.

### 5. Finanças (Despesas do Grupo)

- **Arquivo:** `app/(app)/financas.tsx`
- **Fluxo:**
  - Cada despesa é um documento na subcoleção `financas` do grupo ativo.
  - O componente usa o hook `useEffect` para escutar alterações em tempo real com `onSnapshot`.
  - Estatísticas (total, por pessoa, por categoria) são calculadas localmente a partir do array de despesas.
- **Interfaces:**
  ```ts
  type CategoriaFinanceira =
    | "alimentacao"
    | "moradia"
    | "transporte"
    | "lazer"
    | "saude"
    | "outros";
  interface Despesa {
    id: string;
    descricao: string;
    valor: number;
    categoria: CategoriaFinanceira;
    pagoPor: string;
    pagoPorNome: string;
    data: any;
    createdAt?: any;
  }
  ```
- **Alterações:**
  - Adicionar/editar despesas: Usa `addDoc` e `updateDoc`.
  - Excluir: `deleteDoc` (individual ou em lote).
  - Estatísticas: Calculadas por funções locais, exibidas em modal.
  - Todas as operações são refletidas em tempo real na interface.

### 6. Colmeias (Gestão de Grupos)

- **Arquivo:** `app/(app)/colmeias.tsx`
- **Fluxo:**
  - Cada grupo (colmeia) é um documento na coleção `colmeias`.
  - O usuário pode criar, entrar (via código) e alternar entre colmeias.
  - O contexto global armazena o grupo ativo, filtrando todos os dados exibidos.
- **Interfaces:**
  ```ts
  interface Colmeia {
    id: string;
    nome: string;
    codigoConvite: string;
    membros: string[];
  }
  ```
- **Alterações:**
  - Criar/entrar: Usa `addDoc` e busca por código.
  - Troca de grupo: Atualiza o contexto global, recarregando dados das telas.

### 7. Temas e Visual

- **Arquivos:** `constants/theme.ts`, `contexts/ColmeiaContext.tsx`
- **Fluxo:**
  - O tema (primavera, verão, outono, inverno, dia/noite) é armazenado no contexto global.
  - Hooks customizados (`useAppTheme`) fornecem as cores para os componentes.
- **Interfaces:**
  ```ts
  interface Theme {
    primary: string;
    background: string;
    cardColor: string;
    text: string;
    // ...outras cores
  }
  ```
- **Alterações:**
  - Troca de tema: Atualiza o contexto, propagando as cores para toda a interface.

### 8. Autenticação

- **Arquivos:** `app/(auth)/login.tsx`, `app/(auth)/signup.tsx`
- **Fluxo:**
  - Usa Firebase Auth para login/cadastro.
  - O contexto global armazena o usuário autenticado.
  - Redireciona automaticamente para as telas corretas conforme o estado de autenticação.
- **Interfaces:**
  ```ts
  interface Usuario {
    uid: string;
    email: string;
    nome?: string;
  }
  ```
- **Alterações:**
  - Login/cadastro: Usa métodos do Firebase Auth.
  - Logout: Limpa o contexto e redireciona para login.

### 9. Atualizações Recentes

#### Rotinas (Tarefas Recorrentes)

- **Alteração:** Agora permite entrada flexível para horários agendados, facilitando a personalização das rotinas.
- **Impacto:** Usuários podem definir horários com maior precisão, melhorando a organização.

#### Compras (Lista Compartilhada)

- **Alteração:** Adicionada uma área de "total" que calcula automaticamente a soma dos preços dos itens na lista.
- **Impacto:** Facilita o controle financeiro ao exibir o custo total das compras em tempo real.

### Interfaces Atualizadas

#### Rotina

```ts
interface Rotina {
  id: string;
  titulo: string;
  frequencia: "diaria" | "semanal" | "mensal";
  agendamentos: string[]; // Agora suporta horários flexíveis
  criadaPor: string;
}
```

#### ItemCompra

```ts
interface ItemCompra {
  id: string;
  nome: string;
  categoria: string;
  unidade: string;
  quantidade: number;
  preco: number;
  comprado: boolean;
}
```

## Como as Alterações São Feitas

- **Firestore:** Todas as alterações (criar, editar, excluir) são feitas via funções do Firebase (`addDoc`, `updateDoc`, `deleteDoc`).
- **Atualização em tempo real:** Listeners (`onSnapshot`) garantem que qualquer alteração feita por qualquer usuário seja refletida instantaneamente para todos.
- **Contextos:** Mudanças de grupo ou tema são feitas via contextos React, propagando o novo estado para todos os componentes.
- **Interfaces TypeScript:** Todas as entidades principais (Tarefa, Rotina, Despesa, Colmeia, Usuario, Theme) são tipadas para garantir segurança e clareza no código.

## Dicas para Apresentação e Leitura

- Use os nomes dos arquivos e palavras-chave para localizar rapidamente funcionalidades no código.
- Mostre como cada tela é modularizada e como os dados são buscados/atualizados em tempo real.
- Explique a importância dos contextos para tema e colmeia.
- Demonstre a troca de tema e grupo ao vivo.
- Consulte as interfaces TypeScript para entender a estrutura dos dados.

---
