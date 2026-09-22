!macro customInstall
  ; Before the package-name split, Nightly's own installer record pointed at
  ; Stable's shared `kawaikara` directory. The new installer has already
  ; written its separate identity, so remove only that obsolete Nightly record.
  DeleteRegKey HKCU "Software\237ce928-944e-5933-bb36-77de4ccdd88e"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\237ce928-944e-5933-bb36-77de4ccdd88e"
  ${If} $installMode == "all"
    DeleteRegKey HKLM "Software\237ce928-944e-5933-bb36-77de4ccdd88e"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\237ce928-944e-5933-bb36-77de4ccdd88e"
  ${EndIf}
!macroend
