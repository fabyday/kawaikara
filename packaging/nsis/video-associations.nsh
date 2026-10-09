; Channel-specific candidates and explicit Explorer actions, never forced defaults.
!macro kawaiVideoExtension EXT ACTION
  !if "${ACTION}" == "register"
    WriteRegStr SHCTX "Software\Classes\.${EXT}\OpenWithProgids" "${APP_ID}.Video" ""
    WriteRegStr SHCTX "Software\Kawaikara\${APP_ID}\Capabilities\FileAssociations" ".${EXT}" "${APP_ID}.Video"
    WriteRegStr SHCTX "Software\Classes\Applications\${PRODUCT_FILENAME}.exe\SupportedTypes" ".${EXT}" ""
    WriteRegStr SHCTX "Software\Classes\SystemFileAssociations\.${EXT}\shell\${APP_ID}.Video" "" "$(kawai_openVideo)"
    WriteRegStr SHCTX "Software\Classes\SystemFileAssociations\.${EXT}\shell\${APP_ID}.Video" "Icon" '$\"$INSTDIR\${PRODUCT_FILENAME}.exe$\",0'
    WriteRegStr SHCTX "Software\Classes\SystemFileAssociations\.${EXT}\shell\${APP_ID}.Video" "MultiSelectModel" "Single"
    WriteRegStr SHCTX "Software\Classes\SystemFileAssociations\.${EXT}\shell\${APP_ID}.Video\command" "" '$\"$INSTDIR\${PRODUCT_FILENAME}.exe$\" $\"%1$\"'
  !else
    DeleteRegValue SHCTX "Software\Classes\.${EXT}\OpenWithProgids" "${APP_ID}.Video"
    DeleteRegKey /ifempty SHCTX "Software\Classes\.${EXT}\OpenWithProgids"
    DeleteRegKey SHCTX "Software\Classes\SystemFileAssociations\.${EXT}\shell\${APP_ID}.Video"
  !endif
!macroend

!macro kawaiVideoExtensions ACTION
  !insertmacro kawaiVideoExtension "3gp" "${ACTION}"
  !insertmacro kawaiVideoExtension "avi" "${ACTION}"
  !insertmacro kawaiVideoExtension "flv" "${ACTION}"
  !insertmacro kawaiVideoExtension "m2ts" "${ACTION}"
  !insertmacro kawaiVideoExtension "m4v" "${ACTION}"
  !insertmacro kawaiVideoExtension "mkv" "${ACTION}"
  !insertmacro kawaiVideoExtension "mov" "${ACTION}"
  !insertmacro kawaiVideoExtension "mp4" "${ACTION}"
  !insertmacro kawaiVideoExtension "mpeg" "${ACTION}"
  !insertmacro kawaiVideoExtension "mpg" "${ACTION}"
  !insertmacro kawaiVideoExtension "mts" "${ACTION}"
  !insertmacro kawaiVideoExtension "ogv" "${ACTION}"
  !insertmacro kawaiVideoExtension "webm" "${ACTION}"
  !insertmacro kawaiVideoExtension "wmv" "${ACTION}"
  ; .ts is playable, but registering it would also add video actions to TypeScript source.
!macroend

!macro kawaiRegisterVideoAssociations
  WriteRegStr SHCTX "Software\RegisteredApplications" "${PRODUCT_NAME}" "Software\Kawaikara\${APP_ID}\Capabilities"
  WriteRegStr SHCTX "Software\Kawaikara\${APP_ID}\Capabilities" "ApplicationName" "${PRODUCT_NAME}"
  WriteRegStr SHCTX "Software\Kawaikara\${APP_ID}\Capabilities" "ApplicationDescription" "$(kawai_videoDescription)"
  WriteRegStr SHCTX "Software\Kawaikara\${APP_ID}\Capabilities" "ApplicationIcon" '$\"$INSTDIR\${PRODUCT_FILENAME}.exe$\",0'
  WriteRegStr SHCTX "Software\Classes\${APP_ID}.Video" "" "${PRODUCT_NAME} Video"
  WriteRegStr SHCTX "Software\Classes\${APP_ID}.Video\DefaultIcon" "" '$\"$INSTDIR\${PRODUCT_FILENAME}.exe$\",0'
  WriteRegStr SHCTX "Software\Classes\${APP_ID}.Video\shell\open\command" "" '$\"$INSTDIR\${PRODUCT_FILENAME}.exe$\" $\"%1$\"'
  WriteRegStr SHCTX "Software\Classes\${APP_ID}.Video\Application" "ApplicationName" "${PRODUCT_NAME}"
  WriteRegStr SHCTX "Software\Classes\Applications\${PRODUCT_FILENAME}.exe" "FriendlyAppName" "${PRODUCT_NAME}"
  WriteRegStr SHCTX "Software\Classes\Applications\${PRODUCT_FILENAME}.exe\shell\open\command" "" '$\"$INSTDIR\${PRODUCT_FILENAME}.exe$\" $\"%1$\"'
  !insertmacro kawaiVideoExtensions "register"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro customUnInstall
  ; Another installation of this same channel might already own the registration.
  ReadRegStr $0 SHCTX "Software\Classes\${APP_ID}.Video\shell\open\command" ""
  ${If} $0 == '$\"$INSTDIR\${PRODUCT_FILENAME}.exe$\" $\"%1$\"'
    !insertmacro kawaiVideoExtensions "unregister"
    DeleteRegValue SHCTX "Software\RegisteredApplications" "${PRODUCT_NAME}"
    DeleteRegKey SHCTX "Software\Kawaikara\${APP_ID}\Capabilities"
    DeleteRegKey /ifempty SHCTX "Software\Kawaikara\${APP_ID}"
    DeleteRegKey SHCTX "Software\Classes\${APP_ID}.Video"
    DeleteRegKey SHCTX "Software\Classes\Applications\${PRODUCT_FILENAME}.exe"
    System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  ${EndIf}
!macroend
