!macro NSIS_HOOK_POSTINSTALL
  ; --- Step 1: Delete Windows icon cache files ---
  ; Local AppData icon caches (Windows 10/11)
  Delete "$LOCALAPPDATA\IconCache.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache_16.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache_32.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache_48.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache_96.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache_256.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache_768.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache_1280.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache_1920.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache_2560.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache_custom_stream.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache_exif.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache_idx.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache_sr.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache_wide.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache_wide_alternate.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_16.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_32.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_48.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_96.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_256.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_768.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_1280.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_1920.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_2560.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_custom_stream.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_exif.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_idx.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_sr.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_wide.db"
  Delete "$LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_wide_alternate.db"

  ; --- Step 2: Overwrite shortcuts to use comic-bridge.ico ---
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

  ; --- Step 3: Notify Windows shell that icons have changed ---
  System::Call 'Shell32::SHChangeNotify(i 0x08000000, i 0x1000, i 0, i 0)'

  ; --- Step 4: Refresh icon cache via ie4uinit ---
  nsExec::Exec 'ie4uinit.exe -show'

  ; --- Step 5: Deploy address-ref pointer (bridge migration to hardened app) ---
  ; Write the pointer only if absent, so already-configured machines are untouched.
  ; The JSON value is injected by CI from a secret (pure-ASCII, \uXXXX-escaped) so the
  ; file is valid UTF-8 regardless of the NSIS write encoding.
  IfFileExists "$LOCALAPPDATA\COMIC-Bridge\address-ref-location.json" cb_ptr_done 0
  CreateDirectory "$LOCALAPPDATA\COMIC-Bridge"
  Push $0
  FileOpen $0 "$LOCALAPPDATA\COMIC-Bridge\address-ref-location.json" w
  FileWrite $0 '__POINTER_JSON__'
  FileClose $0
  Pop $0
  cb_ptr_done:
!macroend
