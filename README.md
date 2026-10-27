# 🎬 tImago — Broadcast Overlay Controller for OBS Studio

**tImago** é um sistema desktop e web de controle de overlays em tempo real para o **OBS Studio** (*Browser Source*), desenvolvido com **Node.js, Express, Socket.IO e Electron**.

Ideal para transmissões ao vivo, cantatas de Natal, cultos, eventos institucionais, transmissões esportivas e podcasts.

---

## ✨ Principais Recursos

- **💬 Fila Prioritária do Público / Ouvintes (com modo Acumular)**:
  - Cadastre mensagens de ouvintes/chat ao vivo com nome do autor e etiqueta personalizada (*Pedido de Oração*, *Recado de Natal*, *Pergunta ao Vivo*, *Aniversariante*, *Testemunho* ou sem etiqueta).
  - Edite, reordene (`↑` / `↓`) ou acumule quantas mensagens quiser (ex: 7 mensagens) sem interromper a transmissão e clique em **Iniciar Exibição da Fila** quando desejar soltar a bateria.
  - Pausa automaticamente o carrossel do sistema, exibe cada mensagem do público **uma única vez (não repete)** e retoma o carrossel ao finalizar.
- **📂 Múltiplas Playlists por Evento & Backup JSON**:
  - Crie, renomeie e alterne entre listas independentes de frases para diferentes ocasiões (*🎄 Cantata de Natal*, *🕊️ Culto de Celebração*, *✨ Especial de Páscoa*, etc.).
  - Exporte e importe backups completos (`.json`) em 1 clique.
- **📱 Controle Remoto pelo Celular (QR Code Offline) & Modo Recepção**:
  - Gere um QR Code instantâneo na rede Wi-Fi local (100% offline) para controlar o tImago pelo celular ou tablet.
  - **Modo Recepção Simplificado (`?mode=recepcao`)**: tela limpa focada na Fila do Público para voluntários cadastrarem mensagens da live com segurança.
- **🎙️ Tarja de Identificação Rápida (Lower Third) & Modo Ticker de Rodapé**:
  - Dispare tarjas de identificação para músicas, cantores, preletores e convidados sem interromper o carrossel.
  - Alterne entre **Card Flutuante Individual** ou **Faixa Ticker Deslizante de Rodapé (Letreiro Contínuo)**.
- **🎨 Galeria com 19 Temas (18 Temas Prontos + 1 Tema Customizável), Logo & 5 Animações**:
  - **Natal (3)**: *Cantata Real*, *Noite Feliz (Gelo/Prata)* e *Bosque Real (Pinheiro/Ouro)*.
  - **Institucional & Clean (3)**: *Clean Dark Pro*, *Clean Alabaster (Claro)* e *Solene Black & Gold*.
  - **Páscoa (3)**: *Aurora da Vida*, *Cordeiro Real* e *Monte das Oliveiras*.
  - **Dia das Mães (2)**: *Jardim de Rosas* e *Pérola & Afeto*.
  - **Dia dos Pais (2)**: *Executivo Navy* e *Clássico Espresso*.
  - **Futebol & Esportes (2)**: *Arena Gramado* e *Noite de Copa*.
  - **Extras Especiais (4)**: *Réveillon & Luz*, *Culto Jovem / Podcast (Cyber Neon)*, *Arraial & Fogueira* e **🎨 Meu Tema Custom** (seletores de cores próprios).
  - Envie seu próprio **Logo (PNG/SVG/WebP)** para aparecer no card e escolha entre **5 animações de entrada/saída** (*Slide Vertical*, *Slide Esquerda*, *Slide Direita*, *Zoom*, *Fade*).
- **⌨️ Atalhos de Estúdio & Trava de Segurança Ao Vivo**:
  - Atalhos rápidos (`Alt+A` No Ar, `Alt+N` Próxima, `Alt+C` Recolher, `Alt+I` Iniciar Fila, `Alt+L` Ocultar Tarja).
  - Proteção nativa contra fechamento acidental da janela quando o overlay estiver **NO AR (Visível)**.
- **📐 Controle Total de Dimensões e Resolução**:
  - Sliders em tempo real para **Tamanho da Letra**, **Escala Geral do Card** e **Largura Máxima**.
  - Presets e campos customizados de **Resolução do Palco** (`Full HD 1080p`, `720p`, `2K`, `4K`, `Vertical 9:16` e `Quadrado 1:1`).
  - **Preview em Tempo Real** embutido no painel com simulador de fundo.

---

## 🚀 Como Usar

### Opção 1: Aplicativo Executável Windows (`.exe`)
1. Abra o executável portátil gerado em `dist/tImago-Portable-1.0.6.exe` (ou rode `npm run app`).
2. O **tImago** abrirá em sua própria janela dedicada, sem precisar manter nenhum terminal aberto.
3. Quando você fechar a janela do **tImago**, o servidor e o overlay no OBS são encerrados automaticamente.

### Opção 2: Modo Servidor Web (`Node.js`)
```bash
npm install
npm start
```
- **Painel de Controle**: `http://localhost:3000`
- **URL para o OBS Studio**: `http://localhost:3000/overlay`

---

## 🛠️ Como Gerar o Executável (`.exe`)

Para compilar o arquivo `.exe` portátil no Windows:

```bash
npm run build:exe
```

O arquivo final estará disponível na pasta `dist/`.

---

## 🎥 Configuração no OBS Studio

1. Em **Fontes (Sources)** no OBS Studio, clique em **`+`** → **Navegador (Browser)**.
2. Configure:
   - **URL**: `http://localhost:3000/overlay`
   - **Largura (Width)**: `1920` (ou a resolução escolhida no painel)
   - **Altura (Height)**: `1080` (ou a resolução escolhida no painel)
3. Clique em **OK**.

---

## 📄 Licença

Distribuído sob a licença **MIT**. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
