<?php
$content = file_get_contents('js/seed-data.js');
$pos = strpos($content, '72065');
if ($pos !== false) {
    echo "Found 72065 at position $pos\n";
    echo substr($content, $pos - 200, 400) . "\n";
} else {
    echo "72065 not found\n";
}

$pos2 = strpos($content, '72.065');
if ($pos2 !== false) {
    echo "Found 72.065 at position $pos2\n";
    echo substr($content, $pos2 - 200, 400) . "\n";
} else {
    echo "72.065 not found\n";
}

// Search for any target key in the seed data JSON
$start = strpos($content, '{');
$json = substr($content, $start);
$json = rtrim(trim($json), ';');
$data = json_decode($json, true);
if ($data) {
    echo "JSON Keys:\n";
    print_r(array_keys($data));
}
?>
