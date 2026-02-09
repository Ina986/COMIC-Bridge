!macro NSIS_HOOK_POSTINSTALL
  ; Overwrite shortcuts to use comic-bridge.ico instead of exe icon (avoids Windows icon cache issues)
  CreateShortCut "$SMPROGRAMS\${MAINBINARYNAME}\${MAINBINARYNAME}.lnk" \
                 "$INSTDIR\${MAINBINARYNAME}.exe" \
                 "" \
                 "$INSTDIR\comic-bridge.ico" \
                 0

  CreateShortCut "$DESKTOP\${MAINBINARYNAME}.lnk" \
                 "$INSTDIR\${MAINBINARYNAME}.exe" \
                 "" \
                 "$INSTDIR\comic-bridge.ico" \
                 0
!macroend
