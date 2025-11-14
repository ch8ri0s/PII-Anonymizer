/**
 * Quick test script for file preview functionality
 * Run this in the Electron app's DevTools console
 */

async function testFilePreview() {
  console.log('🧪 Testing File Preview Feature...\n');

  // Test 1: File Metadata
  console.log('Test 1: Get File Metadata');
  try {
    const testFile = './test/data/sample.txt';
    const metadata = await window.electronAPI.getFileMetadata(testFile);

    if ('error' in metadata) {
      console.error('❌ Metadata Error:', metadata.error);
    } else {
      console.log('✅ Metadata loaded successfully:');
      console.log('  - Filename:', metadata.filename);
      console.log('  - Size:', metadata.fileSizeFormatted);
      console.log('  - Lines:', metadata.lineCount);
      console.log('  - Words:', metadata.wordCount);
    }
  } catch (error) {
    console.error('❌ Test 1 failed:', error);
  }

  console.log('\n---\n');

  // Test 2: File Preview
  console.log('Test 2: Get File Preview');
  try {
    const testFile = './test/data/sample.txt';
    const preview = await window.electronAPI.getFilePreview(testFile, {
      lines: 20,
      chars: 1000
    });

    if ('error' in preview) {
      console.error('❌ Preview Error:', preview.error);
    } else {
      console.log('✅ Preview loaded successfully:');
      console.log('  - Preview lines:', preview.previewLineCount);
      console.log('  - Preview chars:', preview.previewCharCount);
      console.log('  - Is truncated:', preview.isTruncated);
      console.log('  - Content preview:\n');
      console.log(preview.content.substring(0, 200) + '...');
    }
  } catch (error) {
    console.error('❌ Test 2 failed:', error);
  }

  console.log('\n---\n');

  // Test 3: Error Handling
  console.log('Test 3: Error Handling (non-existent file)');
  try {
    const result = await window.electronAPI.getFileMetadata('./nonexistent.txt');

    if ('error' in result) {
      console.log('✅ Error handled correctly:', result.error);
      console.log('  - Error code:', result.code);
    } else {
      console.error('❌ Should have returned an error');
    }
  } catch (error) {
    console.log('✅ Exception caught correctly:', error.message);
  }

  console.log('\n🎉 All tests completed!');
}

// Run tests
testFilePreview();
