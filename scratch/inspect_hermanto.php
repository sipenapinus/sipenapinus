<?php
$content = file_get_contents('js/seed-data.js');
$start = strpos($content, '{');
$json = substr($content, $start);
$json = rtrim(trim($json), ';');
$data = json_decode($json, true);

if (json_last_error() === JSON_ERROR_NONE) {
    $hermantoId = null;
    if (isset($data['penyadap_master'])) {
        foreach ($data['penyadap_master'] as $pm) {
            if (stripos($pm['nama'], 'Hermanto') !== false || $pm['nomor'] === 'PS-005') {
                echo "Found Hermanto: ID={$pm['id']}, Nomor={$pm['nomor']}, Nama={$pm['nama']}, CreatedBy={$pm['created_by']}\n";
                $hermantoId = $pm['id'];
            }
        }
    }
    
    if ($hermantoId && isset($data['penugasan'])) {
        foreach ($data['penugasan'] as $pg) {
            if ($pg['penyadap_id'] === $hermantoId) {
                echo "Hermanto Assignment: Areal={$pg['anak_petak_id']}, Aktif={$pg['aktif']}, CreatedBy={$pg['created_by']}\n";
            }
        }
    }
} else {
    echo "JSON Decode Error: " . json_last_error_msg() . "\n";
}
?>
