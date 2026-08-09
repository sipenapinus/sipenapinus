<?php
// check_db.php — Debug: Cek jumlah data di MySQL untuk setiap tabel
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/db_config.php';

$stores = [
    'users', 'bkph', 'rph', 'tpg', 'petak', 'anak_petak', 'penyadap_master',
    'penugasan', 'target_bkph', 'target_rph', 'target_tpg', 'target_mandor',
    'target_penyadap', 'target_anak_petak', 'kehadiran', 'monitoring', 'ro', 'realisasi'
];

$result = [];
foreach ($stores as $store) {
    try {
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM `$store`");
        $row = $stmt->fetch();
        $result[$store] = (int)$row['total'];
    } catch (Exception $e) {
        $result[$store] = 'ERROR: ' . $e->getMessage();
    }
}

echo json_encode(['success' => true, 'counts' => $result, 'time' => date('Y-m-d H:i:s')]);
?>
