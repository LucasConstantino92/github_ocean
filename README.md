# GitHub Ocean

Um mundo 3D navegável em que perfis públicos do GitHub viram barcos e suas tecnologias definem a identidade visual do navio.

## O que já funciona

- Busca por `username` público usando a API do GitHub.
- Leitura dos repositórios públicos e suas linguagens principais.
- Cálculo determinístico do barco: classe, cor da vela e posição são derivados dos dados do perfil.
- Cena Three.js navegável com câmera orbit, zoom e ilhas iniciais das regiões técnicas.
- Card do explorador com stack, repositórios, stars e followers.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra o endereço mostrado pelo Vite e procure um usuário do GitHub.

## Próxima evolução planejada

1. API Node + cache para não depender do limite público do GitHub.
2. Login OAuth do GitHub.
3. Repositórios como ilhas e outros desenvolvedores visíveis no mapa.
4. Rotas de pull requests e mundo por chunks.
