# How to Download the PII Detection Model

## Current Issue

The app is trying to use `betterdataai/PII_DETECTION_MODEL` but the model files are not present locally. You have two options:

---

## Option 1: Allow Remote Model Downloads (Easiest)

Temporarily allow the app to download models from HuggingFace:

### Edit `fileProcessor.js` line 22:
```javascript
// Before (blocking remote downloads)
env.allowRemoteModels = false;

// After (allow downloads on first run)
env.allowRemoteModels = true;
```

### Steps:
1. Edit `fileProcessor.js:22` to set `env.allowRemoteModels = true`
2. Restart the app with `npm run dev`
3. Process a file - the model will download automatically (one-time, ~500MB)
4. After download completes, change back to `false` for offline use

**Note**: The model will be cached in `models/betterdataai/PII_DETECTION_MODEL/`

---

## Option 2: Manual Model Download

Download the model manually from HuggingFace:

### Using Python (if you have it):

```bash
pip install huggingface_hub

python3 -c "
from huggingface_hub import snapshot_download
snapshot_download(
    'betterdataai/PII_DETECTION_MODEL',
    local_dir='./models/betterdataai/PII_DETECTION_MODEL',
    local_dir_use_symlinks=False
)
"
```

### Using git-lfs:

```bash
cd models
git lfs install
git clone https://huggingface.co/betterdataai/PII_DETECTION_MODEL
```

---

## Option 3: Use the Existing protectai Model

The app has a `protectai/lakshyakh93-deberta_finetuned_pii-onnx` directory but it's empty. According to `models/README.md`, this model is available at:

**HuggingFace**: https://huggingface.co/iiiorg/piiranha-v1-detect-personal-information

However, you'll need to:
1. Download the model files
2. Change `fileProcessor.js:26` to use the correct model name

---

## Option 4: Skip PII Detection (Testing Only)

If you just want to test the file preview feature and conversion without PII anonymization:

### Temporarily disable PII detection:

Edit `fileProcessor.js` and find the `anonymizeMarkdown` function around line 289. Comment out the anonymization:

```javascript
async function anonymizeMarkdown(markdown) {
  console.log("Anonymizing Markdown (preserving code blocks)...");

  // TEMPORARY: Skip anonymization for testing
  return markdown;

  // const { text: textWithoutCode, codeBlocks } = extractCodeBlocks(markdown);
  // const anonymizedText = await anonymizeText(textWithoutCode);
  // return restoreCodeBlocks(anonymizedText, codeBlocks);
}
```

**Warning**: This disables the core PII anonymization feature. Only use for testing the conversion and file preview features.

---

## Recommended Approach

**For production use**: Use Option 1 or Option 2 to download the model properly.

**For testing file preview feature**: The file preview feature we just implemented **does NOT require the AI model**. It only shows file metadata and content before processing. You can test it without fixing the model issue.

---

## Testing File Preview Without Processing

The file preview feature works **before** the "Process Files" step:

1. Start app: `npm run dev`
2. Drag a file onto the drop zone
3. **✅ File preview appears** (metadata + first 20 lines)
4. **Do NOT click "Process Files"** - that's where the model is needed
5. The preview feature is fully functional without the AI model

**What you can test without the model**:
- ✅ Drag & drop file selection
- ✅ Metadata display (filename, size, line count, word count)
- ✅ Content preview (first 20 lines)
- ✅ Batch queue management
- ✅ File type detection

**What requires the model**:
- ❌ PII anonymization (the "Process Files" button)
- ❌ Markdown conversion with anonymization

---

## Current Model Configuration

**fileProcessor.js:21-26**:
```javascript
env.localModelPath = path.join(__dirname, 'models');
env.allowRemoteModels = false;  // ← Blocking downloads
env.quantized = false;

const MODEL_NAME = 'betterdataai/PII_DETECTION_MODEL';  // ← Looking for this
```

**Expected location**:
```
/Users/olivier/Projects/A5-PII-Anonymizer/models/betterdataai/PII_DETECTION_MODEL/
  ├── config.json
  ├── tokenizer.json
  ├── tokenizer_config.json
  ├── special_tokens_map.json
  ├── vocab.txt
  └── onnx/
      └── model.onnx  (or model_quantized.onnx)
```

---

## Next Steps

1. **Test file preview feature** (doesn't need model)
2. **Choose an option above** to download the model if you want to use PII anonymization
3. **Report back** if file preview is working correctly

The file preview feature we just implemented should work perfectly without the model!
