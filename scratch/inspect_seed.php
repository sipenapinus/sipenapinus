<?php
$content = file_get_contents('../js/seed-data.js');
// The file has window.SIPENA_SEED_DATA = { ... };
// Let's parse it as JSON
$start = strpos($content, '{');
$json = substr($content, $start);
// Remove trailing semicolon if any
$json = rtrim(trim($json), ';');
$data = json_decode($json, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    echo "JSON Parse Error: " . json_last_error_msg() . "\n";
    // Let's do regex search
    preg_match('/"penugasan":\s*\[(.*?)\]/s', $content, $matches);
    if (!empty($matches)) {
        echo "Regex matched penugasan segment:\n";
        echo substr($matches[1], 0, 1000) . "\n";
    } else {
        echo "Regex failed to match penugasan.\n";
    }
} else {
    echo "Parsed successfully!\n";
    if (isset($data['penugasan'])) {
        echo "Number of penugasan: " . count($data['penugasan']) . "\n";
        if (count($data['penugasan']) > 0) {
            print_r(array_slice($data['penugasan'], 0, 5));
        }
    } else {
        echo "penugasan key not found.\n";
    }
}
?>
