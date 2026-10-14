<?php
// db_config.php — Database connection untuk Hostinger
// GANTI nilai di bawah ini sesuai info database dari cPanel Hostinger Anda

define('DB_HOST', 'localhost');          // Biasanya 'localhost' di Hostinger
define('DB_USER', 'u123456789_sipena'); // Ganti: username DB dari cPanel Hostinger
define('DB_PASS', 'GantiPasswordKuat!'); // Ganti: password DB dari cPanel
define('DB_NAME', 'u123456789_sipena'); // Ganti: nama database dari cPanel

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed'  // Jangan tampilkan detail error di production
    ]);
    exit;
}
?>
