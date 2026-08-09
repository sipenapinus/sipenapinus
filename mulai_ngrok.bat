@echo off
title Mulai Tunnel Ngrok SIPENA
echo ==============================================================
echo                 TUNNELING ONLINE DENGAN NGROK
echo ==============================================================
echo.
echo Dapatkan token gratis Anda di: https://dashboard.ngrok.com/get-started/your-authtoken
echo.
echo Jika Anda belum mendaftarkan authtoken Anda, silakan paste/masukkan di bawah.
echo (Jika Anda SUDAH pernah mendaftarkannya sebelumnya, langsung tekan ENTER saja)
echo.
set /p token="Masukkan Authtoken Ngrok (atau tekan Enter jika sudah ada): "

if not "%token%"=="" (
    echo Mendaftarkan token baru...
    ngrok config add-authtoken %token%
)

echo.
echo Menjalankan Ngrok pada port 80...
echo Salin alamat URL "Forwarding" (misalnya https://xxxx.ngrok-free.app) untuk dikirim ke teman Anda.
echo Jangan tutup jendela ini selama teman Anda sedang mencoba aplikasi!
echo.
ngrok http 80 --domain=lumber-wreckage-napkin.ngrok-free.dev
pause
