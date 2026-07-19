<?php
$file = 'C:\\Users\\jonig\\.gemini\\antigravity-ide\\brain\\2f1d784b-e80e-4c73-b600-cbe2436479cd\\.system_generated\\logs\\transcript.jsonl';
if (!file_exists($file)) {
    echo "File not found: $file\n";
    exit;
}

$lines = file($file);
$idx = 1;
foreach ($lines as $line) {
    $data = json_decode($line, true);
    if ($data) {
        $content = isset($data['content']) ? $data['content'] : '';
        if (stripos($content, 'ringkasan') !== false || stripos($content, 'summary') !== false) {
            $source = isset($data['source']) ? $data['source'] : 'SYSTEM';
            $type = isset($data['type']) ? $data['type'] : '';
            echo "Step {$data['step_index']} ($source/$type): " . substr(trim($content), 0, 300) . "...\n\n";
        }
    }
}
?>
