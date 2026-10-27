!macro customHeader
  !define MUI_WELCOMEPAGE_TITLE "Assistente de Instalação & Atualização — tImago"
  !define MUI_WELCOMEPAGE_TEXT "Bem-vindo ao Assistente do tImago.$\r$\n$\r$\nO assistente detectará instalações existentes e atualizará os arquivos do programa com segurança para a versão ${VERSION}.$\r$\n$\r$\nSuas playlists, frases, placares e configurações personalizadas em %APPDATA%\tImago serão 100% preservadas intactas.$\r$\n$\r$\nClique em Avançar para continuar."
!macroend

!macro customInit
  ; Fecha qualquer instância anterior em execução para evitar erros de arquivo em uso
  ExecWait 'taskkill /F /IM tImago.exe' $R0
!macroend
