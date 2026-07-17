<?php
$content = file_get_contents('js/seed-data.js');
// Search for "target_mandor" or similar keys
preg_match('/"target_mandor":\s*\[(.*?)\]/s', $content, $matches);
if (!empty($matches)) {
    echo "Found target_mandor in seed-data.js:\n";
    echo substr($matches[1], 0, 1500) . "\n";
} else {
    echo "No target_mandor found in seed-data.js\n";
}

// Let's also check other target stores
$stores = ['target_bkph', 'target_rph', 'target_tpg', 'target_penyadap', 'target_anak_petak'];
foreach ($stores as $store) {
    if (preg_match('/"' . $store . '":\s*\[(.*?)\]/s', $content, $matches)) {
        echo "\nFound $store in seed-data.js:\n";
        echo substr($matches[1], 0, 1000) . "\n";
    }
}
?>
