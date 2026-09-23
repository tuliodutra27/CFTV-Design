# Planejamento — Plataforma Web de Projeto de CFTV

**Data:** 2026-09-23
**Contexto:** Transcrição da conversa com o Claude Code sobre o planejamento de uma plataforma web customizada para o projeto de CFTV da ALISEO SA.

---

## 1. Pedido inicial

Temos aproximadamente **350 câmeras instaladas** em uma área de **200 mil m²**. Precisamos fazer um projeto desse CFTV com:

- Posição de cada câmera
- Ângulo de abertura das lentes
- Campo de visão (FOV) de cada câmera
- Outras funcionalidades a definir

Já foram avaliadas algumas plataformas existentes, mas a decisão é **construir uma plataforma customizada**. Pedido:

1. Ajudar a planejar a criação dessa plataforma web.
2. Verificar no GitHub se existem projetos abertos de CFTV que possam servir de base para o desenvolvimento.

---

## 2. Perguntas de alinhamento e respostas

Antes de pesquisar e propor a arquitetura, foram levantadas 4 perguntas-chave:

| Pergunta | Resposta |
|---|---|
| Base cartográfica disponível (planta/mapa) | Existe planta em **CAD, DWG e PDF**, porém **desatualizada**. O mais atual é **imagem de satélite (Apple Maps)** e **imagens aéreas de drone** — as imagens de drone são as mais atuais e confiáveis. |
| Stack de tecnologia preferida | **Node.js / TypeScript (Next.js + Postgres)** |
| Escopo de integração com vídeo ao vivo (NVR/VMS) | **Ainda não decidido** — arquitetura deve permitir essa integração no futuro, mas o projeto começa sem vídeo ao vivo. |
| Escala (site único vs. múltiplos sites) | **Só este site por agora** (200 mil m²). |

---

## 3. Pesquisa no GitHub — projetos existentes

**Conclusão geral:** não existe um projeto open source completo e pronto para "dar fork e customizar" nesse nicho específico (posicionar câmera + ângulo de lente + cone de FOV sobre uma planta). As ferramentas mais completas do mercado (**CCTVplanner.io**, **CCTV Design Tool**, **JVSG**) são todas SaaS/comerciais de código fechado — servem apenas como referência de funcionalidades (zonas DORI, densidade de pixel, banco de modelos de lente, exportação em PDF), não de código reaproveitável.

Foram encontradas, no entanto, peças open source reaproveitáveis para construir a solução do zero:

| Projeto | Licença | Uso proposto |
|---|---|---|
| [visibility-polygon-js](https://github.com/byronknoll/visibility-polygon-js) (Byron Knoll) | Domínio público | Calcula o polígono de visibilidade real a partir de segmentos de linha (paredes/obstáculos) — algoritmo para "recortar" o cone da câmera quando encontra uma parede/pilar, em vez de um cone que atravessa tudo |
| [Ringmast4r/FLOCK](https://github.com/ringmast4r/FLOCK) | MIT | Referência de como plotar milhares de câmeras num mapa Leaflet com clustering e popup performático (útil para as 350 câmeras não pesarem o mapa) |
| [leaflet.sector](https://github.com/jjwtay/leaflet.sector) / [Leaflet.Circle-sector](https://github.com/kluizeberg/Leaflet.Circle-sector) | MIT-like | Desenham o "leque" (setor circular) do FOV sobre um mapa Leaflet, caso se opte pela via georreferenciada |
| Konva.js / react-konva | MIT | Base técnica típica dos editores CCTV comerciais: canvas 2D com drag&drop, rotação, zoom |
| turf.js | MIT | Geometria auxiliar (área, interseção de polígonos, buffers) para calcular % de área coberta / pontos cegos |

Outros projetos avaliados e descartados como base:
- **multicam-planner** (larszu) — usa Konva.js + three.js, mas é **proprietário** (não open source).
- **FoVMax** — foca em otimização de arranjo de câmeras, não em UI/planta.
- **Shinobi, HydraVMS, OpenCCTV, rapidvms, SentinelVision** — VMS/NVR open source completos, relevantes apenas se decidirmos futuramente integrar vídeo ao vivo, não como base do editor de planta.

---

## 4. Decisão de arquitetura de mapa base

Duas opções foram apresentadas:

- **Opção A — Canvas em espaço de pixel (recomendada para v1):** a imagem do drone entra como imagem de fundo; a escala é calibrada clicando em 2 pontos com distância real conhecida (ex: dois postes a 50 m de distância); todas as posições e cones são calculados em metros a partir dessa calibração. Simples, não exige ortomosaico georreferenciado.
- **Opção B — GIS completo** (Leaflet/MapLibre + imagem georreferenciada + PostGIS): mais robusto e evolui melhor para múltiplos sites, porém exige georreferenciar a imagem de drone (ortomosaico com coordenadas reais, via QGIS/WebODM) antes de começar.

**Recomendação:** seguir com a **Opção A**, mantendo o `visibility-polygon-js` e o modelo de dados desenhados de forma que migrar para a Opção B depois seja apenas uma troca da camada de mapa, não uma reescrita.

---

## 5. Arquitetura proposta

**Stack:**
- Next.js (App Router) + TypeScript
- react-konva para o editor 2D interativo
- Prisma + PostgreSQL
- `visibility-polygon-js` para cálculo de obstrução de linha de visada
- NextAuth (se necessário login)
- Deploy em Docker (alinhado à migração de infraestrutura já em andamento — [[project_consolidacao_servidores]])

**Modelo de dados (essencial):**
- **Camera**: código, modelo/fabricante, posição (x, y em metros), altura de instalação, azimute, abertura horizontal da lente (FOV), alcance máximo, status, referência de canal no NVR (campo opcional, para integração futura), foto/observações.
- **Obstacle** (paredes, pilares, muros): segmentos de linha usados pelo cálculo de visibilidade.
- **CoverageZone**: polígono de FOV já recortado pelos obstáculos (cache, recalculado quando a câmera ou o obstáculo muda).

O campo de integração com NVR fica **opcional desde o início** (apenas um `stream_url`/`channel_ref` na tabela `Camera`), já que a decisão de integrar vídeo ao vivo ainda está em aberto — assim, se for decidido integrar depois, não é necessário redesenhar o modelo de dados.

**Oportunidade identificada:** as 350 câmeras podem já estar cadastradas como ativos no GLPI. Se confirmado, isso permitiria importar modelo/local/patrimônio de lá em vez de recadastrar tudo manualmente (aproveitando o acesso de leitura já existente — [[reference_glpi_db_access]]). **Verificação ainda pendente.**

---

## 6. Fases sugeridas

1. **Fase 0 — Preparo de dados:** escolher/recortar a imagem de drone final como fundo; levantar lista mestra das 350 câmeras (specs mínimas: modelo, lente, altura); calibrar escala metro/pixel.
2. **Fase 1 — MVP:** canvas com imagem de fundo, CRUD de câmeras, posicionamento drag&drop, azimute + abertura de lente + alcance, cone de FOV simples (sem obstrução), tabela/lista com specs, import inicial via CSV (ou GLPI).
3. **Fase 2 — Análise de cobertura:** desenhar obstáculos relevantes, aplicar `visibility-polygon-js` para recortar os cones nas paredes, calcular % de área coberta, destacar pontos cegos, heatmap de sobreposição.
4. **Fase 3 — Refinamento:** exportação de relatório (planta + lista de câmeras em PDF), filtros por zona/status, camadas.
5. **Fase 4 (opcional, decisão futura):** integração com NVR/VMS para status online/offline e vídeo ao vivo direto do mapa.

---

## 7. Próximos passos (em aberto no momento da transcrição)

- [ ] Confirmar se as 350 câmeras já estão cadastradas no GLPI como ativos (verificação pendente via acesso de leitura já existente).
- [ ] Decidir se o esqueleto do projeto Next.js + Prisma deve ser criado com base no modelo de dados proposto.
- [ ] Decidir, mais adiante, sobre a integração com NVR/VMS para vídeo ao vivo.
