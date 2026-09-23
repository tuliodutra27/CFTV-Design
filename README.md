# CFTV Design

Plataforma web customizada para o projeto de CFTV da ALISEO SA: posicionamento de
~350 câmeras sobre uma imagem de drone (200 mil m²), com azimute, abertura de lente
(FOV) e alcance de cada câmera.

O racional completo (pesquisa de projetos open source, decisões de arquitetura, fases)
está em [`docs/Planejamento-Plataforma-CFTV.md`](docs/Planejamento-Plataforma-CFTV.md).

## Stack

- Next.js 14 (App Router) + TypeScript
- react-konva (canvas 2D) para o editor de câmeras
- Prisma + PostgreSQL
- `visibility-polygon` (npm) para recorte do cone de FOV por obstáculos — Fase 2
- Docker / Docker Compose para desenvolvimento (sem precisar instalar Node localmente)

## Rodando com Docker

Pré-requisito: [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e rodando.

```bash
cp .env.example .env
docker compose up --build
```

Isso sobe dois serviços:

- `db` — Postgres 16, dados persistidos no volume `cftv_db_data`
- `app` — Next.js em modo dev (hot-reload via bind mount), em http://localhost:3000

Na primeira vez, crie as tabelas no banco (com os containers já rodando):

```bash
docker compose exec app npx prisma migrate dev --name init
```

Para abrir o Prisma Studio (interface para ver/editar dados do banco):

```bash
docker compose exec app npx prisma studio
```

(Prisma Studio sobe na porta 5555 dentro do container — se quiser acessar do host, adicione
`"5555:5555"` em `ports` do serviço `app` no `docker-compose.yml`.)

## O que já está implementado (Fase 1 — MVP, em andamento)

- [x] Modelo de dados (`prisma/schema.prisma`): `Camera`, `Obstacle`, `CoverageZone`, `BackgroundMap`
- [x] CRUD de câmeras via API (`/api/cameras`)
- [x] Canvas com câmeras, drag&drop para reposicionar, cone de FOV (setor circular simples, ainda sem recorte por obstáculo)
- [x] Painel lateral com specs editáveis (azimute, abertura, alcance, status)
- [ ] Imagem de fundo (drone) real + calibração metro/pixel — hoje o canvas usa fundo liso; falta a UI de calibração usando o modelo `BackgroundMap`
- [ ] Import inicial via CSV ou GLPI (ver seção 5 do planejamento — oportunidade de reaproveitar cadastro de ativos)
- [ ] Fase 2: obstáculos + `visibility-polygon` para recortar o cone de FOV, % de área coberta, pontos cegos
- [ ] Fase 3: exportação de relatório em PDF, filtros por zona/status
- [ ] Fase 4 (decisão futura): integração com NVR/VMS

## Estrutura

```
src/
  app/
    page.tsx              # página principal (canvas + painel lateral)
    api/cameras/           # CRUD de câmeras
  components/map/
    CctvCanvas.tsx          # Stage/Layer do react-konva
  lib/
    prisma.ts               # PrismaClient singleton
    geometry.ts              # cálculo do setor de FOV
  types/
    camera.ts                # schema zod + tipos compartilhados
prisma/
  schema.prisma
docs/
  Planejamento-Plataforma-CFTV.md
```

## Notas importantes

- Este scaffold foi escrito sem rodar `npm install` localmente (Node.js não está instalado
  nesta máquina) — a primeira `docker compose up --build` é o teste real de que as
  dependências resolvem sem conflito. Se o build falhar por causa de alguma versão,
  ajuste em `package.json` e rode `docker compose build app` novamente.
- `react-konva` (última versão estável) exige React `~18.2` como peer dependency —
  por isso o projeto está fixado em Next.js 14 + React 18 em vez da última versão do
  Next.js (que já default para React 19).
