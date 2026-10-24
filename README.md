# nutri.ia

Diário de alimentação com IA (OpenAI): foto do prato (câmera ou galeria), texto, voz, código de barras e busca na tabela TACO. Metas de calorias, macros e água calculadas pelo perfil (com data-alvo para o peso desejado), gráficos de peso e nutrição, jejum intermitente com timer e histórico, receitas recomendadas pela IA, missões, coach por chat e planos de dieta/treino.

- `api/` — NestJS + Prisma + Postgres
- `web/` — React + Vite + Tailwind (site mobile-first, dá pra "Adicionar à Tela de Início" no iPhone)

## Subir na VPS

Precisa de Docker com Compose.

```sh
git clone <repo> nutri && cd nutri   # ou copie a pasta
cp .env.example .env                 # preencha os valores
docker compose up -d --build
```

O site fica em `http://IP-DA-VPS:WEB_PORT`. A tabela TACO é carregada automaticamente na primeira subida.

### HTTPS (recomendado)

Câmera ao vivo para código de barras, reconhecimento de voz e cookie seguro só funcionam em HTTPS. Opções:

- **Sem proxy na VPS:** aponte um domínio para a VPS, preencha `DOMAIN` e `COMPOSE_PROFILES=https` no `.env` e rode `docker compose up -d --build`. O Caddy emite o certificado sozinho.
- **Já tem Caddy/Nginx/Traefik:** use `WEB_PORT=127.0.0.1:8080` e faça proxy do seu domínio para `localhost:8080`.

Deploy a partir da sua máquina: `scripts/deploy.sh root@IP` (envia o código com rsync e sobe os containers; o `.env` fica só no servidor).

Sem HTTPS, use `COOKIE_SECURE=false` (foto, texto e busca continuam funcionando).

### Cadastro

Só cria conta quem souber o `INVITE_CODE`. Depois do cadastro, o app pede sexo, idade, altura, peso e objetivo e calcula as metas (Mifflin-St Jeor; água = 35 ml/kg).

### Chave da OpenAI

Crie em [platform.openai.com](https://platform.openai.com) → API keys, adicione crédito e coloque em `OPENAI_API_KEY`. O modelo fica em `OPENAI_MODEL` (padrão sugerido: `gpt-5.6-luna`, ~US$0,001 por foto analisada). Defina um limite de gasto mensal no painel da OpenAI.

### Backup

```sh
./scripts/backup.sh   # banco + fotos em backups/, apaga os com mais de 30 dias
```

Agende no cron, ex.: `0 3 * * * /caminho/nutri/scripts/backup.sh`.

### Atualizar

```sh
docker compose up -d --build
```

Migrações do banco rodam sozinhas ao subir a API.

## Desenvolvimento local

```sh
docker run -d --name nutri-db-dev -e POSTGRES_USER=nutri -e POSTGRES_PASSWORD=nutri -e POSTGRES_DB=nutri -p 5544:5432 postgres:17-alpine
cd api && npm i && cp ../.env.example .env   # ajuste DATABASE_URL, UPLOAD_DIR=./uploads, PORT=3300
npx prisma migrate dev && node prisma/seed.js && npm run start:dev
cd ../web && npm i && npm run dev            # proxy /api -> localhost:3300
```

## Passos do iPhone

Em Perfil → ⚙️ → "Importar passos do iPhone" tem o passo a passo de uma automação do app Atalhos que envia os passos do app Saúde para `POST /api/integrations/steps` (header `x-steps-token`).

Dados nutricionais: TACO 4ª ed. (NEPA/UNICAMP) e Open Food Facts.
