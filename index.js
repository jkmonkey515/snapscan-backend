require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const https = require('https');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

async function googleSearch(query) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !searchEngineId) {
    throw new Error('Google API credentials not configured');
  }

  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          resolve(results);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    console.log('Processing PDF:', req.file.originalname, 'Size:', req.file.size, 'bytes');

    const parser = new PDFParse({ data: req.file.buffer });
    const data = await parser.getText();

    console.log('PDF processed successfully:', data.numpages, 'pages');
    console.log('Sending to OpenAI for analysis...');

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that analyzes PDF documents and provides structured summaries."
        },
        {
          role: "user",
          content: `Please analyze this PDF document and provide a summary:\n\nFilename: ${req.file.originalname}\nPages: ${data.numpages}\n\nContent:\n${data.text.substring(0, 10000)}`
        }
      ]
    });

    const aiResponse = completion.choices[0].message.content;

    console.log('OpenAI analysis completed');

    res.json({
      success: true,
      filename: req.file.originalname,
      pages: data.numpages,
      text: data.text,
      info: data.info,
      aiAnalysis: aiResponse
    });
  } catch (error) {
    console.error('Error processing PDF:', error.message);
    console.error('Full error:', error);
    res.status(500).json({
      error: 'Failed to process PDF file',
      details: error.message
    });
  }
});

app.post('/api/upload-pdf-and-search', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const parser = new PDFParse({ data: req.file.buffer });
    const pdfData = await parser.getText();

    const searchQuery = req.body.searchQuery || pdfData.text.substring(0, 200);

    const searchResults = await googleSearch(searchQuery);

    res.json({
      success: true,
      pdf: {
        filename: req.file.originalname,
        pages: pdfData.numpages,
        textPreview: pdfData.text.substring(0, 500)
      },
      search: {
        query: searchQuery,
        results: searchResults.items || [],
        totalResults: searchResults.searchInformation?.totalResults || '0'
      }
    });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({
      error: 'Failed to process request',
      details: error.message
    });
  }
});

app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = await googleSearch(query);

    res.json({
      success: true,
      query: query,
      results: results.items || [],
      totalResults: results.searchInformation?.totalResults || '0'
    });
  } catch (error) {
    console.error('Error performing search:', error);
    res.status(500).json({
      error: 'Failed to perform search',
      details: error.message
    });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 10MB' });
    }
  }

  res.status(500).json({ error: error.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
