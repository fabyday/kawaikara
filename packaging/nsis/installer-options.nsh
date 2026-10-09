!include nsDialogs.nsh
!include LogicLib.nsh
!include FileFunc.nsh
!include "${BUILD_RESOURCES_DIR}\generated\installer-locales.nsh"
!include "${__FILEDIR__}\nightly-identity-migration.nsh"
!include "${__FILEDIR__}\installer-pages.nsh"
!include "${__FILEDIR__}\installer-branding.nsh"
!include "${__FILEDIR__}\video-associations.nsh"

!ifndef BUILD_UNINSTALLER
  Var kawaiOptionsVisited
  Var kawaiOptionsInitialized
  Var kawaiDataRoot
  Var kawaiDefaultDataRoot
  Var kawaiLocatorDirectory
  Var kawaiLocatorPath
  Var kawaiDesktopCheckbox
  Var kawaiCustomCheckbox
  Var kawaiPathField
  Var kawaiBrowseButton
  Var kawaiWarning
  Var kawaiDesktopSelected
  Var kawaiCustomSelected

  !macro customInit
    ; Older app versions can hand off --updated without /S. Do not show Setup
    ; even in that case; interactive installation is reserved for direct opens.
    ${If} ${isUpdated}
      SetSilent silent
    ${EndIf}
    ; A small per-user locator survives uninstall. Never put it in $INSTDIR:
    ; NSIS replaces that directory on update. No application data is deleted here.
    SetShellVarContext current
    StrCpy $kawaiDefaultDataRoot "$APPDATA\${PRODUCT_NAME}"
    StrCpy $kawaiLocatorDirectory "$APPDATA\Kawaikara Installations"
    StrCpy $kawaiLocatorPath "$kawaiLocatorDirectory\${APP_ID}.ini"
    StrCpy $kawaiDataRoot $kawaiDefaultDataRoot
    ReadINIStr $0 $kawaiLocatorPath "storage" "root"
    ${If} $0 != ""
      StrCpy $kawaiDataRoot $0
    ${EndIf}
    ${If} $installMode == "all"
      SetShellVarContext all
    ${EndIf}
    StrCpy $kawaiOptionsVisited 0
    StrCpy $kawaiOptionsInitialized 0
  !macroend

  !macro customPageAfterChangeDir
    Page custom kawaiOptionsPage kawaiOptionsLeave

    Function kawaiOptionsPage
      ; Updater handoffs, including manual in-app updates, keep all prior choices.
      ${If} ${isUpdated}
        Abort
      ${EndIf}
      ${If} ${Silent}
        Abort
      ${EndIf}
      ${If} $kawaiOptionsInitialized != 1
        StrCpy $kawaiDesktopSelected ${BST_CHECKED}
        ${If} ${FileExists} "$INSTDIR\${PRODUCT_FILENAME}.exe"
        ${AndIfNot} ${FileExists} "$DESKTOP\${SHORTCUT_NAME}.lnk"
          StrCpy $kawaiDesktopSelected ${BST_UNCHECKED}
        ${EndIf}
        StrCpy $kawaiCustomSelected ${BST_UNCHECKED}
        ${If} $kawaiDataRoot != $kawaiDefaultDataRoot
          StrCpy $kawaiCustomSelected ${BST_CHECKED}
        ${EndIf}
        StrCpy $kawaiOptionsInitialized 1
      ${EndIf}
      !insertmacro MUI_HEADER_TEXT "$(kawai_title)" "$(kawai_description)"
      nsDialogs::Create 1018
      Pop $0
      ${If} $0 == error
        Abort
      ${EndIf}
      ${NSD_CreateCheckbox} 0 0 100% 14u "$(kawai_desktopShortcut)"
      Pop $kawaiDesktopCheckbox
      ${NSD_SetState} $kawaiDesktopCheckbox $kawaiDesktopSelected
      ${NSD_CreateCheckbox} 0 20u 100% 14u "$(kawai_customData)"
      Pop $kawaiCustomCheckbox
      ${NSD_SetState} $kawaiCustomCheckbox $kawaiCustomSelected
      ${NSD_OnClick} $kawaiCustomCheckbox kawaiToggleCustomData
      ${NSD_CreateLabel} 0 38u 100% 44u "$(kawai_warning)"
      Pop $kawaiWarning
      SetCtlColors $kawaiWarning CC2222 transparent
      ${NSD_CreateText} 0 86u 75% 14u "$kawaiDataRoot"
      Pop $kawaiPathField
      ${NSD_CreateButton} 77% 85u 23% 16u "$(kawai_browse)"
      Pop $kawaiBrowseButton
      ${NSD_OnClick} $kawaiBrowseButton kawaiBrowseData
      ${NSD_CreateLabel} 0 107u 100% 30u "$(kawai_dataHint)"
      Pop $0
      ${If} $installMode == "all"
        EnableWindow $kawaiCustomCheckbox 0
        ${NSD_SetState} $kawaiCustomCheckbox ${BST_UNCHECKED}
        ${NSD_SetText} $kawaiWarning "$(kawai_allUsers)"
      ${EndIf}
      Call kawaiUpdateDataControls
      nsDialogs::Show
    FunctionEnd

    Function kawaiToggleCustomData
      Pop $0
      ${If} $kawaiCustomSelected == ${BST_CHECKED}
        ${NSD_GetText} $kawaiPathField $kawaiDataRoot
      ${EndIf}
      Call kawaiUpdateDataControls
    FunctionEnd

    Function kawaiUpdateDataControls
      ${NSD_GetState} $kawaiCustomCheckbox $kawaiCustomSelected
      ${If} $kawaiCustomSelected == ${BST_CHECKED}
        ShowWindow $kawaiWarning ${SW_SHOW}
        EnableWindow $kawaiBrowseButton 1
        EnableWindow $kawaiPathField 1
        ${NSD_SetText} $kawaiPathField $kawaiDataRoot
      ${Else}
        ShowWindow $kawaiWarning ${SW_HIDE}
        EnableWindow $kawaiBrowseButton 0
        EnableWindow $kawaiPathField 0
        ${NSD_SetText} $kawaiPathField $kawaiDefaultDataRoot
      ${EndIf}
      ${If} $installMode == "all"
        ShowWindow $kawaiWarning ${SW_SHOW}
      ${EndIf}
    FunctionEnd

    Function kawaiBrowseData
      Pop $0
      nsDialogs::SelectFolderDialog "$(kawai_chooseFolder)" "$kawaiDataRoot"
      Pop $0
      ${If} $0 != error
        ; Always isolate channels. The selected folder is a parent, not UserRoot.
        GetFullPathName $kawaiDataRoot "$0"
        ${GetFileName} $kawaiDataRoot $1
        ${If} $1 != "${PRODUCT_NAME}"
          StrCpy $kawaiDataRoot "$kawaiDataRoot\${PRODUCT_NAME}"
        ${EndIf}
        ${NSD_SetText} $kawaiPathField $kawaiDataRoot
      ${EndIf}
    FunctionEnd

    Function kawaiOptionsLeave
      ${NSD_GetState} $kawaiDesktopCheckbox $kawaiDesktopSelected
      ${NSD_GetState} $kawaiCustomCheckbox $kawaiCustomSelected
      ${If} $installMode != "all"
        ${If} $kawaiCustomSelected == ${BST_CHECKED}
          ${NSD_GetText} $kawaiPathField $kawaiDataRoot
          StrCpy $0 $kawaiDataRoot 2 1
          ${If} $0 != ":\"
            Goto kawaiInvalidDataPath
          ${EndIf}
          ; Reject invalid path characters and alternate data streams before normalization.
          StrCpy $0 2
          kawaiValidatePathCharacter:
            StrCpy $1 $kawaiDataRoot 1 $0
            ${If} $1 == ""
              Goto kawaiNormalizeDataPath
            ${EndIf}
            ${If} $1 == ":"
            ${OrIf} $1 == "*"
            ${OrIf} $1 == "?"
            ${OrIf} $1 == '$\"'
            ${OrIf} $1 == "<"
            ${OrIf} $1 == ">"
            ${OrIf} $1 == "|"
            ${OrIf} $1 == "$\r"
            ${OrIf} $1 == "$\n"
            ${OrIf} $1 == "$\t"
              Goto kawaiInvalidDataPath
            ${EndIf}
            IntOp $0 $0 + 1
            Goto kawaiValidatePathCharacter
          kawaiNormalizeDataPath:
          ; Unlike NSIS GetFullPathName's long-name lookup, this also accepts
          ; folders that have not been created yet.
          System::Call 'kernel32::GetFullPathNameW(w "$kawaiDataRoot", i ${NSIS_MAX_STRLEN}, w .r2, p 0) i.r3'
          ${If} $3 == 0
          ${OrIf} $3 >= ${NSIS_MAX_STRLEN}
            Goto kawaiInvalidDataPath
          ${EndIf}
          StrCpy $kawaiDataRoot $2
          ${GetFileName} $kawaiDataRoot $0
          ${If} $0 != "${PRODUCT_NAME}"
            StrCpy $kawaiDataRoot "$kawaiDataRoot\${PRODUCT_NAME}"
          ${EndIf}
        ${Else}
          StrCpy $kawaiDataRoot $kawaiDefaultDataRoot
        ${EndIf}
        ${If} $kawaiDataRoot == $kawaiDefaultDataRoot
          Goto kawaiProbeDataPath
        ${EndIf}
        ; Reject UNC/device paths and paths that the app's uninstaller may remove.
        StrCpy $0 $kawaiDataRoot 2 1
        ${If} $0 != ":\"
          Goto kawaiInvalidDataPath
        ${EndIf}
        System::Call 'shlwapi::PathIsPrefixW(w "$INSTDIR", w "$kawaiDataRoot") i.r0'
        ${If} $0 != 0
          Goto kawaiInvalidDataPath
        ${EndIf}
        System::Call 'shlwapi::PathIsPrefixW(w "$kawaiDataRoot", w "$INSTDIR") i.r0'
        ${If} $0 != 0
          Goto kawaiInvalidDataPath
        ${EndIf}
        System::Call 'shlwapi::PathIsPrefixW(w "$WINDIR", w "$kawaiDataRoot") i.r0'
        ${If} $0 != 0
          Goto kawaiInvalidDataPath
        ${EndIf}
        System::Call 'shlwapi::PathIsPrefixW(w "$PROGRAMFILES", w "$kawaiDataRoot") i.r0'
        ${If} $0 != 0
          Goto kawaiInvalidDataPath
        ${EndIf}
        System::Call 'shlwapi::PathIsPrefixW(w "$PROGRAMFILES64", w "$kawaiDataRoot") i.r0'
        ${If} $0 != 0
          Goto kawaiInvalidDataPath
        ${EndIf}
        ${GetRoot} $kawaiDataRoot $0
        System::Call 'kernel32::GetDriveTypeW(w "$0\") i.r1'
        ${If} $1 != 2
        ${AndIf} $1 != 3
          Goto kawaiInvalidDataPath
        ${EndIf}
        kawaiProbeDataPath:
        !ifndef KAWAI_INSTALLER_PREVIEW
        ClearErrors
        StrCpy $2 $kawaiDataRoot
        ${If} $kawaiDataRoot == $kawaiDefaultDataRoot
          ; Do not pre-create the default root: Main may still migrate legacy data into it.
          ${GetParent} $kawaiDefaultDataRoot $2
        ${EndIf}
        CreateDirectory $2
        ${If} ${Errors}
          Goto kawaiInvalidDataPath
        ${EndIf}
        GetTempFileName $0 $2
        ${If} ${Errors}
          Goto kawaiInvalidDataPath
        ${EndIf}
        ; Only the newly generated write-probe is removed, never existing data.
        Delete $0
        !endif
      ${EndIf}
      StrCpy $kawaiOptionsVisited 1
      Return
      kawaiInvalidDataPath:
        MessageBox MB_OK|MB_ICONSTOP "$(kawai_invalidPath)"
        Abort
    FunctionEnd
  !macroend
!endif

!macro customInstall
  !insertmacro kawaiRegisterVideoAssociations
  ${If} $kawaiOptionsVisited == 1
    ${If} $kawaiDesktopSelected == ${BST_CHECKED}
      CreateShortCut "$newDesktopLink" "$INSTDIR\${PRODUCT_FILENAME}.exe" "" "$INSTDIR\${PRODUCT_FILENAME}.exe"
      WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    ${Else}
      WinShell::UninstShortcut "$newDesktopLink"
      Delete "$newDesktopLink"
    ${EndIf}
    ${If} $installMode != "all"
      ; UTF-16 INI preserves Korean/Japanese paths. Replace only our locator file.
      ClearErrors
      CreateDirectory $kawaiLocatorDirectory
      ${If} ${Errors}
        Goto kawaiSaveLocationFailed
      ${EndIf}
      GetTempFileName $0 $kawaiLocatorDirectory
      ${If} ${Errors}
        Goto kawaiSaveLocationFailed
      ${EndIf}
      FileOpen $1 $0 w
      ${If} ${Errors}
        Goto kawaiSaveLocationFailed
      ${EndIf}
      FileWriteWord $1 0xFEFF
      FileWriteUTF16LE $1 "[storage]$\r$\nroot=$kawaiDataRoot$\r$\n"
      FileClose $1
      ${If} ${Errors}
        Goto kawaiSaveLocationFailed
      ${EndIf}
      System::Call 'kernel32::MoveFileExW(w r0, w "$kawaiLocatorPath", i 9) i.r1'
      ${If} $1 == 0
        Goto kawaiSaveLocationFailed
      ${EndIf}
    ${EndIf}
  ${EndIf}
  !if "${APP_ID}" == "day.faby.kawaikara.nightly"
    !insertmacro kawaikaraMigrateNightlyIdentity
  !endif
  Goto kawaiInstallOptionsDone
  kawaiSaveLocationFailed:
    MessageBox MB_OK|MB_ICONSTOP "$(kawai_saveFailed)"
    Abort
  kawaiInstallOptionsDone:
!macroend
