# 🎬 tImago — Broadcast Overlay Controller for OBS Studio

**tImago** é um sistema desktop e web de controle de overlays em tempo real para o **OBS Studio** (*Browser Source*), desenvolvido com **Node.js, Express, Socket.IO e Electron**.

Ideal para **Assessorias de Comunicação (ASCOM) de Prefeituras Municipais**, transmissões institucionais, audiências públicas, campanhas de saúde (Outubro Rosa, Novembro Azul, Setembro Amarelo), passeios ciclísticos, eventos esportivos, festividades de Natal e eventos culturais.

---

## ✨ Principais Recursos

- **💬 Fila Prioritária do Público / Cidadãos (com modo Acumular)**:
  - Cadastre mensagens da população/chat ao vivo com nome do morador/bairro e etiqueta personalizada (*Comentário do Cidadão*, *Pergunta da População*, *Bairro / Comunidade*, *Elogio / Sugestão*, *Utilidade Pública*, *Mensagem de Natal*, *Homenagem* ou sem etiqueta).
  - Edite, reordene (`↑` / `↓`) ou acumule quantas mensagens quiser (ex: 7 mensagens) sem interromper a transmissão e clique em **Iniciar Exibição da Fila** quando desejar soltar a bateria.
  - Pausa automaticamente o carrossel do sistema, exibe cada mensagem do público **uma única vez (não repete)** e retoma o carrossel ao finalizar.
- **📂 Múltiplas Playlists por Evento & Backup JSON**:
  - Crie, renomeie e alterne entre listas independentes de frases para diferentes ocasiões (*🏛️ Avisos Institucionais*, *🎄 Natal da Família*, *🎀💙 Saúde — Outubro Rosa / Novembro Azul*, *🚴⚽ Passeio Ciclístico & Esportes*, etc.).
  - Exporte e importe backups completos (`.json`) em 1 clique.
- **📱 Controle Remoto pelo Celular (QR Code Offline) & Modo Recepção**:
  - Gere um QR Code instantâneo na rede Wi-Fi local (100% offline) para controlar o tImago pelo celular ou tablet com layout 100% responsivo.
  - **Modo Recepção Simplificado (`?mode=recepcao`)**: tela limpa focada na Fila do Público para a equipe de comunicação cadastrar mensagens da live com segurança.
- **🏛️ Tarja de Identificação Rápida (Lower Third) & Modo Ticker de Rodapé**:
  - Dispare tarjas oficiais de identificação para Prefeito(a), Secretários Municipais, Palestrantes, Técnicos de Audiência Pública e Atrações Culturais sem interromper o carrossel.
  - Alterne entre **Card Flutuante Individual** ou **Faixa Ticker Deslizante de Rodapé (Letreiro Contínuo)**.
- **🎨 Galeria com 25 Temas (24 Temas Prontos + 1 Tema Customizável), Logo & 5 Animações**:
  - **Institucional & Prefeitura (4)**: *Clean Dark Pro*, *Clean Alabaster (Claro)*, *Solene Black & Gold (Cerimonial)* e *Defesa Civil & Alerta (Utilidade Pública)*.
  - **Campanhas de Saúde (3)**: *Outubro Rosa*, *Novembro Azul* e *Setembro Amarelo & Vacinação*.
  - **Esportes & Ciclismo (4)**: *Passeio Ciclístico (Pedal Municipal)*, *Corrida & Movimento*, *Arena Gramado* e *Noite de Copa*.
  - **Natal (3)**: *Natal Luz Municipal*, *Noite Feliz (Gelo/Prata)* e *Bosque Real (Pinheiro/Ouro)*.
  - **Páscoa (3)**: *Aurora de Páscoa*, *Páscoa Imperial* e *Outono & Paz*.
  - **Dia das Mães (2)**: *Jardim de Rosas* e *Pérola & Afeto*.
  - **Dia dos Pais (2)**: *Executivo Navy* e *Clássico Espresso*.
  - **Extras & Festividades (4)**: *Réveillon na Praça*, *Festival & Podcast (Cyber Neon)*, *Arraial Municipal* e **🎨 Meu Tema Custom** (seletores de cores próprios).
  - Envie o **Brasão/Logo da Prefeitura (PNG/SVG/WebP)** para aparecer no card e escolha entre **5 animações de entrada/saída** (*Slide Vertical*, *Slide Esquerda*, *Slide Direita*, *Zoom*, *Fade*).
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
1. Abra o executável portátil gerado em `dist/tImago-Portable-1.0.8.exe` (ou rode `npm run app`).
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
