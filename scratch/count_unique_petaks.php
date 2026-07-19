<?php
$content = file_get_contents('js/seed-data.js');
$start = strpos($content, '{');
$json = substr($content, $start);
$json = rtrim(trim($json), ';');
$data = json_decode($json, true);

if (json_last_error() === JSON_ERROR_NONE) {
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
        echo "User Untung not found.\n";
        exit;
    }

    $tpgId = $untung['scope'];

    // Find all anak petak under this TPG
    $apCount = 0;
    $parentPetakIds = [];
    if (isset($data['anak_petak'])) {
        foreach ($data['anak_petak'] as $ap) {
            if ($ap['tpg_id'] === $tpgId) {
                $apCount++;
                $parentPetakIds[] = $ap['petak_id'];
            }
        }
    }

    $uniquePetakIds = array_unique($parentPetakIds);
    $uniquePetakCount = count($uniquePetakIds);

    echo "Anak Petak Count: $apCount\n";
    echo "Unique Parent Petak Count: $uniquePetakCount\n";
    
    // Print unique petak numbers
    $petakNumbers = [];
    if (isset($data['petak'])) {
        foreach ($data['petak'] as $pt) {
            if (in_array($pt['id'], $uniquePetakIds)) {
                $petakNumbers[] = $pt['nomor'];
            }
        }
    }
    sort($petakNumbers);
    echo "Petak Numbers: " . implode(', ', $petakNumbers) . "\n";
    
} else {
    echo "Error parsing seed data\n";
}
?>
