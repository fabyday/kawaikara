mkdir ./private

openssl genpkey -algorithm RSA -out ./private/private-key-mac.pem -aes256
openssl req -new -key ./private/private-key-mac.pem -out ./private/my-cert.csr
openssl x509 -req -in ./private/my-cert.csr -signkey ./private/private-key-mac.pem -out ./private/my-cert.crt
openssl pkcs12 -export -in ./private/my-cert.crt -inkey ./private/private-key-mac.pem -out ./private/my-cert.p12 
certutil -encode ./private/my-cert.p12 ./private/my-cert.b64
