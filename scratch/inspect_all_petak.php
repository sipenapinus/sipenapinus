<?php
$content = file_get_contents('js/seed-data.js');
$start = strpos($content, '{');
$json = substr($content, $start);
$json = rtrim(trim($json), ';');
$data = json_decode($json, true);

if (json_last_error() === JSON_ERROR_NONE) {
    if (isset($data['petak'])) {
        echo "Petaks starting with 40 or 41:\n";
        foreach ($data['petak'] as $pt) {
            if (strpos($pt['nomor'], '40') === 0 || strpos($pt['nomor'], '41') === 0) {
                echo "ID: {$pt['id']}, Nomor: {$pt['nomor']}\n";
            }
        }
    }
} else {
    echo "JSON Decode Error: " . json_last_error_msg() . "\n";
}
?>
