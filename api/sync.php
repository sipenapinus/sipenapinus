<?php
// sync.php — Online Synchronization API for SIPENA Lite

set_time_limit(0);
ini_set('memory_limit', '256M');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

require_once __DIR__ . '/db_config.php';

// Parse JSON input
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON payload']);
    exit;
}

$lastSyncMs = isset($data['last_sync']) ? floatval($data['last_sync']) : 0;

// Convert client milliseconds timestamp to ISO 8601 string for comparison
$seconds = floor($lastSyncMs / 1000);
$ms = $lastSyncMs % 1000;
$lastSyncIso = gmdate("Y-m-d\TH:i:s", $seconds) . sprintf(".%03dZ", $ms);

$queue = isset($data['queue']) ? $data['queue'] : [];
$currentServerMs = round(microtime(true) * 1000);

// Daftar store yang diizinkan untuk sinkronisasi
$allowedStores = [
    'users', 'bkph', 'rph', 'tpg', 'petak', 'anak_petak', 'penyadap_master',
    'penugasan', 'target_bkph', 'target_rph', 'target_tpg', 'target_mandor',
    'target_penyadap', 'target_anak_petak', 'kehadiran', 'monitoring', 'ro', 'realisasi'
];

// Cache struktur kolom setiap tabel di MySQL untuk mencegah error 'Unknown column'
$tableColumnsCache = [];
foreach ($allowedStores as $store) {
    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM `$store`");
        if ($stmt) {
            $tableColumnsCache[$store] = $stmt->fetchAll(PDO::FETCH_COLUMN);
        }
    } catch (Exception $e) {
        $tableColumnsCache[$store] = [];
    }
}

$syncedIds = [];
$errors    = [];

// ── 1. Process client sync queue ──
foreach ($queue as $item) {
    $storeName = isset($item['storeName']) ? $item['storeName'] : '';
    $action    = isset($item['action'])    ? $item['action']    : '';
    $payload   = isset($item['payload'])   ? $item['payload']   : [];

    if (!in_array($storeName, $allowedStores) || empty($payload)) {
        $syncedIds[] = $item['id'];
        continue;
    }

    $validCols = isset($tableColumnsCache[$storeName]) ? $tableColumnsCache[$storeName] : [];

    try {
        if ($action === 'create' || $action === 'update') {
            $fields       = [];
            $params       = [];
            $updateFields = [];

            foreach ($payload as $key => $val) {
                if (is_array($val)) continue; // skip nested object/array
                $safeKey = preg_replace('/[^a-zA-Z0-9_]/', '', $key);

                // Hanya sertakan kolom yang ada di database MySQL
                if (!empty($validCols) && !in_array($safeKey, $validCols)) {
                    continue;
                }

                $fields[]              = "`$safeKey`";
                $params[":f_$safeKey"] = $val;
                if ($safeKey !== 'id') {
                    $updateFields[]        = "`$safeKey` = :u_$safeKey";
                    $params[":u_$safeKey"] = $val;
                }
            }

            if (!empty($fields)) {
                $fieldsStr = implode(', ', $fields);
                $phList    = [];
                foreach ($fields as $f) {
                    $k        = trim($f, '`');
                    $phList[] = ":f_$k";
                }
                $placeholdersStr = implode(', ', $phList);

                if (empty($updateFields)) {
                    $sql  = "INSERT IGNORE INTO `$storeName` ($fieldsStr) VALUES ($placeholdersStr)";
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute(array_filter($params, fn($k) => strpos($k, ':f_') === 0, ARRAY_FILTER_USE_KEY));
                } else {
                    $updateStr = implode(', ', $updateFields);
                    $sql       = "INSERT INTO `$storeName` ($fieldsStr) VALUES ($placeholdersStr) ON DUPLICATE KEY UPDATE $updateStr";
                    $stmt      = $pdo->prepare($sql);
                    $stmt->execute($params);
                }
            }
        } elseif ($action === 'delete') {
            $nowIso = gmdate("Y-m-d\TH:i:s") . ".000Z";
            $sql    = "UPDATE `$storeName` SET `deleted_at` = :da, `updated_at` = :ua WHERE `id` = :id";
            $stmt   = $pdo->prepare($sql);
            $stmt->execute([':da' => $nowIso, ':ua' => $nowIso, ':id' => $payload['id']]);
        }

        $syncedIds[] = $item['id'];
    } catch (Exception $e) {
        $errors[] = "[$storeName] " . $e->getMessage();
    }
}

// ── 2. Fetch server updates since last_sync ──
$updates = [];
foreach ($allowedStores as $storeName) {
    try {
        $sql  = "SELECT * FROM `$storeName` WHERE `updated_at` > :ls1 OR `deleted_at` > :ls2";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':ls1' => $lastSyncIso, ':ls2' => $lastSyncIso]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (!empty($rows)) {
            $updates[] = ['storeName' => $storeName, 'items' => $rows];
        }
    } catch (Exception $e) {
        $errors[] = "[fetch:$storeName] " . $e->getMessage();
    }
}

echo json_encode([
    'success'    => true,
    'last_sync'  => $currentServerMs,
    'synced_ids' => $syncedIds,
    'updates'    => $updates,
    'errors'     => $errors,
]);
?>
