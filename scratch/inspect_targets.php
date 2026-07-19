<?php
$content = file_get_contents('js/seed-data.js');
$start = strpos($content, '{');
$json = substr($content, $start);
$json = rtrim(trim($json), ';');
$data = json_decode($json, true);

if (json_last_error() === JSON_ERROR_NONE) {
    if (isset($data['target_penyadap'])) {
        echo "Total target_penyadap records: " . count($data['target_penyadap']) . "\n";
        foreach ($data['target_penyadap'] as $tp) {
            // Find penyadap
            $pName = $tp['penyadap_id'];
            if (isset($data['penyadap_master'])) {
                foreach ($data['penyadap_master'] as $pm) {
                    if ($pm['id'] === $tp['penyadap_id']) {
                        $pName = $pm['nama'] . " ({$pm['nomor']})";
                        break;
                    }
                }
            }
            echo "Penyadap: $pName, Areal: {$tp['anak_petak_id']}, Tahun: {$tp['tahun']}, Target: {$tp['target_kg']} Kg, Luas: {$tp['luas_ha']} Ha, Pohon: {$tp['pohon']}\n";
        }
    } else {
        echo "target_penyadap key not found\n";
    }

    if (isset($data['penugasan'])) {
        echo "\nTotal penugasan records: " . count($data['penugasan']) . "\n";
        foreach ($data['penugasan'] as $pg) {
            $pName = $pg['penyadap_id'];
            if (isset($data['penyadap_master'])) {
                foreach ($data['penyadap_master'] as $pm) {
                    if ($pm['id'] === $pg['penyadap_id']) {
                        $pName = $pm['nama'] . " ({$pm['nomor']})";
                        break;
                    }
                }
            }
            echo "Penyadap: $pName, Areal: {$pg['anak_petak_id']}, Aktif: {$pg['aktif']}\n";
        }
    }
} else {
    echo "JSON Decode Error: " . json_last_error_msg() . "\n";
}
?>
