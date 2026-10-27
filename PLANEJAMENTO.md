# 🎬 Planejamento do Sistema de Controle de Overlay para OBS

Este documento descreve a arquitetura, funcionalidades e o cronograma em fases (checklist) para o desenvolvimento do sistema de gerenciamento de overlays em tempo real para transmissões no OBS Studio.

---

## 🏗️ 1. Visão Geral da Arquitetura

Para garantir que o **OBS Browser Source** e o **Painel de Controle** funcionem perfeitamente sincronizados em tempo real (inclusive permitindo controlar o overlay pelo celular ou outro computador na mesma rede durante a transmissão), utilizaremos uma arquitetura leve e autocontida:

- **Backend & Tempo Real**: **Node.js + Express + Socket.IO**
  - Servidor web local rápido (ex: `http://localhost:3000`).
  - Comunicação bidirecional instantânea via WebSockets (sem atrasos para mostrar/ocultar avisos).
- **Persistência de Dados**: **Arquivo JSON local (`data/state.json`)**
  - Salva automaticamente todas as frases cadastradas, tempos e configurações de tema (não precisa instalar banco de dados externo).
- **Frontend (Duas Interfaces)**:
  - **Painel de Controle (`/admin` ou `/`)**: Interface escura (Dark Mode) otimizada para operadores de transmissão ao vivo, com botões rápidos, cadastro expresso de frases + autor e pré-visualização.
  - **Tela do Overlay (`/overlay`)**: Página com fundo 100% transparente (`rgba(0,0,0,0)`), resolução base 1920x1080, animações suaves de entrada e saída (CSS Keyframes/Transitions) para adicionar como *Browser Source* no OBS.

---

## ✨ 2. Principais Funcionalidades Planejadas

1. **Modos de Exibição**:
   - **Rotação Automática (Playlist/Carrossel)**: Alterna entre as frases ativas respeitando o tempo de exibição de cada uma (e um intervalo configurável entre uma frase e outra).
   - **Disparo Manual ("Ao Vivo Agora")**: Permite fixar ou disparar imediatamente uma frase específica ou um recado recém-adicionado sem esperar a fila.
2. **Controle de Visibilidade Master**:
   - Botão **Mostrar / Ocultar (On Air / Off Air)** com transição suave (fade/slide) para sumir da tela em momentos específicos da cantata.
3. **Gestão Rápida de Frases & Autores**:
   - Formulário rápido no topo do painel: digite a **Frase/Mensagem**, o **Autor/Remetente** (opcional) e o **Tempo de Exibição (segundos)**.
   - Ativar/desativar frases da fila sem precisar excluí-las, editar ou reordenar.
4. **Sistema de Temas Dinâmicos**:
   - 🎄 **Tema Cantata de Natal**: Cores natalinas elegantes (vermelho rubi profundo, verde pinheiro e detalhes em dourado), tipografia clássica combinada com sans-serif legível, ornamentos sutis (estrelas/luzes/neve suave em CSS) e badge especial para o autor.
   - ✨ **Tema Clean & Moderno**: Design minimalista estilo *glassmorphism* (efeito vidro fosco escuro/claro), barra de acento lateral moderna, tipografia geométrica limpa e barra de progresso discreta indicando o tempo restante da frase.
5. **Posicionamento na Tela**:
   - Opção rápida no painel para escolher onde o card aparece no OBS (ex: *Inferior Esquerdo*, *Inferior Centralizado*, *Inferior Direito* ou *Superior*).

---

## ✅ 3. Checklist de Desenvolvimento (Fases)

### Fase 1: Estrutura Base e Servidor Tempo Real
- [x] Inicializar projeto Node.js (`package.json`) e instalar dependências (`express`, `socket.io`).
- [x] Criar estrutura de diretórios (`public/`, `public/css/`, `public/js/`, `data/`).
- [x] Implementar gerenciador de estado persistente em `data/state.json` com frases iniciais de exemplo para a Cantata de Natal.
- [x] Configurar servidor Express + eventos Socket.IO para sincronizar estado (`state:update`, `overlay:toggle`, `phrase:add`, `phrase:trigger`, etc.).

### Fase 2: Motor do Overlay para o OBS (`/overlay`)
- [x] Criar estrutura HTML transparente (`public/overlay.html`) preparada para 1920x1080 no OBS Browser Source.
- [x] Desenvolver a lógica JavaScript (`public/js/overlay.js`) para conexão WebSocket e controle do ciclo de rotação (tempo de tela + tempo de intervalo entre frases).
- [x] Implementar controle de visibilidade imediata (On Air / Off Air) e suporte a disparo prioritário de frase avulsa.
- [x] Implementar troca dinâmica de posição na tela (Inferior Esquerdo, Centralizado, Direito) e barra de progresso opcional.

### Fase 3: Criação dos Temas Visuais e Animações
- [x] Desenvolver folha de estilo base e animações suaves de entrada/saída (`public/css/overlay.css`).
- [x] Criar o **Tema 1: Cantata de Natal** (paleta vermelho/dourado/verde, bordas festivas elegantes, ícone/ornamento natalino e animação suave de brilho).
- [x] Criar o **Tema 2: Clean & Moderno** (visual minimalista, glassmorphism, tipografia moderna e linha de destaque).

### Fase 4: Painel de Controle de Transmissão (`/admin`)
- [x] Criar interface do Painel de Controle (`public/index.html` e `public/css/admin.css`) focada em usabilidade rápida durante lives.
- [x] Construir cabeçalho de **Status Ao Vivo (ON AIR / OFF AIR)** com botão mestre de visibilidade e indicador de qual frase está no ar no momento.
- [x] Criar **Formulário Rápido de Adição** (Frase, Autor opcional, Duração personalizada e botão *"Adicionar e Exibir Agora"* vs *"Adicionar à Fila"*).
- [x] Criar **Lista de Frases Cadastradas** com botões para: Exibir Agora, Ativar/Desativar na rotação, Editar tempo/texto e Excluir.
- [x] Criar painel de **Configurações Globais**: seletor de Tema (Natal / Clean), seletor de Posição na tela, modo de rotação (Automático vs Manual) e intervalo entre frases.
- [x] Adicionar mini pré-visualização (Preview em tempo real) dentro do próprio painel de controle.

### Fase 5: Testes e Guia de Uso no OBS
- [x] Testar sincronização em tempo real entre o Painel e o Overlay.
- [x] Validar persistência dos dados ao reiniciar o servidor.
- [x] Criar documentação rápida (`README.md`) com o passo a passo de como adicionar a URL no *Browser Source* do OBS Studio.
