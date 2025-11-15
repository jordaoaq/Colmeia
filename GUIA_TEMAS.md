# Guia de Temas - Colmeia

O Colmeia possui um sistema de temas sazonais (primavera, verão, outono, inverno), cada um com variação dia/noite. O tema afeta todas as cores do app, incluindo cards, textos, botões e o calendário.

## Como funciona o sistema de temas

- Os temas são definidos em `constants/theme.ts`.
- O tema ativo é controlado pelo contexto global em `contexts/ColmeiaContext.tsx`.
- O usuário pode trocar o tema (estação e dia/noite) e toda a interface se adapta automaticamente.
- O calendário e os cards mudam de cor conforme o tema.

## Como alterar ou criar temas

1. Edite o objeto `CustomThemes` em `constants/theme.ts` para mudar cores ou adicionar novos temas.
2. O contexto (`ColmeiaContext.tsx`) expõe funções para trocar o tema em tempo real.
3. Os componentes usam o hook `useAppTheme` para acessar as cores do tema atual.

## Dicas

- Use temas claros para o dia e escuros para a noite.
- Teste a acessibilidade das cores (contraste).
- Para apresentações, troque o tema ao vivo para mostrar a flexibilidade do app.

---

Se quiser exemplos de código para trocar tema ou criar um novo, peça pelo arquivo ou funcionalidade!
