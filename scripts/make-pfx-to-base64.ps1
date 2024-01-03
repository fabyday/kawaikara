
# https://stackoverflow.com/questions/46959822/base-64-encoded-form-of-the-pfx-file
$fileContentBytes = get-content 'private/fabyday.pfx' -Encoding Byte

[System.Convert]::ToBase64String($fileContentBytes) | Out-File 'private\pfx-bytes.txt'
