; Keep the standard NSIS window size; the welcome page owns its sidebar image.
!ifndef BUILD_UNINSTALLER
  BrandingText "${PRODUCT_NAME}"
  Function .onGUIEnd
    ${If} $kawaiLaunchRequested == 1
      ShowWindow $HWNDPARENT ${SW_HIDE}
      Call kawaiLaunchFinishedApp
    ${EndIf}
  FunctionEnd
!endif
