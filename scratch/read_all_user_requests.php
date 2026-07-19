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
    if ($data && isset($data['type']) && $data['type'] === 'USER_INPUT') {
        $content = isset($data['content']) ? $data['content'] : '';
        // Extract the user request
        if (preg_match('/<USER_REQUEST>\s*(.*?)\s*<\/USER_REQUEST>/s', $content, $matches)) {
            $req = trim($matches[1]);
            echo "Request #$idx: $req\n";
            $idx++;
        }
    }
}
?>
