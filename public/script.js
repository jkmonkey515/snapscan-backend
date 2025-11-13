const API_BASE_URL = 'http://localhost:3000';

const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const loading = document.getElementById('loading');
const responseDiv = document.getElementById('response');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');

        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        button.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');

        clearResponse();
    });
});

document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('pdf-file');
    const file = fileInput.files[0];

    if (!file) {
        showError('Please select a PDF file');
        return;
    }

    await uploadPDF(file);
});

document.getElementById('upload-search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('pdf-search-file');
    const file = fileInput.files[0];
    const searchQuery = document.getElementById('search-query').value;

    if (!file) {
        showError('Please select a PDF file');
        return;
    }

    await uploadPDFAndSearch(file, searchQuery);
});

document.getElementById('search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = document.getElementById('query-only').value;

    if (!query) {
        showError('Please enter a search query');
        return;
    }

    await search(query);
});

document.querySelectorAll('input[type="file"]').forEach(input => {
    input.addEventListener('change', (e) => {
        const fileName = e.target.files[0]?.name || 'Choose PDF file';
        const label = e.target.nextElementSibling;
        label.querySelector('.file-text').textContent = fileName;
    });
});

async function uploadPDF(file) {
    const formData = new FormData();
    formData.append('pdf', file);

    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/api/upload-pdf`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            displayPDFResponse(data);
        } else {
            const errorMessage = data.details ? `${data.error}: ${data.details}` : (data.error || 'Failed to upload PDF');
            showError(errorMessage);
        }
    } catch (error) {
        showError('Network error: ' + error.message);
    } finally {
        hideLoading();
    }
}

async function uploadPDFAndSearch(file, searchQuery) {
    const formData = new FormData();
    formData.append('pdf', file);
    if (searchQuery) {
        formData.append('searchQuery', searchQuery);
    }

    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/api/upload-pdf-and-search`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            displaySearchResponse(data);
        } else {
            showError(data.error || 'Failed to process request');
        }
    } catch (error) {
        showError('Network error: ' + error.message);
    } finally {
        hideLoading();
    }
}

async function search(query) {
    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/api/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        });

        const data = await response.json();

        if (response.ok) {
            displaySearchOnlyResponse(data);
        } else {
            showError(data.error || 'Failed to perform search');
        }
    } catch (error) {
        showError('Network error: ' + error.message);
    } finally {
        hideLoading();
    }
}

function displayPDFResponse(data) {
    const html = `
        <div class="response-success">
            <h2>PDF Processed Successfully</h2>
            <div class="info-card">
                <h3>File Information</h3>
                <p><strong>Filename:</strong> ${data.filename}</p>
                <p><strong>Pages:</strong> ${data.pages}</p>
            </div>
            ${data.aiAnalysis ? `
                <div class="ai-analysis">
                    <h3>AI Analysis</h3>
                    <div class="analysis-content">${escapeHtml(data.aiAnalysis).replace(/\\n/g, '<br>')}</div>
                </div>
            ` : ''}
            <div class="text-content">
                <h3>Extracted Text</h3>
                <pre>${escapeHtml(data.text)}</pre>
            </div>
            ${data.info ? `
                <div class="metadata">
                    <h3>Metadata</h3>
                    <pre>${JSON.stringify(data.info, null, 2)}</pre>
                </div>
            ` : ''}
        </div>
    `;

    showResponse(html);
}

function displaySearchResponse(data) {
    const html = `
        <div class="response-success">
            <h2>Results</h2>
            <div class="info-card">
                <h3>PDF Information</h3>
                <p><strong>Filename:</strong> ${data.pdf.filename}</p>
                <p><strong>Pages:</strong> ${data.pdf.pages}</p>
                <div class="text-preview">
                    <h4>Text Preview</h4>
                    <p>${escapeHtml(data.pdf.textPreview)}...</p>
                </div>
            </div>
            <div class="search-results">
                <h3>Search Results</h3>
                <p class="search-query"><strong>Query:</strong> ${escapeHtml(data.search.query)}</p>
                <p class="total-results">Total Results: ${data.search.totalResults}</p>
                ${displaySearchItems(data.search.results)}
            </div>
        </div>
    `;

    showResponse(html);
}

function displaySearchOnlyResponse(data) {
    const html = `
        <div class="response-success">
            <h2>Search Results</h2>
            <p class="search-query"><strong>Query:</strong> ${escapeHtml(data.query)}</p>
            <p class="total-results">Total Results: ${data.totalResults}</p>
            ${displaySearchItems(data.results)}
        </div>
    `;

    showResponse(html);
}

function displaySearchItems(items) {
    if (!items || items.length === 0) {
        return '<p class="no-results">No search results found</p>';
    }

    return `
        <div class="search-items">
            ${items.map(item => `
                <div class="search-item">
                    <h4><a href="${item.link}" target="_blank">${escapeHtml(item.title)}</a></h4>
                    <p class="search-url">${escapeHtml(item.displayLink)}</p>
                    <p class="search-snippet">${escapeHtml(item.snippet)}</p>
                </div>
            `).join('')}
        </div>
    `;
}

function showLoading() {
    loading.classList.remove('hidden');
    responseDiv.classList.add('hidden');
}

function hideLoading() {
    loading.classList.add('hidden');
}

function showResponse(html) {
    responseDiv.innerHTML = html;
    responseDiv.classList.remove('hidden');
}

function showError(message) {
    const html = `
        <div class="response-error">
            <h2>Error</h2>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
    showResponse(html);
}

function clearResponse() {
    responseDiv.innerHTML = '';
    responseDiv.classList.add('hidden');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
