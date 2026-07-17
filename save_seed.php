<?php
header('Content-Type: application/json');

// Ensure we only allow requests from localhost
if ($_SERVER['REMOTE_ADDR'] !== '127.0.0.1' && $_SERVER['REMOTE_ADDR'] !== '::1') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Forbidden']);
    exit;
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON']);
    exit;
}

// Format the seed-data file nicely
$jsonText = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$fileContent = "window.SIPENA_SEED_DATA = " . $jsonText . ";\n";

$targetFile = __DIR__ . '/js/seed-data.js';

if (file_put_contents($targetFile, $fileContent)) {
    echo json_encode(['success' => true, 'message' => 'Seed data updated successfully']);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to write seed-data.js']);
}
?>
