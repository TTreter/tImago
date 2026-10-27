# 🎨 Plano e Checklist de Refinamento Visual (UI/UX) — tImago

A partir da análise da captura de tela atual do **tImago**, o sistema já está 100% funcional, mas existem vários pontos de **ergonomia visual, alinhamento, proporção e acabamento** que deixarão o painel com aparência de software profissional de estúdio/broadcast (como vMix, StreamDeck ou OBS Studio moderno) e os temas do overlay ainda mais bonitos na transmissão.

---

## 🔍 Diagnóstico Visual (O que identificamos na tela atual)

1. **Desalinhamento e Quebras de Linha nos Cabeçalhos**:
   - No card **"Carrossel do Sistema"**, as pílulas `4 de 4 na rotação` e `+ Nova Frase Fixa` estão quebrando o texto em duas linhas e ficando altas e estreitas.
   - No card **"Fila do Público"**, o badge amarelo é muito longo (`⚡ Prioridade Máxima • Pausa o Carrossel • Não Repete`), competindo com o título principal.
2. **Coluna Lateral Direita Muito Longa (Scroll Excessivo)**:
   - A barra lateral direita empilha **Preview + Tema + Posição + Resolução + Sliders de Tamanho + Intervalos**, ficando muito mais comprida que a coluna principal e escondendo os controles de tamanho lá embaixo (além de colidir com o Popup Flutuante no canto inferior direito quando o usuário rola a página).
3. **Ícones Genéricos (Emojis do Sistema)**:
   - O uso de emojis padrão do Windows (`✏️`, `🗑️`, `📋`, `🎬`, `💬`, `🔄`) deixa os botões pequenos com tamanhos irregulares e aparência amadora. Substituir por **ícones vetoriais SVG limpos (estilo Lucide/Feather)** trará precisão cirúrgica ao painel.
4. **Seletor de Posição na Tela**:
   - Atualmente são 6 botões de texto (`↖ Sup. Esq.`, etc.). Transformar isso em um **Mini-Mapa Visual 16:9 interativo** com 6 pontos clicáveis nos cantos da tela é muito mais intuitivo e ocupa menos espaço.
5. **Acabamento do Preview 16:9**:
   - O quadriculado atual é muito escuro/grande. Podemos adicionar uma **moldura de monitor broadcast** com opção de alternar o fundo do preview (Quadriculado Transparente, Fundo Escuro de Palco ou Imagem Simulada da Cantata) para testar melhor o contraste das letras antes de ir pro ar.
6. **Refinamento do Overlay (Natal & Clean)**:
   - No preview, nota-se que quando a frase é longa (como Isaías 9:6), o texto ocupa muitas linhas e a estrela do topo fica muito próxima da primeira linha. Melhorar o `padding` interno, o equilíbrio entre texto e badge de autor e adicionar um efeito sutil de partículas douradas/luzes natalinas deixará o card deslumbrante na transmissão.

---

## ✅ Checklist de Refinamento Visual (Organizado por Fases)

### Fase 1: Ícones SVG Vetoriais & Tipografia Limpa
- [x] Substituir todos os emojis dos botões de ação (`✏️`, `🗑️`, `↑`, `↓`, `📋`, `↗`, `▶`, `⏭`, `⏹`) por **ícones SVG monocromáticos/duotone** nítidos e perfeitamente alinhados.
- [x] Padronizar alturas (`height: 36px` / `32px`) e `white-space: nowrap` em todos os botões e badges (`4 de 4 ativas`, `+ Nova Frase`) para nunca quebrarem texto em duas linhas.
- [x] Enxugar os textos das pílulas de status para ficarem diretos e elegantes (ex: `⚡ Prioridade • Não Repete`).

### Fase 2: Reorganização Inteligente da Coluna Direita (Zero Scroll Desnecessário)
- [x] Transformar a caixa de configurações da coluna direita em **Abas Rápidas (Tabs)** logo abaixo do Preview:
  - **Aba 1: 🎨 Estilo & Tema** (Seletor de Tema Natal/Clean + Sliders de Tamanho da Letra, Escala e Largura).
  - **Aba 2: 📐 Tela & Posição** (Mapa Visual de Posição + Presets/Inputs de Resolução do OBS).
  - **Aba 3: ⏱️ Automação** (Switches de Carrossel Automático, Barra de Tempo, Intervalo e Duração Padrão).
- [x] Fixar a coluna da direita (`position: sticky`) para que o **Preview em Tempo Real** continue sempre visível no topo enquanto você rola a lista de frases.

### Fase 3: Mini-Mapa Visual de Posição & Preview Aprimorado
- [x] Criar um **Seletor Visual de Posição (Mini-Tela 16:9)** onde os 6 pontos da tela (Superior/Inferior × Esq/Centro/Dir) aparecem desenhados dentro de um retângulo representando a tela do OBS.
- [x] Adicionar seletor de fundo no **Preview em Tempo Real**:
  - `🏁 Transparência` (quadriculado mais fino e elegante)
  - `🌑 Palco Escuro` (simula transmissão noturna/igreja com pouca luz)
  - `🎄 Fundo Natalino` (gradiente quente desfocado para testar leitura do tema de Natal)

### Fase 4: Evolução do Monitor Ao Vivo (Popup / Barra Integrada)
- [x] Integrar ou ancorar o **Monitor Ao Vivo (Popup)** de forma que ele nunca cubra os controles da coluna direita, adicionando uma barra de progresso circular ou linear mais fluida, indicador claro da origem (`💬 Público` vs `🔄 Carrossel`) e transição suave de cores.
- [x] Adicionar estado vazio (*Empty State*) ilustrado com ícone SVG sutil na **Fila do Público** quando não houver recados pendentes.

### Fase 5: Polimento Premium dos Temas do Overlay (`/overlay`)
- [x] **Tema Cantata de Natal**:
  - Ajustar o espaçamento superior (`padding-top`) para que o medalhão da estrela dourada nunca encoste na primeira linha do texto.
  - Adicionar brilho suave animado (*shimmer*) na borda dourada e partículas de luz natalina sutis no fundo do card.
  - Refinar o alinhamento entre aspas/texto e a pílula do autor/versículo.
- [x] **Tema Clean & Moderno**:
  - Refinar o *glassmorphism* com borda luminosa superior (`border-top-highlight`), sombra mais suave e tipografia com melhor contraste para leitura em vídeos claros ou escuros.
