@echo off
title Terowongan Online SIPENA (localhost.run)
echo ==============================================================
echo     MEMBUAT TEROWONGAN ONLINE SIPENA PINUS (GRATIS)
echo ==============================================================
echo.
echo JANGAN TUTUP jendela ini selama teman Anda sedang melakukan uji coba!
echo Jika jendela ini ditutup, terowongan online akan terputus.
echo.
echo Menghubungkan ke server terowongan...
echo (Jika ditanya yes/no, ketik yes lalu tekan Enter)
echo.
ssh -o StrictHostKeyChecking=no -R 80:localhost:80 nokey@localhost.run
echo.
echo Terowongan terputus.
pause
