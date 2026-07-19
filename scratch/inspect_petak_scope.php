<?php
$content = file_get_contents('js/seed-data.js');
$start = strpos($content, '{');
$json = substr($content, $start);
$json = rtrim(trim($json), ';');
$data = json_decode($json, true);

if (json_last_error() === JSON_ERROR_NONE) {
    // We want to check petaks starting with 40 or 41
    // and print their TPG info
    $tpgMap = [];
    if (isset($data['tpg'])) {
        foreach ($data['tpg'] as $t) {
            $tpgMap[$t['id']] = $t['nama'] . " ({$t['id']})";
        }
    }
    
    $apMap = [];
    if (isset($data['anak_petak'])) {
        foreach ($data['anak_petak'] as $ap) {
            $apMap[$ap['petak_id']] = $ap['tpg_id'];
        }
    }

    if (isset($data['petak'])) {
        foreach ($data['petak'] as $pt) {
            if (strpos($pt['nomor'], '40') === 0 || strpos($pt['nomor'], '41') === 0) {
                $tpgId = isset($apMap[$pt['id']]) ? $apMap[$pt['id']] : 'N/A';
                $tpgName = isset($tpgMap[$tpgId]) ? $tpgMap[$tpgId] : $tpgId;
                echo "Petak Nomor: {$pt['nomor']}, TPG: $tpgName\n";
            }
        }
    }
} else {
    echo "JSON Decode Error: " . json_last_error_msg() . "\n";
}
?>
