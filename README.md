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
npm run db:up
npm run db:migrate -- --name initial_world
npm run db:generate
npm run dev
```

Abra o endereço mostrado pelo Vite e procure um usuário do GitHub. O comando inicia o frontend, a API Node e o indexador contínuo juntos.

### Banco e mundo por regiões

O mundo agora usa PostgreSQL, iniciado localmente com Docker Compose. O backend reserva uma posição única de porto para cada desenvolvedor, mantém os repositórios e fornece `GET /api/world/chunks/:x/:z` para o frontend carregar apenas a região necessária.

O indexador contínuo percorre a listagem pública do GitHub e mantém seu cursor em `data/public-indexer.json`. Ele começa sozinho com `npm run dev`, portanto não há mais lote manual de 100 em 100. Com `GITHUB_TOKEN`, ele adiciona aproximadamente um perfil a cada 9 segundos; sem token, reduz muito a velocidade para respeitar o limite público.

Para rodá-lo sem abrir o frontend:

```bash
npm run world:index
```

### Token do GitHub (recomendado)

Copie `.env.example` para `.env` e preencha `GITHUB_TOKEN` com um fine-grained token sem permissões extras. Ele fica apenas na sua máquina e aumenta o limite da API. Sem token, o projeto ainda funciona dentro do limite público do GitHub.

### Login com GitHub

1. Em `https://github.com/settings/developers`, crie uma **OAuth App**.
2. Use `GitHub Ocean Local` como nome e `http://localhost:3001/api/auth/callback` como **Authorization callback URL**.
3. Copie o Client ID e gere um Client Secret.
4. No `.env`, preencha `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET`.

Ao clicar em **Entrar com GitHub**, o backend realiza o OAuth e o navegador volta diretamente para o porto do usuário. O secret fica só no backend e o token não é exposto ao frontend.

As oito ilhas mais relevantes recebem uma contagem de commits via API. Ela é cacheada por 15 minutos no servidor para reduzir chamadas. O tamanho visual da ilha combina commits, stars e forks, sempre com limite máximo para preservar o mapa.

### Mundo persistente e posições fixas

Cada perfil pesquisado entra no PostgreSQL e recebe uma posição única e estável, derivada do login do GitHub. A separação entre células é propositalmente maior que o tamanho máximo da ilha: upgrades visuais nunca invadem o território vizinho.

Se você já tinha criado portos na versão anterior, execute uma vez para redistribuí-los em um arquipélago compacto sem apagar nada:

```bash
npm run world:relayout
```

### Ilha-porto do desenvolvedor

Cada desenvolvedor agora possui somente uma ilha-porto. Ela aumenta conforme commits, repositórios e stars; os repositórios alimentam o progresso do território em vez de criarem ilhas aleatórias. O visual evolui de acampamento para vila, loja e forte — a base para futuras personalizações e exploração marítima.

| Nível | Evolução | Critério visual |
| --- | --- | --- |
| 1 | Acampamento | Ilha pequena e primeiro repositório como construção |
| 2 | Assentamento | Segunda construção vinculada ao segundo repositório |
| 3 | Vila comercial | Terceiro repositório ganha uma loja/oficina |
| 4 | Porto fortificado | Quarto repositório vira a torre/forte da ilha |

O nível e o tamanho usam uma pontuação limitada de commits, stars e quantidade de repositórios. Cada construção pode ser clicada para abrir o repositório que a representa. A costa tem tamanho máximo; depois dele, os ganhos evoluem assentamento, mercado e forte, sem expandir lateralmente.

## Próxima evolução planejada

1. Executar o coletor em lotes para indexar progressivamente os perfis públicos do GitHub.
2. Carregar por chunks conforme o barco navega, em vez de renderizar o mundo inteiro no navegador.
3. Rotas de pull requests, organizações e contribuições para enriquecer a evolução.
