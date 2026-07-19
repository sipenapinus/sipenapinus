<?php
$content = file_get_contents('js/seed-data.js');
$start = strpos($content, '{');
$json = substr($content, $start);
$json = rtrim(trim($json), ';');
$data = json_decode($json, true);

if (json_last_error() === JSON_ERROR_NONE) {
    if (isset($data['petak'])) {
        echo "Total petak: " . count($data['petak']) . "\n";
        echo "Sample petak:\n";
        foreach (array_slice($data['petak'], 0, 20) as $pt) {
            echo "ID: {$pt['id']}, Nomor: {$pt['nomor']}\n";
        }
    }
    if (isset($data['anak_petak'])) {
        echo "\nTotal anak_petak: " . count($data['anak_petak']) . "\n";
        echo "Sample anak_petak:\n";
        foreach (array_slice($data['anak_petak'], 0, 20) as $ap) {
            echo "ID: {$ap['id']}, Petak_ID: {$ap['petak_id']}, Huruf: {$ap['huruf']}, Luas: {$ap['luas_ha']}\n";
        }
    }
} else {
    echo "JSON Decode Error: " . json_last_error_msg() . "\n";
}
?>
