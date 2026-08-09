<?php
require_once __DIR__ . '/../api/db_config.php';

try {
    $stmt = $pdo->query("SELECT * FROM realisasi");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "Total realisasi records: " . count($rows) . "\n";
    print_r($rows);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
