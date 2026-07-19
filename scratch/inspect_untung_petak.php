<?php
$content = file_get_contents('js/seed-data.js');
$start = strpos($content, '{');
$json = substr($content, $start);
$json = rtrim(trim($json), ';');
$data = json_decode($json, true);

if (json_last_error() === JSON_ERROR_NONE) {
    // 1. Find Mandor Untung Priyono
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
        echo "User Untung Priyono not found.\n";
        exit;
    }

    echo "Mandor: {$untung['nama_lengkap']} (Username: {$untung['username']})\n";
    echo "Role: {$untung['role']}\n";
    echo "TPG ID Scope: {$untung['scope']}\n";

    // 2. Find TPG Name
    $tpgName = "Unknown TPG";
    if (isset($data['tpg'])) {
        foreach ($data['tpg'] as $t) {
            if ($t['id'] === $untung['scope']) {
                $tpgName = $t['nama'];
                break;
            }
        }
    }
    echo "TPG Name: $tpgName\n\n";

    // 3. Find all Anak Petak & Petak under this TPG
    $petakIds = [];
    $anakPetaks = [];
    
    if (isset($data['anak_petak'])) {
        foreach ($data['anak_petak'] as $ap) {
            if ($ap['tpg_id'] === $untung['scope']) {
                $anakPetaks[] = $ap;
                $petakIds[] = $ap['petak_id'];
            }
        }
    }

    $petakIds = array_unique($petakIds);
    $petaks = [];
    if (isset($data['petak'])) {
        foreach ($data['petak'] as $pt) {
            if (in_array($pt['id'], $petakIds)) {
                $petaks[$pt['id']] = $pt;
            }
        }
    }

    echo "Daftar Petak & Anak Petak Pangkuan:\n";
    foreach ($anakPetaks as $ap) {
        $ptNomor = isset($petaks[$ap['petak_id']]) ? $petaks[$ap['petak_id']]['nomor'] : 'N/A';
        echo "- Petak {$ptNomor}" . ($ap['huruf'] ? $ap['huruf'] : '') . " (Luas: {$ap['luas_ha']} Ha, Pohon: {$ap['jumlah_pohon']} pohon)\n";
    }
    
} else {
    echo "JSON Decode Error: " . json_last_error_msg() . "\n";
}
?>
