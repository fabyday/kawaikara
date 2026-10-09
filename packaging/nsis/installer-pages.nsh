; Standard NSIS welcome layout and an explicit launch choice on completion.
!ifndef BUILD_UNINSTALLER
  Var kawaiLaunchRequested
  Var kawaiLaunchCheckbox

  !macro customWelcomePage
    !ifdef MUI_WELCOMEFINISHPAGE_BITMAP
      !undef MUI_WELCOMEFINISHPAGE_BITMAP
    !endif
    !define MUI_WELCOMEFINISHPAGE_BITMAP "${BUILD_RESOURCES_DIR}\generated\installer-banner.bmp"
    !define MUI_WELCOMEPAGE_TITLE "$(kawai_welcomeTitle)"
    !define MUI_WELCOMEPAGE_TEXT "$(kawai_welcomeBody)"
    !define MUI_PAGE_CUSTOMFUNCTION_PRE kawaiWelcomePre
    !insertmacro MUI_PAGE_WELCOME
    Function kawaiWelcomePre
      ${If} ${isUpdated}
        Abort
      ${EndIf}
    FunctionEnd
  !macroend

  !macro customFinishPage
    Page custom kawaiFinishPage kawaiFinishLeave
    Function kawaiFinishPage
      !insertmacro MUI_HEADER_TEXT "$(kawai_finishedTitle)" "${PRODUCT_NAME}"
      nsDialogs::Create 1018
      Pop $0
      ${NSD_CreateLabel} 0 8u 100% 42u "$(kawai_finishedBody)"
      Pop $0
      ${NSD_CreateCheckbox} 0 60u 100% 18u "$(kawai_launchApp)"
      Pop $kawaiLaunchCheckbox
      ${NSD_SetState} $kawaiLaunchCheckbox ${BST_CHECKED}
      GetDlgItem $0 $HWNDPARENT 1
      SendMessage $0 ${WM_SETTEXT} 0 "STR:$(kawai_finishButton)"
      GetDlgItem $0 $HWNDPARENT 3
      EnableWindow $0 0
      nsDialogs::Show
    FunctionEnd
    Function kawaiFinishLeave
      ${NSD_GetState} $kawaiLaunchCheckbox $kawaiLaunchRequested
    FunctionEnd
    ; Expand after electron-builder has registered its StdUtils plugin directory.
    Function kawaiLaunchFinishedApp
      !ifdef KAWAI_INSTALLER_PREVIEW
        ; Preview proves the checkbox outcome without starting any installed channel.
        FileOpen $0 "$EXEDIR\launch-requested.txt" w
        FileWrite $0 "preview-only"
        FileClose $0
      !else
        ${StdUtils.ExecShellAsUser} $0 "$INSTDIR\${PRODUCT_FILENAME}.exe" "open" ""
      !endif
    FunctionEnd
  !macroend
!endif
