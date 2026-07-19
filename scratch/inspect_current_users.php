<?php
$content = file_get_contents('js/seed-data.js');
$start = strpos($content, '{');
$json = substr($content, $start);
$json = rtrim(trim($json), ';');
$data = json_decode($json, true);

if (json_last_error() === JSON_ERROR_NONE) {
    if (isset($data['users'])) {
        foreach ($data['users'] as $u) {
            if ($u['role'] === 'mandor') {
                echo "Mandor: {$u['nama_lengkap']}, ID: {$u['id']}, Username: {$u['username']}, Scope: {$u['scope']}\n";
            }
        }
    }
}
?>
