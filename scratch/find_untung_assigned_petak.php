<?php
$content = file_get_contents('js/seed-data.js');
$start = strpos($content, '{');
$json = substr($content, $start);
$json = rtrim(trim($json), ';');
$data = json_decode($json, true);

if (json_last_error() === JSON_ERROR_NONE) {
    // 1. Find Untung Priyono
    $untung = null;
    if (isset($data['users'])) {
        foreach ($data['users'] as $u) {
            if (stripos($u['nama_lengkap'], 'Untung') !== false) {
                $untung = $u;
                break;
            }
        }
    }

    if (!$untung) {
        echo "Untung Priyono user not found.\n";
        exit;
    }

    $untungId = $untung['id'];
    echo "Untung Priyono ID: $untungId\n";

    // 2. Count petaks where mandor_id = Untung's ID
    $assignedPetaks = [];
    if (isset($data['petak'])) {
        foreach ($data['petak'] as $pt) {
            if ($pt['mandor_id'] === $untungId) {
                $assignedPetaks[] = $pt['nomor'];
            }
        }
    }

    echo "Total petaks assigned to Untung in seed data: " . count($assignedPetaks) . "\n";
    if (count($assignedPetaks) > 0) {
        echo "Assigned Petak Nomors: " . implode(', ', $assignedPetaks) . "\n";
    }
    
} else {
    echo "Error parsing JSON\n";
}
?>
