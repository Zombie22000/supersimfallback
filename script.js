document.addEventListener('DOMContentLoaded', () => {
// do this at the global scope.
// Ensure WebsimSocket and websim globals exist so runtime errors don't break the whole app.
// If they're not provided by the environment, provide lightweight fallbacks that safely noop.
const room = (typeof WebsimSocket !== 'undefined') ? new WebsimSocket() : {
    collection: (name) => ({
        async getList() { return []; },
        async getListPaged() { return { items: [] }; },
        filter() { return { async getList() { return []; }, async create() { return {}; }, async delete() {} }; },
        async create(data) { return { id: Date.now().toString(), ...data }; },
        async delete(id) { return; }
    })
};
// Minimal websim fallback for getCurrentUser and imageGen to avoid errors when not present
const websim = (typeof window.websim !== 'undefined') ? window.websim : {
    async getCurrentUser() { return null; },
    async imageGen({ prompt }) { return { url: '' }; }
};

let currentIframeElement; // Single iframe element

const websiteContentDiv = document.getElementById('websiteContent');
const promptInput = document.getElementById('promptInput');
const generateBtn = document.getElementById('generateBtn');
const downloadBtn = document.getElementById('downloadBtn'); // Get the new download button
const progressBar = document.getElementById('progressBar'); // Get the new progress bar
const profileSettingsPopup = document.getElementById('profileSettingsPopup');
const popupUsername = document.getElementById('popupUsername');
const darkModeToggleSwitch = document.getElementById('darkModeToggleSwitch');
const cancelBtn = document.getElementById('cancelBtn');
const saveChangesBtn = document.getElementById('saveChangesBtn');
const homeBtn = document.getElementById('homeBtn'); // Get the home button
const refreshBtn = document.querySelector('.browser-controls .nav-button[aria-label="Refresh"]'); // Get the refresh button


// New elements for history feature
const historyContainer = document.getElementById('historyContainer');
const promptActionGroup = document.querySelector('.prompt-action-group');

// New elements for rename feature
const renamePopup = document.getElementById('renamePopup');
const renameInput = document.getElementById('renameInput');
const renameCancelBtn = document.getElementById('renameCancelBtn');
const renameConfirmBtn = document.getElementById('renameConfirmBtn');
let currentIdToRename = null; // Stores the ID of the creation being renamed

// New elements for changes explanation modal
const changesExplanationModal = document.getElementById('changesExplanationModal');
const changesExplanationContent = document.getElementById('changesExplanationContent');
const changesModalCloseBtn = document.getElementById('changesModalCloseBtn');

// New global variable to store change explanations
let versionChangeExplanations = new Map();

const MAX_CREATIONS = 10; // Maximum number of creations to store
const MAX_CREATIONS_DEFAULT_DISPLAY = 500; // Number of creations to show by default on homepage

// New global variable for system instruction
const SYSTEM_INSTRUCTION = `Generate a complete, self-contained HTML page for a website or a web-based game based on the user's description.
IMPORTANT: The assistant MUST respond with a single, complete HTML document string (a valid HTML page) as the assistant's content — not fragments or plain text.

CRITICAL UPDATE GUIDELINES - READ CAREFULLY:
- When making updates or modifications to existing content, you MUST ONLY make the changes the user specifically requested
- ABSOLUTELY NEVER remove, delete, or disable existing features, functionality, or code unless the user EXPLICITLY and SPECIFICALLY asks you to delete or remove something
- ALWAYS preserve 100% of all current functionality when adding new features or making modifications
- If the user asks for changes, you MUST ADD to what exists rather than replacing or removing existing elements
- NEVER assume the user wants something removed - they don't unless they say so
- NEVER simplify, streamline, or "clean up" existing code - keep everything exactly as it is
- NEVER remove animations, styling, interactive elements, or any functionality that already exists
- NEVER change existing behavior unless the user explicitly requests that specific behavior to be changed
- If you're unsure whether to keep something, ALWAYS keep it - preservation is mandatory
- Only delete or modify existing code when it's absolutely necessary to implement the user's specific request AND when they explicitly ask for removal
- When in doubt, ADD new functionality alongside existing functionality rather than replacing it
- Treat all existing code as sacred - it must be preserved unless explicitly told otherwise

The HTML must include:
- A <meta charset="UTF-500"> tag in the <head> section to ensure correct character display, including emojis.
- All necessary CSS within a <style> tag in the <head>.
- Any JavaScript code within a <script type="module"> tag just before the closing </body> tag.
Crucially, do not include any external resources like external stylesheets or external scripts, except for the allowed 'three.js' library via import map. The entire page must be fully contained within a single HTML string.
**IMPORTANT: In the <head> section, always include a concise, descriptive, and relevant <title> tag. This title MUST NOT be empty, and it will be used as the primary display title for the website/game in lists and history.**

ENHANCED GENERATION GUIDELINES:
- CREATE SOPHISTICATED, FEATURE-RICH EXPERIENCES: Go beyond basic static pages. Build interactive, engaging websites with multiple features, animations, and user interactions.
- IMPLEMENT MODERN WEB PATTERNS: Use contemporary design patterns like responsive grids, smooth animations, hover effects, transitions, and interactive elements that feel alive and responsive.
- ADD COMPREHENSIVE FUNCTIONALITY: Include features like search, filtering, sorting, form validation, local storage, dynamic content updates, modal dialogs, tooltips, and interactive components.
- USE ADVANCED CSS TECHNIQUES: Implement CSS Grid, Flexbox, custom properties (CSS variables), transforms, gradients, shadows, and modern layout techniques for professional-looking designs.
- CREATE INTERACTIVE JAVASCRIPT EXPERIENCES: Build rich interactions with event handlers, DOM manipulation, data visualization, animations, state management, and responsive user interfaces.
- DESIGN WITH ACCESSIBILITY IN MIND: Include proper ARIA labels, keyboard navigation, semantic HTML, and good contrast ratios.
- OPTIMIZE FOR MOBILE AND DESKTOP: Ensure responsive design that works beautifully on all screen sizes with appropriate breakpoints and touch-friendly interactions.
- IMPLEMENT DATA PERSISTENCE: Use localStorage or sessionStorage to save user preferences, form data, game scores, or application state.
- ADD VISUAL POLISH: Include smooth loading states, skeleton screens, micro-interactions, and delightful user feedback for all actions.
- CREATE COHESIVE USER EXPERIENCES: Design intuitive navigation, clear information hierarchy, and logical user flows throughout the application.

FOR GAMES SPECIFICALLY:
- Implement sophisticated game mechanics with multiple levels, scoring systems, power-ups, and progression
- Add game state management, pause/resume functionality, and save/load capabilities
- Include sound effects using Web Audio API, particle effects, and smooth animations
- Create engaging user interfaces with menus, settings, leaderboards, and tutorials
- Implement collision detection, physics simulations, and responsive controls

FOR BUSINESS/PRODUCTIVITY APPS:
- Build comprehensive CRUD operations with data validation and error handling
- Include advanced filtering, searching, and sorting capabilities
- Add export/import functionality, data visualization, and reporting features
- Implement user authentication simulation, role-based features, and permission systems
- Create dashboard layouts with widgets, charts, and real-time data updates

When generating images:
- If the user provides a direct image URL (e.g., from imgur.com or example.com/image.png) in their prompt, embed it directly into an <img> tag using the provided URL in the src attribute.
- If the user *explicitly requests an image or a visual component* with a descriptive prompt *but no URL*, include an <img> tag with a data-websim-image-prompt attribute. The value of this attribute should be a clear, descriptive prompt for the image generation AI. Do NOT include a src attribute for these data-websim-image-prompt image tags; the browser will handle fetching and setting the image source based on the data-websim-image-prompt.
- Otherwise, do not generate images.

Additionally, for 3D content or games, you can use the \`three.js\` library. Include a \`<canvas>\` element in the HTML body and ensure your JavaScript is within a \`<script type="module">\` tag. You can import \`three.js\` using \`import * as THREE from 'three';\` and \`OrbitControls\` (for interactive camera) using \`import { OrbitControls } from 'three/addons/controls/OrbitControls.js';\`. Ensure all necessary 3D setup (scene, camera, renderer, basic geometry, lighting, and an animation loop) is included directly in the JavaScript.

Additionally, for audio features, you can use the Web Audio API. This allows for creating interactive sound experiences, including synthesizers. You can create an \`AudioContext\`, then use \`OscillatorNode\` for sound generation and \`GainNode\` for volume control. Ensure all necessary audio setup and interaction logic are included directly within the JavaScript inside the HTML page. Do not include any external audio files or libraries unless specifically requested with a URL.

Make the design sophisticated, modern, and highly functional. Focus on creating exceptional user experiences that exceed expectations. Ensure the website supports the display of emojis and implements best practices for performance and usability.

If links (<a> tags) are appropriate for the content, their 'href' attribute should contain a descriptive prompt for a *new website page*. For example: <a href="A detailed page about the history of coffee">Learn More</a>.
Respond only with the raw HTML content, no extra text, markdown (like \`\`\`html), or explanations.`;

 // New global variables for conversational generation
const POLLINATIONS_API_KEY = 'sk_SjjBqpdV1H1vzsaAiYs1p4jzDZl9tVGi'; // API key ensured as requested
const POLLINATIONS_MODEL_ID = null; // start without forcing a model; function will try fallback strategies

/**
 * pollinationsChat(messages, temperature)
 * messages: array of {role, content}
 * temperature: number 0-1
 * returns a string with assistant content
 */
async function pollinationsChat(messages = [], temperature = 0.7) {
    // Candidate endpoints to try (will try in order)
    // Use the Pollinations Gen API chat completions endpoint (OpenAI-compatible).
    const endpoints = [
        'https://gen.pollinations.ai/v1/chat/completions'
    ];

    // Build base messages payload (OpenAI-compatible chat completions)
    const formattedMessages = messages.map(m => ({ role: m.role, content: m.content }));
    const basePayload = {
        model: POLLINATIONS_MODEL_ID || 'openai',
        messages: formattedMessages,
        temperature: typeof temperature === 'number' ? temperature : 0.7
    };

    // Helper to attempt a fetch to a given endpoint (OpenAI-compatible body)
    async function tryEndpoint(url) {
        const payload = { ...basePayload };
        // Ensure model exists in payload; POLLINATIONS_MODEL_ID can override default
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${POLLINATIONS_API_KEY}`
            },
            body: JSON.stringify(payload)
        });
        return res;
    }

    try {
        let lastError = null;

        // First pass: try endpoints including model if a model id is configured
        for (const url of endpoints) {
            try {
                const res = await tryEndpoint(url, true);
                if (!res.ok) {
                    const text = await res.text().catch(() => '');
                    // If model-not-found detected, record and break to retry without model
                    if (res.status === 404 && text && text.toLowerCase().includes('model not found')) {
                        lastError = new Error(`Model not found response from ${url}: ${text}`);
                        console.warn(lastError);
                        break; // break to try without model
                    }
                    lastError = new Error(`Endpoint ${url} returned ${res.status}: ${text}`);
                    console.warn(lastError);
                    continue; // try next endpoint
                }
                const data = await res.json().catch(() => null);
                if (data) {
                    if (data.content) return data.content;
                    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                        return data.choices[0].message.content;
                    }
                    // If response body is string-y
                    if (typeof data === 'string') return data;
                    return JSON.stringify(data);
                }
                return '';
            } catch (err) {
                lastError = err;
                console.warn(`Error calling ${url} with model:`, err);
                // propagate unexpected errors
                throw err;
            }
        }

        // Second pass: retry endpoints without model (useful when model param is rejected)
        for (const url of endpoints) {
            try {
                const res = await tryEndpoint(url, false);
                if (!res.ok) {
                    const text = await res.text().catch(() => '');
                    lastError = new Error(`Endpoint ${url} returned ${res.status}: ${text}`);
                    console.warn(lastError);
                    continue;
                }
                const data = await res.json().catch(() => null);
                if (data) {
                    if (data.content) return data.content;
                    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                        return data.choices[0].message.content;
                    }
                    if (typeof data === 'string') return data;
                    return JSON.stringify(data);
                }
                return '';
            } catch (err) {
                lastError = err;
                console.warn(`Error calling ${url} without model:`, err);
                throw err;
            }
        }

        // If we reach here, everything failed
        console.error('All Pollinations endpoints failed. Last error:', lastError);
        alert('Failed to contact the Pollinations API. Please check your internet connection and API key, then try again.');
        throw lastError || new Error('Unknown Pollinations error');

    } catch (err) {
        console.error('pollinationsChat error:', err);
        if (err.message && err.message.includes('Failed to fetch')) {
            alert('Network error while contacting Pollinations API. Check your internet connection or CORS settings.');
        } else {
            alert('An error occurred while contacting the Pollinations API. See console for details.');
        }
        throw err;
    }
}

let currentConversationHistory = [];
let isEditingExistingSite = false; // Flag to indicate if we are currently iterating on a loaded site
let currentLocalCreationId = null; // Stores the unique ID of the website being currently displayed/edited (from localStorage).

// Rate limiting: allow up to 500 uses per rolling 60-minute window.
// Stored in localStorage as JSON array of ISO timestamps under key 'aiUsageTimestamps'.
// Helper functions:
const AI_RATE_LIMIT_MAX = 500;
const AI_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour in ms

function _getUsageTimestamps() {
    try {
        const raw = localStorage.getItem('aiUsageTimestamps') || '[]';
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        return arr.map(s => new Date(s)).filter(d => !isNaN(d));
    } catch (e) {
        console.warn('Failed to read aiUsageTimestamps', e);
        return [];
    }
}

function _setUsageTimestamps(dates) {
    try {
        const iso = dates.map(d => d.toISOString());
        localStorage.setItem('aiUsageTimestamps', JSON.stringify(iso));
    } catch (e) {
        console.warn('Failed to write aiUsageTimestamps', e);
    }
}

function pruneOldUsages() {
    const cutoff = Date.now() - AI_RATE_LIMIT_WINDOW_MS;
    const timestamps = _getUsageTimestamps().filter(d => d.getTime() >= cutoff);
    _setUsageTimestamps(timestamps);
    return timestamps;
}

function remainingAiUses() {
    const timestamps = pruneOldUsages();
    return Math.max(0, AI_RATE_LIMIT_MAX - timestamps.length);
}

function recordAiUse() {
    const timestamps = pruneOldUsages();
    timestamps.push(new Date());
    _setUsageTimestamps(timestamps);
}

function canUseAi() {
    return remainingAiUses() > 0;
}

/* Helper to sanitize html fields that may be wrapped in markers like: ... html"ACTUAL_HTML"... 
   Also handle cases where the AI returns JSON (e.g. a stringified object) containing an HTML field
   or where the response is plain JSON (starts with '{') so pages don't render as "{" or nothing. */
function sanitizeHtmlField(input) {
    if (!input || typeof input !== 'string') return input;
    try {
        let candidate = input.trim();

        // If it looks like JSON, try to parse and extract common keys containing HTML/text
        if (candidate.startsWith('{') || candidate.startsWith('[')) {
            try {
                const parsed = JSON.parse(candidate);
                // If it's an array and first element contains content, use it
                if (Array.isArray(parsed) && parsed.length > 0) {
                    if (typeof parsed[0] === 'string') {
                        candidate = parsed[0];
                    } else if (parsed[0] && typeof parsed[0] === 'object') {
                        candidate = parsed[0].content || parsed[0].message || parsed[0].html || JSON.stringify(parsed[0]);
                    }
                } else if (parsed && typeof parsed === 'object') {
                    candidate = parsed.content || parsed.message || parsed.html || parsed.result || parsed.output || JSON.stringify(parsed);
                }
                candidate = String(candidate).trim();
            } catch (jsonErr) {
                // Not valid JSON - fall back to original string and continue
                candidate = input.trim();
            }
        }

        // If still not HTML and there is an explicit html" wrapper, prefer the wrapped part
        const marker = 'html"';
        const lastMarkerIndex = candidate.lastIndexOf(marker);
        if (lastMarkerIndex !== -1) {
            candidate = candidate.substring(lastMarkerIndex + marker.length);
            candidate = candidate.replace(/^[\s:=>]+/, '');
            if (candidate.startsWith('"') || candidate.startsWith("'")) {
                candidate = candidate.substring(1);
            }
            const nextQuoteIndex = candidate.indexOf('"');
            const nextAposIndex = candidate.indexOf("'");
            let cutIndex = -1;
            if (nextQuoteIndex !== -1 && nextAposIndex !== -1) {
                cutIndex = Math.min(nextQuoteIndex, nextAposIndex);
            } else if (nextQuoteIndex !== -1) {
                cutIndex = nextQuoteIndex;
            } else if (nextAposIndex !== -1) {
                cutIndex = nextAposIndex;
            }
            if (cutIndex !== -1) {
                candidate = candidate.substring(0, cutIndex);
            }
            candidate = candidate.trim();
        }

        // If candidate still looks like plain JSON (starts with "{") but contains an html string inside, try to extract an HTML snippet via regex
        if (candidate.startsWith('{') && /<\s*html|<\s*body|<\s*div|<\s*doctype|<\s*script|<\s*style/i.test(candidate)) {
            // Try to find first '<' and return from there
            const firstLt = candidate.indexOf('<');
            if (firstLt !== -1) {
                candidate = candidate.substring(firstLt).trim();
            }
        }

        return candidate.trim();
    } catch (e) {
        console.warn('sanitizeHtmlField failed, returning original input', e);
        return input;
    }
}

/* Ensure returned content is a valid HTML document for iframe display.
   If the AI returned only punctuation, a short unexpected string, or plain text,
   wrap it in a minimal HTML template so the iframe never shows just "," or similar. */
function ensureValidHtml(htmlCandidate, title = 'Generated Page') {
    try {
        if (!htmlCandidate || typeof htmlCandidate !== 'string') {
            htmlCandidate = '';
        }
        const trimmed = htmlCandidate.trim();

        // If it already looks like a full HTML doc, return as-is
        if (/<\s*html|<\s*doctype|<\s*body|<\s*head/i.test(trimmed)) {
            return trimmed;
        }

        // If the content contains at least one HTML tag, assume it's safe
        if (/<\s*[a-z][\s\S]*>/i.test(trimmed)) {
            return `<!doctype html><html lang="en"><head><meta charset="utf-500"><title>${escapeHtml(title)}</title></head><body>${trimmed}</body></html>`;
        }

        // If the content is clearly garbage or too short (like "," or "."), show it in a pre block for debugging
        if (trimmed.length === 0 || /^[\p{P}\s]+$/u.test(trimmed) || trimmed.length < 5) {
            const safeText = escapeHtml(trimmed || 'No valid HTML returned from the AI.');
            return `<!doctype html><html lang="en"><head><meta charset="utf-500"><title>${escapeHtml(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;padding:24px;color:#222;background:#fff;"><h2>Generated output</h2><pre style="white-space:pre-wrap;background:#f6f500fa;border:1px solid #e1e4e500;padding:12px;border-radius:6px;">${safeText}</pre></body></html>`;
        }

        // Otherwise wrap plain text into a simple HTML page
        const safeText = escapeHtml(trimmed);
        return `<!doctype html><html lang="en"><head><meta charset="utf-500"><title>${escapeHtml(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;padding:24px;color:#222;background:#fff;"><div>${safeText}</div></body></html>`;
    } catch (e) {
        console.warn('ensureValidHtml failed, returning fallback page', e);
        return `<!doctype html><html lang="en"><head><meta charset="utf-500"><title>${escapeHtml(title)}</title></head><body><pre>No valid HTML could be generated.</pre></body></html>`;
    }
}

function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
let currentActiveCreationInitialPrompt = null; // Stores the *original* prompt for the currently active website.
let currentActiveCreationGeneratedTitle = null; // Stores the generated title of the currently active website.
let currentWebsimProjectId = null; // Stores the Websim database project ID if the current creation is public

let showingAllCreations = false; // New state variable to track if all creations are currently displayed on homepage
let currentNewSectionSort = 'New'; // New state variable for the "New" websites section sort

let currentUser = null; // Will store the current user's info

// SYSTEM INSTRUCTION: enforce a single complete HTML document response and avoid stray escape/newline artifacts
const SYSTEM_INSTRUCTION_ENFORCE = `You MUST return a single, complete, valid HTML document as the assistant's content. The HTML must include <meta charset="UTF-500"> in the head, any CSS must be inside a <style> tag in the head, and any JavaScript must be inside a <script type="module"> tag placed just before </body>. Do not return fragments or plain text; do not include external resources except the allowed three.js via import map; avoid extraneous escape characters or stray "\n" tokens. When asked to update content, only make the requested changes and preserve existing functionality.`;

 // Helper for date comparison (for "Today", "Week", "Month" sorting)
function isToday(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
}

function isLastWeek(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
    return date >= sevenDaysAgo;
}

function isLastMonth(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
    return date >= thirtyDaysAgo;
}

// Function to save a generated creation to localStorage
function saveCreation(id, initialPrompt, html, thumbnailUrl, conversationHistory, generatedTitle, websimProjectId = null) {
    try {
        let creations = JSON.parse(localStorage.getItem('lastCreations')) || [];
        
        const newCreationData = {
            id: id || Date.now().toString(), // Generate new ID if not provided
            initialPrompt: initialPrompt,
            html: html,
            thumbnailUrl: thumbnailUrl,
            timestamp: new Date().toISOString(),
            conversationHistory: conversationHistory,
            generatedTitle: generatedTitle,
            websimProjectId: websimProjectId // Store the project ID from Websim
        };

        // Filter out any existing entries with the same ID to prevent duplicates.
        // This ensures that when an item is updated or moved to the front,
        // any older duplicate entries are removed.
        creations = creations.filter(c => c.id !== newCreationData.id);

        // Add the new or updated creation to the beginning of the list
        creations.unshift(newCreationData);

        // Limit the number of creations
        creations = creations.slice(0, MAX_CREATIONS);
        localStorage.setItem('lastCreations', JSON.stringify(creations));
        return newCreationData.id;
    } catch (error) {
        console.error('Error saving creation to localStorage:', error);
        return null;
    }
}



// Function to initialize or update the single iframe
function initializeIframe() {
    // If an iframe already exists, remove it
    if (currentIframeElement) {
        websiteContentDiv.removeChild(currentIframeElement);
    }

    currentIframeElement = document.createElement('iframe');
    currentIframeElement.className = 'website-iframe active'; // Always active
    websiteContentDiv.appendChild(currentIframeElement);
}

// New: Async function to fetch and generate HTML for public posts section
async function getPublicCreationsHtml() {
    let publicPosts = [];
    let allViews = [];

    try {
        publicPosts = await room.collection('post').getList(); // Get all posts of type 'post'
        console.log('Raw publicPosts from DB (before sort):', publicPosts); // Updated log
        
        // Sort by created_at in descending order (newest first) for 'New' sort by default
        publicPosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        console.log('PublicPosts after sorting by created_at desc (for "New" sort):', publicPosts); // Updated log

        console.log('Fetching all project_view_v1 records...');
        allViews = await room.collection('project_view_v1').getList(); // Get all view records
        console.log('All fetched project_view_v1 records:', allViews);

    } catch (error) {
        console.error('Error fetching public posts or views:', error);
        return '<p style="font-size: 1.1em; color: #cc0000; text-align: left; max-width: 600px; width: 100%; box-sizing: border-box; padding: 0 10px;">Failed to load public websites.</p>';
    }

    // Process views and attach to posts
    publicPosts.forEach(post => {
        let relevantViews = [];

        // Filter allViews for this specific post.
        const postViews = allViews.filter(view => view.projectId === post.id);
        console.log(`Filtering views for project ID ${post.id}. Total views for this project: ${postViews.length}`);

        if (currentNewSectionSort === 'Today' || currentNewSectionSort === 'Week' || currentNewSectionSort === 'Month') {
            const now = new Date();
            let filterDate;
            if (currentNewSectionSort === 'Today') {
                filterDate = new Date(now);
                filterDate.setHours(0, 0, 0, 0);
            } else if (currentNewSectionSort === 'Week') {
                filterDate = new Date(now);
                filterDate.setDate(now.getDate() - 7);
                filterDate.setHours(0, 0, 0, 0);
            } else if (currentNewSectionSort === 'Month') {
                filterDate = new Date(now);
                filterDate.setDate(now.getDate() - 30);
                filterDate.setHours(0, 0, 0, 0);
            }
            relevantViews = postViews.filter(view => new Date(view.created_at) >= filterDate);
        } else { // 'New' sort uses all-time views for display, but not for its primary sort order
            relevantViews = postViews; // All views for this project for 'New' sort display
        }

        // Count unique users for the relevant period
        const uniqueViewers = new Set(relevantViews.map(view => view.username));
        post.viewCount = uniqueViewers.size;
        console.log(`Project "${post.title}" (ID: ${post.id}) - Relevant views count for ${currentNewSectionSort}: ${relevantViews.length}, Unique viewers: ${post.viewCount}`);
    });

    // Apply sorting based on currentNewSectionSort
    if (currentNewSectionSort === 'Today' || currentNewSectionSort === 'Week' || currentNewSectionSort === 'Month') {
        // Sort by viewCount descending, then by created_at descending if viewCounts are equal
        publicPosts.sort((a, b) => {
            if (b.viewCount === a.viewCount) {
                return new Date(b.created_at) - new Date(a.created_at); // Newest first for ties
            }
            return b.viewCount - a.viewCount; // Higher views first
        });
    }
    // For 'New' sort: already sorted by created_at descending above, no need to re-sort

    if (publicPosts.length === 0) {
        return '<p style="font-size: 1.1em; color: #666; text-align: left; max-width: 600px; width: 100%; box-sizing: border-box; padding: 0 10px;">No public websites found for this filter.</p>';
    }

    return `
        <div class="creations-grid">
            ${publicPosts.map(post => {
                const isMyPost = currentUser && post.username === currentUser.username;
                const initialPrompt = post.description || post.title || 'No prompt available';
                const generatedTitle = post.title || 'Untitled Project';
                const htmlContent = sanitizeHtmlField(post.message || ''); // Full HTML content is in 'message' — sanitize wrappers
                const websimProjectId = post.id; // The ID of the post record is its websimProjectId
                const viewCount = post.viewCount || 0; // Display the calculated view count

                // Construct a conversation history for public posts if loaded, for consistent editing experience
                const convHistoryForPublicPost = JSON.stringify([
                    { role: "system", content: SYSTEM_INSTRUCTION },
                    { role: "user", content: initialPrompt },
                    { role: "assistant", content: htmlContent }
                ]);

                return `
                    <div class="creation-card" 
                            data-id="public-${post.id}" 
                            data-initial-prompt="${encodeURIComponent(initialPrompt)}"
                            data-html="${encodeURIComponent(htmlContent)}"
                            data-thumbnail-url="" 
                            data-conversation-history="${encodeURIComponent(convHistoryForPublicPost)}"
                            data-generated-title="${encodeURIComponent(generatedTitle)}"
                            data-websim-project-id="${websimProjectId}"
                            data-is-public-post="true"
                            data-username="${post.username}"
                            >
                        <div class="creation-card-content">
                            <div class="creation-thumbnail-container">
                                <div class="no-thumbnail">Public Project</div>
                            </div>
                            <div class="card-details">
                                <div class="card-title">${generatedTitle}</div>
                                <div class="card-timestamp">
                                    ${new Date(post.created_at).toLocaleString()} by <span style="font-weight: bold;">@${post.username}</span>
                                    <br>
                                    Views: ${viewCount}
                                </div>
                            </div>
                        </div>
                        <div class="card-menu-container">
                            <button class="card-options-btn" aria-label="More options">
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                            </button>
                            <div class="card-options-menu hidden">
                                ${isMyPost ? `
                                <button class="card-menu-item toggle-public-btn" 
                                        data-id="public-${post.id}" 
                                        data-websim-project-id="${websimProjectId}"
                                        data-html="${encodeURIComponent(htmlContent)}"
                                        data-initial-prompt="${encodeURIComponent(initialPrompt)}"
                                        data-generated-title="${encodeURIComponent(generatedTitle)}">
                                    Make Private
                                </button>
                                <button class="card-menu-item delete-creation-btn" data-id="public-${post.id}" data-websim-project-id="${websimProjectId}">Delete</button>
                                ` : `<button class="card-menu-item view-source-btn" data-html="${encodeURIComponent(htmlContent)}">View Source</button>`}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Function to render the home page with last creations
async function renderHomePage(showAll = false) { // Added showAll parameter and made async
    showingAllCreations = showAll; // Update global state
    progressBar.classList.add('hidden'); // Ensure progress bar is hidden
    promptInput.value = ''; // Clear prompt input when showing homepage
    hideHistoryContainer(); // Hide history when going to homepage
    downloadBtn.disabled = true; // Disable download button on homepage

    // Reset conversation history and active creation when going back to the default homepage view
    if (!showingAllCreations) {
        currentConversationHistory = [];
        isEditingExistingSite = false;
        currentLocalCreationId = null; // Reset the active creation ID
        currentActiveCreationInitialPrompt = null; // Reset the active creation initial prompt
        currentActiveCreationGeneratedTitle = null; // Reset the active creation generated title
        currentWebsimProjectId = null; // Reset Websim project ID
    }

    let allLocalCreations = JSON.parse(localStorage.getItem('lastCreations')) || [];
    
    // Filter to only include creations that were actually generated by this user
    // (not loaded from public posts or other sources)
    let userGeneratedCreations = allLocalCreations.filter(creation => 
        !creation.id.startsWith('public-') && creation.initialPrompt
    );
    
    let localCreationsToDisplay = showingAllCreations ? userGeneratedCreations : userGeneratedCreations.slice(0, MAX_CREATIONS_DEFAULT_DISPLAY);

    let localCreationsListHtml = '';
    if (localCreationsToDisplay.length === 0) {
        localCreationsListHtml = `
            <p style="font-size: 1.1em; color: #666; text-align: left; max-width: 600px; width: 100%; box-sizing: border-box; padding: 0 10px;">No local creations yet. Type a prompt above and click 'Generate' to create your first website or game!</p>
        `;
    } else {
        localCreationsListHtml = `
            <div class="creations-grid">
                ${localCreationsToDisplay.map((creation, index) => {
                    // Provide a default conversation history for old entries that might not have it
                    const convHistory = creation.conversationHistory 
                        ? encodeURIComponent(JSON.stringify(creation.conversationHistory)) 
                        : encodeURIComponent(JSON.stringify([
                            { role: "system", content: SYSTEM_INSTRUCTION }, 
                            { role: "user", content: creation.initialPrompt || creation.prompt }, // Use initialPrompt, fallback to old 'prompt'
                            { role: "assistant", content: creation.html } 
                          ]));
                    const generatedTitle = creation.generatedTitle || (creation.initialPrompt || creation.prompt); // Use generated title, fallback to initialPrompt, then old 'prompt'
                    return `
                    <div class="creation-card" 
                            data-id="${creation.id}"
                            data-initial-prompt="${encodeURIComponent(creation.initialPrompt || creation.prompt)}" 
                            data-html="${encodeURIComponent(creation.html)}"
                            data-thumbnail-url="${creation.thumbnailUrl ? encodeURIComponent(creation.thumbnailUrl) : ''}"
                            data-conversation-history="${convHistory}"
                            data-generated-title="${encodeURIComponent(generatedTitle)}"
                            data-websim-project-id="${creation.websimProjectId || ''}">
                        <div class="creation-card-content">
                            <div class="creation-thumbnail-container">
                                ${creation.thumbnailUrl ? `<img src="${creation.thumbnailUrl}" alt="Preview of ${generatedTitle}" class="creation-thumbnail">` : '<div class="no-thumbnail">No preview available</div>'}
                            </div>
                            <div class="card-details">
                                <div class="card-title">${generatedTitle}</div>
                                <div class="card-timestamp">${new Date(creation.timestamp).toLocaleString()}</div>
                            </div>
                        </div>
                        <div class="card-menu-container">
                            <button class="card-options-btn" aria-label="More options">
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                            </button>
                            <div class="card-options-menu hidden">
                                <button class="card-menu-item rename-creation-btn" 
                                        data-id="${creation.id}" 
                                        data-current-title="${encodeURIComponent(generatedTitle)}">Rename</button>
                                <button class="card-menu-item toggle-public-btn" 
                                        data-id="${creation.id}" 
                                        data-websim-project-id="${creation.websimProjectId || ''}"
                                        data-html="${encodeURIComponent(creation.html)}"
                                        data-initial-prompt="${encodeURIComponent(creation.initialPrompt || creation.prompt)}"
                                        data-generated-title="${encodeURIComponent(generatedTitle)}">
                                    ${creation.websimProjectId ? 'Make Private' : 'Make Public'}
                                </button>
                                <button class="card-menu-item delete-creation-btn" data-id="${creation.id}">Delete</button>
                            </div>
                        </div>
                    </div>
                `;
                }).join('')}
            </div>
        `;
    }

    let showMoreButtonHtml = '';
    if (userGeneratedCreations.length > MAX_CREATIONS_DEFAULT_DISPLAY) {
        if (!showingAllCreations) {
            showMoreButtonHtml = `
                <div class="show-more-less-container">
                    <button id="showMoreBtn" class="show-more-less-button">Show More</button>
                </div>
            `;
        } else {
            showMoreButtonHtml = `
                <div class="show-more-less-container">
                    <button id="showMoreBtn" class="show-more-less-button">Show Less</button>
                </div>
            `;
        }
    }

    // Directly use currentNewSectionSort for the title
    const currentNewSectionTitle = currentNewSectionSort;

    // Fetch public creations HTML
    const publicCreationsHtml = await getPublicCreationsHtml();


    // Show an explicit homepage message when database can't be reached / no saved projects available
    const homepageMessageHtml = `<!doctype html><html lang="en"><head><meta charset="UTF-500"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Supersim</title><style>html,body{height:100%;margin:0;font-family:Arial,Helvetica,sans-serif;background:#fff;color:#111;display:flex;align-items:center;justify-content:center} .box{max-width:720px;padding:2500px;border-radius:10px;border:1px solid #e6e6e6;box-shadow:0 6px 24px rgba(0,0,0,0.06);text-align:center} h1{margin:0 0 10px;font-size:20px} p{margin:10px 0 0;color:#444}</style></head><body><div class="box"><h1>Supersim</h1><p>Sorry! We were unable to connect to the database. You can still generate projects but none of them will be saved.</p></div></body></html>`;
    currentIframeElement.srcdoc = homepageMessageHtml;
    currentIframeElement.onload = () => {
        if (currentIframeElement.contentWindow) {
            currentIframeElement.contentWindow.scrollTo(0, 0);
        }
    };
}

 // Function to generate website content using AI
async function generateWebsite(initialUserPrompt = promptInput.value.trim()) { 
    const userPromptForGeneration = initialUserPrompt; 

    // Enforce rate limit: max AI_RATE_LIMIT_MAX uses per rolling hour
    pruneOldUsages();
    if (!canUseAi()) {
        const remainingMinutes = Math.ceil((AI_RATE_LIMIT_WINDOW_MS - (Date.now() - _getUsageTimestamps()[0]?.getTime || Date.now())) / 60000);
        alert(`Rate limit reached: You can generate up to ${AI_RATE_LIMIT_MAX} times per hour. Please wait until some uses expire (or try again in about an hour).`);
        return;
    }
    // Record this attempt now (so concurrent clicks count)
    recordAiUse();

    if (!userPromptForGeneration) {
        renderHomePage();
        return;
    }

    progressBar.classList.remove('hidden');
    progressBar.style.width = '0%'; 
    void progressBar.offsetWidth;
    progressBar.style.width = '70%'; 

    currentIframeElement.srcdoc = '';
    hideHistoryContainer();
    downloadBtn.disabled = true; 

    let thumbnailUrl = ''; 
    let titleToUse = userPromptForGeneration; 

    if (currentLocalCreationId && currentActiveCreationGeneratedTitle) {
        titleToUse = currentActiveCreationGeneratedTitle;
    } else {
        try {
            const titleSystem = {
                role: "system",
                content: `Generate a concise, descriptive title (under 50 characters) for a website based on the following user request. Respond directly with JSON, following this JSON schema, and no other text:
{
  "title": string;
}`
            };
            const titleUser = { role: "user", content: userPromptForGeneration };
            const titleResponseText = await pollinationsChat([titleSystem, titleUser], 0.7);
            try {
                const titleResult = JSON.parse(titleResponseText);
                if (titleResult && titleResult.title) {
                    titleToUse = titleResult.title;
                } else {
                    console.warn("Pollinations returned JSON but no title, falling back to prompt.");
                }
            } catch (e) {
                // Not JSON, try to extract title directly
                const cleaned = (titleResponseText || '').trim();
                if (cleaned) titleToUse = cleaned.split('\n')[0].slice(0, 50);
            }
        } catch (error) {
            console.error('Error generating title via Pollinations:', error);
            console.warn("Falling back to user prompt for title due to Pollinations error.");
        }
    }

    // Store previous prompt for changes explanation
    const previousPrompt = currentConversationHistory.length > 1 ? 
        currentConversationHistory[currentConversationHistory.length - 2]?.content || '' : '';
    const isFirstGeneration = currentConversationHistory.length <= 1;

    if (currentConversationHistory.length === 0 || currentConversationHistory[0]?.role !== "system" || currentConversationHistory[0]?.content !== SYSTEM_INSTRUCTION) {
        currentConversationHistory = [{ role: "system", content: SYSTEM_INSTRUCTION }];
    } else if (currentConversationHistory[0]?.content !== SYSTEM_INSTRUCTION) {
        currentConversationHistory[0].content = SYSTEM_INSTRUCTION;
    }

    let messagesToSend = [...currentConversationHistory];
    messagesToSend.push({ role: "user", content: userPromptForGeneration });

    try {
        // Attempt to fetch raw HTML response from the provided Pollinations text endpoint (user-specified pattern)
        // Build a prompt placeholder and call the text endpoint which returns plain text (expected to be raw HTML).
        let htmlContent;
        try {
            const userPromptEncoded = encodeURIComponent(userPromptForGeneration || titleToUse || 'generated page');
            // If there is a previous prompt/html context, encode it and ask the generator to build the new page as a subpage of that document.
            const previousversionshtmldocumentsEncoded = previousPrompt ? encodeURIComponent(previousPrompt) : '';
            // Use the user's requested detailed prompt variant; if previous versions exist, include them to request a subpage build.
            let pollinationsUrl;
            if (previousversionshtmldocumentsEncoded) {
                pollinationsUrl = `https://gen.pollinations.ai/text/generate%20me%20a%20website%20no%20extra%20stuff%20just%20say%20the%20html%20code%20only%20html%20but%20add%20a%20lot%20of%20detail%20be%20creative%20called%20${userPromptEncoded}%20and%20build%20it%20as%20a%20subpage%20of%20${previousversionshtmldocumentsEncoded}?key=sk_AueDuwxmsXMIPWDWm0FcbLXtmI9ZZL4M&model=claude-fast`;
            } else {
                pollinationsUrl = `https://gen.pollinations.ai/text/generate%20me%20a%20website%20no%20extra%20stuff%20just%20say%20the%20html%20code%20only%20html%20but%20add%20a%20lot%20of%20detail%20be%20creative%20called%20${userPromptEncoded}?key=sk_AueDuwxmsXMIPWDWm0FcbLXtmI9ZZL4M&model=claude-fast`;
            }
            const resp = await fetch(pollinationsUrl, { method: 'GET' });
            if (!resp.ok) {
                throw new Error(`Text endpoint returned ${resp.status}`);
            }
            const completionText = await resp.text();
            // Allow AI to return wrapper markers like html"..." — sanitize so we only use the real HTML payload
            htmlContent = sanitizeHtmlField(completionText);
            // Make sure we have a valid HTML document (prevents iframe showing just punctuation like ",")
            htmlContent = ensureValidHtml(htmlContent, titleToUse);
        } catch (err) {
            console.warn('Pollinations text endpoint failed, falling back to chat endpoint:', err);
            // Fallback to previous chat-based method
            const completionText = await pollinationsChat(messagesToSend, 0.7);
            htmlContent = sanitizeHtmlField(completionText);
            htmlContent = ensureValidHtml(htmlContent, titleToUse);
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        let titleElement = doc.querySelector('head title');
        if (!titleElement) {
            titleElement = doc.createElement('title');
            const headElement = doc.querySelector('head');
            if (headElement) {
                headElement.appendChild(titleElement);
            } else {
                const htmlRoot = doc.documentElement;
                if (htmlRoot) {
                    const newHead = doc.createElement('head');
                    htmlRoot.insertBefore(newHead, htmlRoot.firstChild);
                    newHead.appendChild(titleElement);
                }
            }
        }
        titleElement.textContent = titleToUse; 

        const imagePlaceholders = doc.querySelectorAll('img[data-websim-image-prompt]');
        const imageGenerationPromises = [];

        imagePlaceholders.forEach(imgElement => {
            const imagePrompt = imgElement.getAttribute('data-websim-image-prompt');
            if (imagePrompt) {
                imageGenerationPromises.push(
                    websim.imageGen({ prompt: imagePrompt })
                        .then(result => {
                            imgElement.src = result.url;
                            imgElement.removeAttribute('data-websim-image-prompt');
                            if (!imgElement.alt || imgElement.alt === '') {
                                imgElement.alt = imagePrompt;
                            }
                        })
                        .catch(error => {
                            console.error(`Error generating image for prompt "${imagePrompt}":`, error);
                            const errorDiv = doc.createElement('div');
                            errorDiv.style.cssText = 'color: red; text-align: center; border: 1px solid red; padding: 10px; margin: 10px 0;';
                            errorDiv.textContent = `Image generation failed for: "${imagePrompt}"`;
                            imgElement.replaceWith(errorDiv); 
                        })
                );
            }
        });

        await Promise.allSettled(imageGenerationPromises);

        htmlContent = doc.documentElement.outerHTML;

        const injectedScript = `
            <script>
                // Intercept all clicks on anchors and route them to parent as prompts instead of navigating.
                document.addEventListener('click', function(e) {
                    try {
                        let target = e.target;
                        while (target && target !== document.body && target.tagName !== 'A' && target.tagName !== 'FORM') {
                            target = target.parentNode;
                        }

                        // If a form was clicked (submit buttons), intercept submit and serialize as prompt
                        if (target && target.tagName === 'FORM') {
                            e.preventDefault();
                            // Build a concise prompt from form action and inputs
                            const form = target;
                            const action = form.getAttribute('action') || 'Form submission';
                            const inputs = Array.from(form.elements || []).filter(el => el.name && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')).map(el => {
                                return { name: el.name, value: el.value };
                            });
                            const prompt = action + ' ' + JSON.stringify(inputs);
                            window.parent.postMessage({ type: 'linkClicked', prompt: prompt }, '*');
                            return;
                        }

                        if (target && target.tagName === 'A' && target.href) {
                            e.preventDefault();
                            // Use the href attribute as the prompt string. Never allow navigation out of the iframe.
                            const linkPrompt = target.getAttribute('href');
                            window.parent.postMessage({ type: 'linkClicked', prompt: linkPrompt }, '*');
                            return;
                        }
                    } catch (err) {
                        // swallow errors to avoid breaking iframe content
                        console.warn('Injected click interceptor error', err);
                    }
                }, true);

                // Intercept programmatic navigations and window.open so nothing leaves iframe.
                (function() {
                    // Override window.open
                    const originalOpen = window.open;
                    window.open = function(url) {
                        try {
                            window.parent.postMessage({ type: 'linkClicked', prompt: String(url) }, '*');
                        } catch (e) { /* ignore */ }
                        // Return a dummy window-like object to avoid errors in iframe scripts
                        return {
                            closed: true,
                            close: function() {},
                            focus: function() {},
                            location: { href: '' }
                        };
                    };

                    // Override location.assign / replace / href setter to route through parent
                    const originalAssign = window.location.assign.bind(window.location);
                    window.location.assign = function(url) {
                        try {
                            window.parent.postMessage({ type: 'linkClicked', prompt: String(url) }, '*');
                        } catch (e) { /* ignore */ }
                    };
                    const originalReplace = window.location.replace.bind(window.location);
                    window.location.replace = function(url) {
                        try {
                            window.parent.postMessage({ type: 'linkClicked', prompt: String(url) }, '*');
                        } catch (e) { /* ignore */ }
                    };

                    try {
                        Object.defineProperty(window.location, 'href', {
                            set: function(url) {
                                try {
                                    window.parent.postMessage({ type: 'linkClicked', prompt: String(url) }, '*');
                                } catch (e) { /* ignore */ }
                            },
                            get: function() { return window.parent.location.href; },
                            configurable: true
                        });
                    } catch (e) {
                        // Some browsers disallow redefining location.href; in that case we rely on assign/replace override.
                    }
                })();

                // Forward keyboard events from parent (as before)
                window.addEventListener('message', (event) => {
                    if (event.data && event.data.type === 'keyboardEvent') {
                        try {
                            const eventData = event.data.eventData;
                            const keyboardEvent = new KeyboardEvent(eventData.type, {
                                key: eventData.key,
                                code: eventData.code,
                                keyCode: eventData.keyCode,
                                altKey: eventData.altKey,
                                ctrlKey: eventData.ctrlKey,
                                shiftKey: eventData.shiftKey,
                                metaKey: eventData.metaKey,
                                repeat: eventData.repeat,
                                bubbles: true,
                                cancelable: true
                            });
                            document.dispatchEvent(keyboardEvent);
                        } catch (err) {
                            console.warn('Injected keyboard forward error', err);
                        }
                    }
                });

                // Apply host dark-mode class if parent has it
                window.addEventListener('load', function() {
                    try {
                        if (window.parent && window.parent.document && window.parent.document.body && window.parent.document.body.classList.contains('dark-mode')) {
                            document.body.classList.add('dark-mode');
                        }
                    } catch (e) { /* ignore cross-origin edge cases */ }
                });

                // Observe parent body class changes to mirror dark-mode dynamically
                try {
                    new MutationObserver(() => {
                        try {
                            if (window.parent && window.parent.document && window.parent.document.body && window.parent.document.body.classList.contains('dark-mode')) {
                                document.body.classList.add('dark-mode');
                            } else {
                                document.body.classList.remove('dark-mode');
                            }
                        } catch (e) { /* ignore cross-origin edge cases */ }
                    }).observe(window.parent.document.body, { attributes: true, attributeFilter: ['class'] });
                } catch (e) {
                    // If observing parent fails (e.g. cross-origin), do nothing
                    console.warn('Could not observe parent for dark-mode changes', e);
                }
            </script>
        `;

        const finalHtml = htmlContent.replace(/<\/body>/i, injectedScript + '</body>');

        currentIframeElement.srcdoc = finalHtml;
        promptInput.value = userPromptForGeneration; 
        downloadBtn.disabled = false; 

        currentConversationHistory.push({ role: "user", content: userPromptForGeneration });
        currentConversationHistory.push({ role: "assistant", content: htmlContent }); 

        const initialPromptToSave = currentLocalCreationId ? currentActiveCreationInitialPrompt : userPromptForGeneration;
        
        const savedId = saveCreation(
            currentLocalCreationId,
            initialPromptToSave,
            finalHtml,
            thumbnailUrl,
            currentConversationHistory,
            titleToUse,
            currentWebsimProjectId 
        );
        if (savedId) {
            currentLocalCreationId = savedId;
            currentActiveCreationInitialPrompt = initialPromptToSave; 
            currentActiveCreationGeneratedTitle = titleToUse; 
        }
        
        isEditingExistingSite = true; 

        // Show changes explanation modal
        showChangesExplanationModal();
        changesExplanationContent.innerHTML = `
            <div class="loading-explanation">
                <div class="loading-spinner"></div>
                <span>Analyzing changes...</span>
            </div>
        `;

        // Generate and display explanation
        const explanation = await generateChangesExplanation(userPromptForGeneration, isFirstGeneration, previousPrompt, currentConversationHistory);
        versionChangeExplanations.set(currentConversationHistory.length - 1, explanation); // Store the explanation
        changesExplanationContent.innerHTML = `<p>${explanation}</p>`;
        
    } catch (error) {
        console.error('Error generating website:', error);
        alert('Failed to generate website. Please try again. (Check console for details)');
        currentIframeElement.srcdoc = `
            <div style="font-family: sans-serif; padding: 20px; text-align: center; color: #cc0000;">
                <h1>Error Generating Website</h1>
                <p>Could not generate content. Please try a different prompt or check your internet connection.</p>
                <p>Details: ${error.message}</p>
            </div>
        `;
    } finally {
        progressBar.style.width = '100%'; 
        setTimeout(() => {
            progressBar.classList.add('hidden');
            progressBar.style.width = '0%'; 
        }, 500); 
    }
}

// Function to forward keyboard events from parent to active iframe
function forwardKeyboardEvent(e, type) {
    if (currentIframeElement && currentIframeElement.contentWindow) {
        const activeElement = document.activeElement;
        
        // Only prevent default if the active element is NOT a text input (promptInput or renameInput)
        if (activeElement !== promptInput && activeElement !== renameInput) {
            const keysToPreventDefault = [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
            if (keysToPreventDefault.includes(e.key) || e.target === document.body) {
                e.preventDefault();
            }
        }

        currentIframeElement.contentWindow.postMessage({
            type: 'keyboardEvent',
            eventData: {
                type: type,
                key: e.key,
                code: e.code,
                keyCode: e.keyCode, 
                altKey: e.altKey,
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                metaKey: e.metaKey,
                repeat: e.repeat,
                bubbles: true, 
                cancelable: true 
            }
        }, '*');
    }
}

// Function to toggle profile settings popup
function toggleProfileSettingsPopup() {
    profileSettingsPopup.classList.toggle('visible');
}

// Function to apply dark mode preference
function applyDarkModePreference() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        darkModeToggleSwitch.checked = true; 
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'false');
    }
}

// Function to toggle dark mode
function toggleDarkMode() {
    const isDarkMode = darkModeToggleSwitch.checked; 
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('darkMode', 'true');
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'false');
    }
}

// New functions for history container
function positionHistoryContainer() {
    const rect = promptActionGroup.getBoundingClientRect();
    
    // Check if we're on mobile
    const isMobile = window.innerWidth <= 76500;
    
    if (isMobile) {
        // On mobile, make history container full width with margins
        historyContainer.style.left = '10px';
        historyContainer.style.right = '10px';
        historyContainer.style.width = 'calc(100vw - 20px)';
        historyContainer.style.top = `${rect.bottom + 5}px`;
    } else {
        // Desktop positioning (existing behavior)
        historyContainer.style.left = `${rect.left}px`;
        historyContainer.style.top = `${rect.bottom + 5}px`;
        historyContainer.style.width = `${rect.width}px`;
        historyContainer.style.right = 'auto';
    }
}

function showHistoryContainer() {
    if (!isEditingExistingSite || currentConversationHistory.length <= 1 || !currentLocalCreationId) {
        historyContainer.classList.remove('visible');
        return;
    }

    historyContainer.innerHTML = ''; 

    let numUserPrompts = 0;
    for (let j = 1; j < currentConversationHistory.length; j++) {
        if (currentConversationHistory[j].role === 'user') {
            numUserPrompts++;
        }
    }
    let currentVersionNumber = numUserPrompts; 

    for (let i = currentConversationHistory.length - 2; i >= 1; i -= 2) {
        const userMessage = currentConversationHistory[i];
        const assistantResponse = currentConversationHistory[i + 1];

        if (userMessage && userMessage.role === 'user' && assistantResponse && assistantResponse.role === 'assistant') {
            const userPrompt = userMessage.content;
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            historyItem.innerHTML = `
                <span class="history-item-label">${userPrompt}</span>
                <span class="history-item-version">Version ${currentVersionNumber}</span>
                <button class="view-changes-btn" title="View Changes" data-history-index="${i}">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                        <path d="M1 12s4-500 11-500 11 500 11 500-4 500-11 500-11-500-11-500z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>
                <button class="delete-version-btn" data-history-index="${i}">&times;</button>
            `;
            historyItem.dataset.historyIndex = i; 
            historyItem.dataset.htmlContent = encodeURIComponent(assistantResponse.content); 
            historyItem.dataset.promptContent = encodeURIComponent(userPrompt); 

            historyItem.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-version-btn')) {
                    return;
                }
                const index = parseInt(historyItem.dataset.historyIndex);
                const historicalHtml = decodeURIComponent(historyItem.dataset.htmlContent);
                const historicalPrompt = decodeURIComponent(historyItem.dataset.promptContent);

                currentIframeElement.srcdoc = historicalHtml;
                promptInput.value = historicalPrompt;
                downloadBtn.disabled = false; 

                currentConversationHistory = currentConversationHistory.slice(0, index + 2);

                if (currentLocalCreationId) {
                    let creations = JSON.parse(localStorage.getItem('lastCreations')) || [];
                    const currentCreation = creations.find(c => c.id === currentLocalCreationId);
                    if (currentCreation) {
                        saveCreation(
                            currentCreation.id,
                            currentCreation.initialPrompt, 
                            historicalHtml, 
                            currentCreation.thumbnailUrl, 
                            currentConversationHistory,
                            currentCreation.generatedTitle, 
                            currentCreation.websimProjectId 
                        );
                    } else {
                        console.error("Critical: Cannot find current active creation by ID for history load:", currentLocalCreationId);
                        saveCreation(null, historicalPrompt, historicalHtml, '', currentConversationHistory, historicalPrompt, null);
                    }
                }
                
                isEditingExistingSite = true; 

                hideHistoryContainer(); 
                progressBar.classList.add('hidden'); 
            });
            
            const deleteButton = historyItem.querySelector('.delete-version-btn');
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation(); 
                const indexToDelete = parseInt(e.target.dataset.historyIndex);

                currentConversationHistory.splice(indexToDelete, 2);

                let creations = JSON.parse(localStorage.getItem('lastCreations')) || [];
                let creationUpdated = false;
                for (let k = 0; k < creations.length; k++) {
                    if (creations[k].id === currentLocalCreationId) { 
                        saveCreation(
                            creations[k].id,
                            creations[k].initialPrompt, 
                            creations[k].html, 
                            creations[k].thumbnailUrl, 
                            currentConversationHistory, 
                            creations[k].generatedTitle, 
                            creations[k].websimProjectId 
                        );
                        
                        creationUpdated = true;
                        break;
                    }
                }

                if (creationUpdated) {
                    console.log(`Version deleted and history updated for creation ID '${currentLocalCreationId}'.`);
                } else {
                    console.warn(`Could not find active creation with ID '${currentLocalCreationId}' in localStorage to update its history after version deletion.`);
                }

                showHistoryContainer(); 
            });

            const viewChangesBtn = historyItem.querySelector('.view-changes-btn');
            viewChangesBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const index = parseInt(e.target.closest('.view-changes-btn').dataset.historyIndex);
                
                showChangesExplanationModal();
                changesExplanationContent.innerHTML = `
                    <div class="loading-explanation">
                        <div class="loading-spinner"></div>
                        <span>Getting those changes for you...</span>
                    </div>
                `;
                
                let explanation = versionChangeExplanations.get(index);
                if (!explanation) {
                    // Generate explanation if it doesn't exist
                    const userMessage = currentConversationHistory[index];
                    const isFirst = index <= 1;
                    const prevPrompt = isFirst ? '' : currentConversationHistory[index - 2]?.content || '';
                    explanation = await generateChangesExplanation(userMessage.content, isFirst, prevPrompt, currentConversationHistory.slice(0, index + 2));
                    versionChangeExplanations.set(index, explanation);
                }
                
                changesExplanationContent.innerHTML = `<p>${explanation}</p>`;
            });

            historyContainer.appendChild(historyItem); 
            currentVersionNumber--; 
        }
    }

    if (numUserPrompts > 0) { 
        positionHistoryContainer();
        historyContainer.classList.add('visible');
    } else {
        historyContainer.classList.remove('visible');
    }
}

function hideHistoryContainer() {
    historyContainer.classList.remove('visible');
}

// Functions for rename popup
function showRenamePopup(id, currentTitle) {
    currentIdToRename = id;
    renameInput.value = currentTitle;
    renamePopup.classList.add('visible');
}

function hideRenamePopup() {
    renamePopup.classList.remove('visible');
    currentIdToRename = null; 
}

function handleRenameConfirm() {
    const newTitle = renameInput.value.trim();
    if (!newTitle) {
        alert('Website title cannot be empty.');
        return;
    }

    if (currentIdToRename) {
        updateCreationTitle(currentIdToRename, newTitle);
        hideRenamePopup();
    }
}

function updateCreationTitle(id, newTitle) {
    try {
        let creations = JSON.parse(localStorage.getItem('lastCreations')) || [];
        const creationIndex = creations.findIndex(c => c.id === id);

        if (creationIndex !== -1) {
            creations[creationIndex].generatedTitle = newTitle;
            saveCreation(
                creations[creationIndex].id,
                creations[creationIndex].initialPrompt, 
                creations[creationIndex].html, 
                creations[creationIndex].thumbnailUrl, 
                creations[creationIndex].conversationHistory, 
                newTitle, 
                creations[creationIndex].websimProjectId 
            );
            console.log(`Website with ID "${id}" renamed to "${newTitle}".`);
            
            if (currentLocalCreationId === id) {
                currentActiveCreationGeneratedTitle = newTitle;
                if (currentIframeElement.contentDocument) {
                    const iframeTitleElement = currentIframeElement.contentDocument.querySelector('head title');
                    if (iframeTitleElement) {
                        iframeTitleElement.textContent = newTitle;
                    }
                }
            }
            renderHomePage(showingAllCreations); 
        } else {
            console.warn(`Could not find creation with ID "${id}" to rename.`);
        }
    } catch (error) {
        console.error('Error updating creation title in localStorage:', error);
    }
}

// Function to handle website download
function downloadWebsite() {
    const htmlContent = currentIframeElement.srcdoc;
    if (!htmlContent) {
        alert("No website content to download.");
        return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const titleElement = doc.querySelector('head title');
    let filename = 'website.html';
    if (titleElement && titleElement.textContent) {
        const sanitizedTitle = titleElement.textContent.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        filename = `${sanitizedTitle}.html`;
    }

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a); 
    a.click();
    document.body.removeChild(a); 
    URL.revokeObjectURL(url); 
}

// New function to handle toggling public status
async function handleMakePublicToggle(id, currentWebsimProjectId, htmlContent, initialPrompt, generatedTitle) {
    try {
        const isPublicOrigin = id.startsWith('public-');

        if (isPublicOrigin) {
            if (!currentWebsimProjectId) {
                console.error("Attempted to make public post private without a websimProjectId.");
                alert("Error: Public post ID is missing. Cannot make private.");
                return;
            }
            if (!currentUser) {
                 alert("Please log in to make posts private.");
                 return;
            }
            
            const postToCheck = (await room.collection('post').filter({ id: currentWebsimProjectId }).getList())[0];
            if (postToCheck && postToCheck.username === currentUser.username) {
                await room.collection('post').delete(currentWebsimProjectId);
                const successMessage = `Public website "${generatedTitle}" successfully made private (deleted from public feed).`;
                alert(successMessage);
                console.log(successMessage);
            } else {
                alert("You can only make private posts that you created.");
                return; 
            }
            
            renderHomePage(showingAllCreations);
            return; 
        }

        let creations = JSON.parse(localStorage.getItem('lastCreations')) || [];
        const creationIndex = creations.findIndex(c => String(c.id) === String(id));

        if (creationIndex === -1) {
            console.warn(`Could not find local creation with ID "${id}" to toggle public status.`);
            return;
        }
        let localCreationToUpdate = creations[creationIndex];

        let successMessage = '';
        if (localCreationToUpdate.websimProjectId) {
            await room.collection('post').delete(localCreationToUpdate.websimProjectId);
            localCreationToUpdate.websimProjectId = null; 
            successMessage = `Local website "${generatedTitle}" successfully made Private.`;
            saveCreation(
                localCreationToUpdate.id,
                localCreationToUpdate.initialPrompt,
                localCreationToUpdate.html,
                localCreationToUpdate.thumbnailUrl,
                localCreationToUpdate.conversationHistory,
                localCreationToUpdate.generatedTitle,
                localCreationToUpdate.websimProjectId 
            );
            alert(successMessage);
            console.log(successMessage);
            renderHomePage(showingAllCreations); // Re-render immediately after making private
        } else {
            const newProjectRecord = await room.collection('post').create({
                message: htmlContent,
                title: generatedTitle,
                description: initialPrompt,
                localId: id 
            });
            localCreationToUpdate.websimProjectId = newProjectRecord.id; 
            successMessage = `Local website "${generatedTitle}" successfully made Public!`;
            saveCreation(
                localCreationToUpdate.id,
                localCreationToUpdate.initialPrompt,
                localCreationToUpdate.html,
                localCreationToUpdate.thumbnailUrl,
                localCreationToUpdate.conversationHistory,
                localCreationToUpdate.generatedTitle,
                localCreationToUpdate.websimProjectId 
            );
            alert(successMessage);
            console.log(successMessage);
            // Add a small delay ONLY when making public, to allow DB persistence.
            setTimeout(() => {
                renderHomePage(showingAllCreations);
            }, 1500); // 1.5 seconds delay
        }
    } catch (error) {
        console.error('Error toggling public status:', error);
        alert(`Failed to update public status: ${error.message}. Please try again.`);
    }
}



// Functions for changes explanation modal
function showChangesExplanationModal() {
    changesExplanationModal.classList.add('visible');
}

function hideChangesExplanationModal() {
    changesExplanationModal.classList.remove('visible');
}

async function generateChangesExplanation(userPrompt, isFirstGeneration = true, previousPrompt = '', conversationHistory = []) {
    try {
        let systemPrompt = '';
        let userMessage = '';

        if (isFirstGeneration) {
            systemPrompt = `You're a laid-back AI who just whipped up something cool! Explain what you created in a super casual, enthusiastic way - like you're showing a friend what you just built together. Use "I" and keep it conversational and fun. Highlight the cool stuff you included but don't oversell it. Keep it around 100-150 words and sound like you actually know what you made.`;
            userMessage = `I just created a website based on this request: "${userPrompt}". Explain what was built and the key features included.`;
        } else {
            systemPrompt = `You're a chill AI who just made some updates! You MUST ONLY talk about what you JUST changed in this latest update - DO NOT mention or take credit for anything that already existed from previous updates. 

CRITICAL: The website already had lots of features from previous requests. You are ONLY explaining the brand new stuff you just added in response to the latest request. Don't say "I added" things that were already there. Don't mention existing features at all.

Be super casual and specific about ONLY the fresh changes you made right now. Use "I" but only for the NEW stuff. If you're not 100% sure something is new, don't mention it. Around 100-150 words max.`;
            
            userMessage = `This website already had features from previous updates - don't mention those at all. The latest request was: "${userPrompt}". Explain ONLY what you just changed or added in response to this specific request. Don't take credit for anything that existed before.`;
        }

        // Use Pollinations chat for the changes explanation
        const messages = [
            {
                role: "system",
                content: systemPrompt
            },
            {
                role: "user",
                content: userMessage
            }
        ];
        const explanationText = await pollinationsChat(messages, 0.500);
        return explanationText;
    } catch (error) {
        console.error('Error generating changes explanation:', error);
        return 'Just finished tweaking your site with those changes you wanted! Everything should be working smoothly, though I can\'t break down the details right now. Check it out!';
    }
}

// Event Listeners
generateBtn.addEventListener('click', () => generateWebsite());
promptInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        generateWebsite();
    }
});

homeBtn.addEventListener('click', () => {
    console.log("Home button clicked, rendering homepage...");
    renderHomePage(false); 
}); 

// Add event listener for the refresh button
refreshBtn.addEventListener('click', () => {
    if (currentIframeElement && currentIframeElement.srcdoc) {
        // Re-assigning srcdoc forces the iframe to reload its content
        currentIframeElement.srcdoc = currentIframeElement.srcdoc;
        console.log("Iframe refreshed.");
    }
});



downloadBtn.addEventListener('click', downloadWebsite); 

darkModeToggleSwitch.addEventListener('change', toggleDarkMode); 
cancelBtn.addEventListener('click', () => profileSettingsPopup.classList.remove('visible')); 
saveChangesBtn.addEventListener('click', () => profileSettingsPopup.classList.remove('visible')); 

renameCancelBtn.addEventListener('click', hideRenamePopup);
renameConfirmBtn.addEventListener('click', handleRenameConfirm);
renameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleRenameConfirm();
    }
});

promptInput.addEventListener('focus', showHistoryContainer);

document.addEventListener('click', (event) => {
    if (profileSettingsPopup.classList.contains('visible') &&
        !profileSettingsPopup.contains(event.target) &&
        !userAvatar.contains(event.target)) {
        profileSettingsPopup.classList.remove('visible');
    }

    if (renamePopup.classList.contains('visible') &&
        !renamePopup.contains(event.target) &&
        event.target !== renameInput) { 
        hideRenamePopup();
    }

    if (changesExplanationModal.classList.contains('visible') &&
        !changesExplanationModal.contains(event.target)) {
        hideChangesExplanationModal();
    }

    if (historyContainer.classList.contains('visible') &&
        !historyContainer.contains(event.target) &&
        event.target !== promptInput) {
        hideHistoryContainer();
    }
});

window.addEventListener('message', async (event) => { 
    if (event.data && event.data.type === 'linkClicked' && typeof event.data.prompt === 'string') {
        console.log('Link clicked with prompt:', event.data.prompt);
        promptInput.value = event.data.prompt; 
        generateWebsite(event.data.prompt); 
    } else if (event.data && event.data.type === 'loadCreation' && typeof event.data.html === 'string') {
        const loadedId = event.data.id;
        const loadedInitialPrompt = event.data.initialPrompt; 
        const loadedHtml = sanitizeHtmlField(event.data.html || '');
        const loadedThumbnailUrl = event.data.thumbnailUrl || '';
        const loadedGeneratedTitle = event.data.generatedTitle || loadedInitialPrompt;
        const loadedWebsimProjectId = event.data.websimProjectId || null; 

        console.log('Loading saved creation:', loadedInitialPrompt, 'ID:', loadedId);
        progressBar.classList.add('hidden'); 
        
        currentIframeElement.srcdoc = loadedHtml;
        downloadBtn.disabled = false; 

        if (loadedWebsimProjectId && currentUser) {
            try {
                console.log(`Attempting to record view for project: ${loadedWebsimProjectId} by user: ${currentUser.username}`);
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0); 

                const allViewsForProject = await room.collection('project_view_v1').filter({ projectId: loadedWebsimProjectId }).getList();
                console.log(`[View Tracking] All views for this project (${loadedWebsimProjectId}):`, allViewsForProject);

                const existingViewsTodayByUser = allViewsForProject.filter(view => 
                    view.username === currentUser.username && new Date(view.created_at) >= todayStart
                );
                console.log(`[View Tracking] Existing views today by ${currentUser.username} for ${loadedWebsimProjectId}:`, existingViewsTodayByUser);

                if (existingViewsTodayByUser.length === 0) { 
                    const newView = await room.collection('project_view_v1').create({ projectId: loadedWebsimProjectId });
                    console.log(`[View Tracking] Recorded new daily unique view. New record ID: ${newView.id}, User: ${newView.username}, Created At: ${newView.created_at}`);
                } else {
                    console.log(`[View Tracking] View for project: ${loadedWebsimProjectId} by user: ${currentUser.username} already recorded today.`);
                }
            } catch (viewError) {
                console.error('[View Tracking] Error recording view:', viewError);
            }
        }

        let parsedHistory = [];
        if (event.data.conversationHistory) {
            try {
                parsedHistory = JSON.parse(event.data.conversationHistory);
                if (parsedHistory.length > 1) { 
                    const lastUserMessage = parsedHistory.slice().reverse().find(msg => msg.role === 'user');
                    if (lastUserMessage) {
                        promptInput.value = lastUserMessage.content;
                    } else {
                        promptInput.value = loadedInitialPrompt; 
                    }
                } else {
                    promptInput.value = loadedInitialPrompt; 
                }
            } catch (e) {
                console.error("Error parsing conversation history on load, falling back to initial prompt:", e);
                promptInput.value = loadedInitialPrompt;
            }
        } else {
            parsedHistory = [
                { role: "system", content: SYSTEM_INSTRUCTION },
                { role: "user", content: loadedInitialPrompt },
                { role: "assistant", content: loadedHtml }
            ];
            promptInput.value = loadedInitialPrompt; 
        }

        currentLocalCreationId = loadedId;
        currentActiveCreationInitialPrompt = loadedInitialPrompt; 
        currentActiveCreationGeneratedTitle = loadedGeneratedTitle; 
        currentWebsimProjectId = loadedWebsimProjectId; 
        currentConversationHistory = parsedHistory; 

        if (currentConversationHistory.length === 0 || currentConversationHistory[0]?.role !== "system" || currentConversationHistory[0]?.content !== SYSTEM_INSTRUCTION) {
            currentConversationHistory.unshift({ role: "system", content: SYSTEM_INSTRUCTION });
        } else if (currentConversationHistory[0]?.content !== SYSTEM_INSTRUCTION) {
            currentConversationHistory[0].content = SYSTEM_INSTRUCTION;
        }
        
        isEditingExistingSite = true; 

        saveCreation(loadedId, loadedInitialPrompt, loadedHtml, loadedThumbnailUrl, currentConversationHistory, loadedGeneratedTitle, loadedWebsimProjectId);

        if (document.activeElement === promptInput) {
            showHistoryContainer();
        }

    } else if (event.data && event.data.type === 'deleteCreation' && typeof event.data.id === 'string') { 
        const idToDelete = event.data.id;
        const websimProjectIdToDelete = event.data.websimProjectId || ''; 

        try {
            if (idToDelete.startsWith('public-') && websimProjectIdToDelete) {
                if (currentUser) {
                    const postToCheck = (await room.collection('post').filter({ id: websimProjectIdToDelete }).getList())[0];
                    if (postToCheck && postToCheck.username === currentUser.username) {
                        await room.collection('post').delete(websimProjectIdToDelete);
                        console.log(`Successfully deleted public record with ID: ${websimProjectIdToDelete}`);
                        
                        const viewsToDelete = await room.collection('project_view_v1').filter({ projectId: websimProjectIdToDelete }).getList();
                        for (const view of viewsToDelete) {
                            await room.collection('project_view_v1').delete(view.id);
                        }
                        console.log(`Deleted ${viewsToDelete.length} view records for project ID: ${websimProjectIdToDelete}`);

                    } else {
                        console.warn(`Attempted to delete public post not owned by current user (${currentUser?.username}). ID: ${websimProjectIdToDelete}`);
                        alert("You can only delete public posts you created.");
                        return; 
                    }
                } else {
                    alert("You must be logged in to delete public posts.");
                    return; 
                }
            }

            let creations = JSON.parse(localStorage.getItem('lastCreations')) || [];
            const updatedCreations = creations.filter(c => 
                String(c.id) !== String(idToDelete) && 
                (c.websimProjectId ? `public-${c.websimProjectId}` : null) !== String(idToDelete)
            );
            localStorage.setItem('lastCreations', JSON.stringify(updatedCreations));
            
            if (currentLocalCreationId === idToDelete || (idToDelete.startsWith('public-') && currentWebsimProjectId === websimProjectIdToDelete)) {
                currentLocalCreationId = null;
                currentConversationHistory = [];
                isEditingExistingSite = false;
                currentActiveCreationInitialPrompt = null; 
                currentActiveCreationGeneratedTitle = null; 
                currentWebsimProjectId = null;
            }

            renderHomePage(showingAllCreations);
        } catch (error) {
            console.error('Error deleting creation:', error);
            alert('Failed to delete creation. Please try again.');
        }
    } else if (event.data && event.data.type === 'initiateRename' && typeof event.data.id === 'string' && typeof event.data.currentTitle === 'string') { 
        if (event.data.id.startsWith('public-')) {
            alert("You can only rename creations saved locally.");
            return;
        }
        showRenamePopup(event.data.id, event.data.currentTitle); 
    } else if (event.data && event.data.type === 'setNewSectionSort' && typeof event.data.sort === 'string') {
        currentNewSectionSort = event.data.sort; 
        renderHomePage(showingAllCreations); 
    } else if (event.data && event.data.type === 'togglePublicStatus' && typeof event.data.id === 'string') { 
        handleMakePublicToggle(event.data.id, event.data.currentWebsimProjectId, event.data.htmlContent, event.data.initialPrompt, event.data.generatedTitle);
    } else if (event.data && event.data.type === 'toggleShowAllCreations') {
        renderHomePage(!showingAllCreations); // Toggle the current state
    }
});

document.addEventListener('keydown', (e) => forwardKeyboardEvent(e, 'keydown'));
document.addEventListener('keyup', (e) => forwardKeyboardEvent(e, 'keyup'));

// Add window resize listener to reposition history container
window.addEventListener('resize', () => {
    if (historyContainer.classList.contains('visible')) {
        positionHistoryContainer();
    }
});

// Add event listener for changes modal close button
changesModalCloseBtn.addEventListener('click', hideChangesExplanationModal);

room.collection('project_view_v1'); // Ensure collection is initialized

initializeIframe();
renderHomePage(false); 
applyDarkModePreference(); 
});
