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

Abra o endereço mostrado pelo Vite e procure um usuário do GitHub. O comando inicia o frontend e a API Node juntos.

### Token do GitHub (recomendado)

Copie `.env.example` para `.env` e preencha `GITHUB_TOKEN` com um fine-grained token sem permissões extras. Ele fica apenas na sua máquina e aumenta o limite da API. Sem token, o projeto ainda funciona dentro do limite público do GitHub.

### Login com GitHub

1. Em `https://github.com/settings/developers`, crie uma **OAuth App**.
2. Use `GitHub Ocean Local` como nome e `http://localhost:3001/api/auth/callback` como **Authorization callback URL**.
3. Copie o Client ID e gere um Client Secret.
4. No `.env`, preencha `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET`.

Ao clicar em **Entrar com GitHub**, o backend realiza o OAuth e o navegador volta diretamente para o porto do usuário. O secret fica só no backend e o token não é exposto ao frontend.

As oito ilhas mais relevantes recebem uma contagem de commits via API. Ela é cacheada por 15 minutos no servidor para reduzir chamadas. O tamanho visual da ilha combina commits, stars e forks, sempre com limite máximo para preservar o mapa.

### Mundo persistente local

Cada perfil pesquisado entra no registro local `data/world.json` e passa a aparecer como um barco clicável nas próximas explorações. Esse arquivo não entra no Git; ao hospedar a API, a mesma estrutura pode usar um banco compartilhado para formar o oceano público.

### Ilha-porto do desenvolvedor

Cada desenvolvedor agora possui somente uma ilha-porto. Ela aumenta conforme commits, repositórios e stars; os repositórios alimentam o progresso do território em vez de criarem ilhas aleatórias. O visual evolui de acampamento para vila, loja e forte — a base para futuras personalizações e exploração marítima.

| Nível | Evolução | Critério visual |
| --- | --- | --- |
| 1 | Acampamento | Ilha pequena e primeiro repositório como construção |
| 2 | Assentamento | Segunda construção vinculada ao segundo repositório |
| 3 | Vila comercial | Terceiro repositório ganha uma loja/oficina |
| 4 | Porto fortificado | Quarto repositório vira a torre/forte da ilha |

O nível e o tamanho usam uma pontuação limitada de commits, stars e quantidade de repositórios. Cada construção pode ser clicada para abrir o repositório que a representa. As posições dos portos são reservadas pelo backend em uma malha de 22 unidades, evitando colisões entre ilhas.

## Próxima evolução planejada

1. API Node + cache para não depender do limite público do GitHub.
2. Login OAuth do GitHub.
3. Repositórios como ilhas e outros desenvolvedores visíveis no mapa.
4. Rotas de pull requests e mundo por chunks.
