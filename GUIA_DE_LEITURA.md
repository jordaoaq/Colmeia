# Guia de Leitura do Código - Colmeia

Este guia ajuda a navegar pelo código do Colmeia, encontrar funcionalidades rapidamente e entender como cada parte do app funciona.

## Estrutura de Pastas

- `app/` — Telas principais (cada arquivo = uma tela)
- `components/` — Componentes reutilizáveis (botões, cards, etc)
- `contexts/` — Contextos globais (tema, colmeia)
- `hooks/` — Hooks customizados
- `utils/` — Funções utilitárias (cálculos, logs)
- `constants/` — Temas e constantes

## Como encontrar funcionalidades

Procure pelas palavras-chave abaixo (CTRL+F) para localizar rapidamente o que precisa:

- **DASHBOARD**: `app/(app)/home.tsx` — Cards de resumo, mural, feed de atividades
- **TAREFAS**: `app/(app)/listas.tsx` — Lista de tarefas, marcar como concluída
- **ROTINAS**: `app/(app)/rotinas.tsx` — Rotinas recorrentes, calendário
- **COMPRAS**: `app/(app)/compras.tsx` — Lista de compras, subtotal, categorias
- **FINANÇAS**: `app/(app)/financas.tsx` — Despesas, estatísticas
- **COLMEIAS**: `app/(app)/colmeias.tsx` — Gestão de grupos
- **TEMA**: `constants/theme.ts`, `contexts/ColmeiaContext.tsx` — Temas sazonais, troca de cor
- **AUTENTICAÇÃO**: `app/(auth)/login.tsx`, `app/(auth)/signup.tsx` — Login/cadastro

## Dicas para leitura

- Comece pelo arquivo da funcionalidade que deseja entender.
- Use os comentários didáticos (// DASHBOARD, // ROTINAS, etc.) para se localizar.
- Veja como os contextos (`contexts/ColmeiaContext.tsx`) conectam as telas.
- Explore os hooks customizados para entender como o tema e o grupo são aplicados globalmente.
- Consulte `constants/theme.ts` para ver como as cores e temas são definidos.

---
