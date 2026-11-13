; Instalador do tImago (edição Rust) — equivalente ao alvo "nsis" do electron-builder.
; Compilado pelo build.ps1:
;   makensis /INPUTCHARSET UTF8 /DVERSION=x.y.z /DAPP_DIR=<pasta com tImago.exe> /DOUT_FILE=<setup.exe> timago.nsi

Unicode true
SetCompressor /SOLID lzma
RequestExecutionLevel user

!include "MUI2.nsh"

!define APP_NAME "tImago"
!define APP_ID "com.ttreter.timago"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"

; Chave gerada pelo electron-builder (UUIDv5 do appId) nas versões 1.x
!define ELECTRON_GUID "93fb03c5-a57e-5307-9cd7-5f731a6ccf38"
!define WEBVIEW2_KEY "Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"

Name "${APP_NAME} ${VERSION}"
OutFile "${OUT_FILE}"
; Mesma pasta usada pela versão Electron (instalação por usuário), para atualizar por cima
InstallDir "$LOCALAPPDATA\Programs\${APP_NAME}"
InstallDirRegKey HKCU "Software\${APP_ID}" "InstallLocation"

!define MUI_ICON "..\..\build\icon.ico"
!define MUI_UNICON "..\..\build\icon.ico"
!define MUI_WELCOMEPAGE_TITLE "Assistente de Instalação & Atualização — tImago"
!define MUI_WELCOMEPAGE_TEXT "Bem-vindo ao Assistente do tImago.$\r$\n$\r$\nO assistente detectará instalações existentes e atualizará os arquivos do programa com segurança para a versão ${VERSION}.$\r$\n$\r$\nSuas playlists, frases, placares e configurações personalizadas em %APPDATA%\tImago serão 100% preservadas intactas.$\r$\n$\r$\nClique em Avançar para continuar."
!define MUI_FINISHPAGE_RUN "$INSTDIR\tImago.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir o tImago agora"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"

Function .onInit
  ; A edição Rust usa o WebView2 do Windows. Sem ele o app não abre, então
  ; avisamos ANTES de substituir uma instalação antiga que está funcionando.
  SetRegView 64
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\${WEBVIEW2_KEY}" "pv"
  StrCmp $0 "" 0 webview_ok
  ReadRegStr $0 HKLM "SOFTWARE\${WEBVIEW2_KEY}" "pv"
  StrCmp $0 "" 0 webview_ok
  ReadRegStr $0 HKCU "Software\${WEBVIEW2_KEY}" "pv"
  StrCmp $0 "" 0 webview_ok
  MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 "O Microsoft Edge WebView2 Runtime não foi encontrado neste computador.$\r$\n$\r$\nO tImago ${VERSION} precisa dele para abrir a janela do painel. Instale-o em https://go.microsoft.com/fwlink/p/?LinkId=2124703 e execute este instalador novamente.$\r$\n$\r$\nDeseja instalar o tImago mesmo assim?" /SD IDYES IDYES webview_ok
  Abort
  webview_ok:

  ; Fecha qualquer instância anterior em execução para evitar erros de arquivo em uso
  nsExec::Exec 'taskkill /F /IM tImago.exe'
  Sleep 600
FunctionEnd

Section "tImago"
  ; Remove os arquivos da versão Electron que estiverem na mesma pasta
  RMDir /r "$INSTDIR\locales"
  RMDir /r "$INSTDIR\resources"
  Delete "$INSTDIR\*.pak"
  Delete "$INSTDIR\*.dll"
  Delete "$INSTDIR\*.bin"
  Delete "$INSTDIR\*.dat"
  Delete "$INSTDIR\*.json"
  Delete "$INSTDIR\LICENSE*"
  Delete "$INSTDIR\Uninstall tImago.exe"
  Delete "$INSTDIR\uninstallerIcon.ico"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${ELECTRON_GUID}"
  DeleteRegKey HKCU "Software\${ELECTRON_GUID}"

  SetOutPath "$INSTDIR"
  File "${APP_DIR}\*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\tImago.exe"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}.lnk" "$INSTDIR\tImago.exe"

  WriteRegStr HKCU "Software\${APP_ID}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "Tiago Treter (TTreter)"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\tImago.exe"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /F /IM tImago.exe'
  Sleep 600
  Delete "$INSTDIR\tImago.exe"
  Delete "$INSTDIR\WebView2Loader.dll"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}.lnk"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "tImago"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
  DeleteRegKey HKCU "Software\${APP_ID}"
  ; Os dados do usuário em %APPDATA%\tImago são preservados de propósito
SectionEnd
